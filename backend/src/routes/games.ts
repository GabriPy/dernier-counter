import { Router } from 'express';
import { pool } from '../db/pool';
import { asyncHandler } from '../utils/asyncHandler';
import { HttpError } from '../utils/httpError';
import { parseId } from '../utils/parseId';

export const gamesRouter = Router();

/**
 * Select riutilizzabile: total_points e total_hands sono calcolati in tempo reale
 * dalle mani, così anche le partite "in_progress" risultano sempre coerenti.
 */
const GAME_SELECT = `
  SELECT g.id,
         g.started_at,
         g.ended_at,
         g.status,
         g.winner_id,
         w.name AS winner_name,
         COALESCE((
           SELECT SUM(hs.points)::int
             FROM hand_scores hs
             JOIN hands h ON h.id = hs.hand_id
            WHERE h.game_id = g.id
         ), 0) AS total_points,
         (SELECT COUNT(*)::int FROM hands h WHERE h.game_id = g.id) AS total_hands,
         (SELECT COUNT(*)::int FROM hands h WHERE h.game_id = g.id AND h.winner_id = g.winner_id) AS winner_hands_won,
         COALESCE((
           SELECT json_agg(json_build_object('id', pl.id, 'name', pl.name) ORDER BY gp.seat_order)
             FROM game_players gp
             JOIN players pl ON pl.id = gp.player_id
            WHERE gp.game_id = g.id
         ), '[]'::json) AS players
    FROM games g
    LEFT JOIN players w ON w.id = g.winner_id
`;

/** GET /api/games?limit=10 — ultime partite (homepage) */
gamesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const requested = Number(req.query.limit ?? 10);
    const limit = Number.isInteger(requested) ? Math.min(Math.max(requested, 1), 100) : 10;

    const { rows } = await pool.query(
      `${GAME_SELECT} ORDER BY g.started_at DESC, g.id DESC LIMIT $1`,
      [limit]
    );
    res.json(rows);
  })
);

/** GET /api/games/:id — dettaglio di una partita: giocatori, mani e classifica */
gamesRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id, 'ID partita');

    const game = await pool.query(`${GAME_SELECT} WHERE g.id = $1`, [id]);
    if (game.rowCount === 0) {
      throw new HttpError(404, 'Partita non trovata');
    }

    const hands = await pool.query(
      `SELECT h.id,
              h.hand_number,
              h.winner_id,
              w.name AS winner_name,
              json_agg(json_build_object(
                'player_id', hs.player_id,
                'name', p.name,
                'points', hs.points
              ) ORDER BY p.name) AS scores
         FROM hands h
         JOIN players w ON w.id = h.winner_id
         JOIN hand_scores hs ON hs.hand_id = h.id
         JOIN players p ON p.id = hs.player_id
        WHERE h.game_id = $1
        GROUP BY h.id, h.hand_number, h.winner_id, w.name
        ORDER BY h.hand_number ASC`,
      [id]
    );

    const standings = await pool.query(
      `SELECT gp.player_id,
              p.name,
              COALESCE(SUM(hs.points), 0)::int AS total_points_paid
         FROM game_players gp
         JOIN players p ON p.id = gp.player_id
         LEFT JOIN hands h ON h.game_id = gp.game_id
         LEFT JOIN hand_scores hs ON hs.hand_id = h.id AND hs.player_id = gp.player_id
        WHERE gp.game_id = $1
        GROUP BY gp.player_id, p.name, gp.seat_order
        ORDER BY gp.seat_order ASC`,
      [id]
    );

    res.json({ ...game.rows[0], hands: hands.rows, standings: standings.rows });
  })
);

/** POST /api/games — crea una partita con la lista di giocatori */
gamesRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const rawIds = req.body?.player_ids;
    if (!Array.isArray(rawIds) || rawIds.length < 2) {
      throw new HttpError(400, 'Servono almeno 2 giocatori per iniziare una partita');
    }

    const playerIds = rawIds.map((value: unknown) => Number(value));
    if (playerIds.some((id: number) => !Number.isInteger(id) || id <= 0)) {
      throw new HttpError(400, 'La lista dei giocatori contiene ID non validi');
    }
    if (new Set(playerIds).size !== playerIds.length) {
      throw new HttpError(400, 'Un giocatore non può comparire due volte nella stessa partita');
    }

    const existing = await pool.query('SELECT id FROM players WHERE id = ANY($1::int[])', [playerIds]);
    if (existing.rowCount !== playerIds.length) {
      throw new HttpError(400, 'Uno o più giocatori selezionati non esistono');
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const created = await client.query(
        `INSERT INTO games (status) VALUES ('in_progress') RETURNING id`
      );
      const gameId: number = created.rows[0].id;

      for (const [index, playerId] of playerIds.entries()) {
        await client.query(
          `INSERT INTO game_players (game_id, player_id, seat_order) VALUES ($1, $2, $3)`,
          [gameId, playerId, index]
        );
      }

      await client.query('COMMIT');

      const { rows } = await pool.query(`${GAME_SELECT} WHERE g.id = $1`, [gameId]);
      res.status(201).json(rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  })
);

/** Minuti di inattività oltre i quali una partita in corso viene chiusa d'ufficio. */
const STALE_MINUTES = Number(process.env.STALE_GAME_MINUTES ?? 30);

/** Ogni quanto lo sweeper controlla le partite inattive. */
const SWEEP_INTERVAL_MS = 60_000;

/**
 * Chiude la partita calcolando vincitore, punti totali e numero di mani.
 * Vince chi ha pagato meno punti; a parità, chi ha vinto più mani.
 * Condivisa dalla chiusura manuale e da quella automatica.
 */
async function finishGame(id: number) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const gameRes = await client.query('SELECT id, status FROM games WHERE id = $1 FOR UPDATE', [id]);
    if (gameRes.rowCount === 0) {
      throw new HttpError(404, 'Partita non trovata');
    }
    if (gameRes.rows[0].status !== 'in_progress') {
      throw new HttpError(409, 'La partita è già stata chiusa');
    }

    const totalsRes = await client.query(
      `SELECT
         (SELECT COUNT(*)::int FROM hands WHERE game_id = $1) AS total_hands,
         COALESCE((
           SELECT SUM(hs.points)::int
             FROM hand_scores hs
             JOIN hands h ON h.id = hs.hand_id
            WHERE h.game_id = $1
         ), 0) AS total_points`,
      [id]
    );
    const { total_hands: totalHands, total_points: totalPoints } = totalsRes.rows[0];

    if (totalHands === 0) {
      throw new HttpError(400, 'Non puoi chiudere una partita senza aver giocato almeno una mano');
    }

    const winnerRes = await client.query(
      `SELECT gp.player_id,
              COALESCE(SUM(hs.points), 0)::int AS points_paid,
              COUNT(DISTINCT CASE WHEN h2.winner_id = gp.player_id THEN h2.id END)::int AS hands_won
         FROM game_players gp
         LEFT JOIN hands h2 ON h2.game_id = gp.game_id
         LEFT JOIN hand_scores hs ON hs.hand_id = h2.id AND hs.player_id = gp.player_id
        WHERE gp.game_id = $1
        GROUP BY gp.player_id
        ORDER BY points_paid ASC, hands_won DESC, gp.player_id ASC
        LIMIT 1`,
      [id]
    );

    if (winnerRes.rowCount === 0) {
      throw new HttpError(400, 'La partita non ha giocatori associati');
    }
    const winnerId: number = winnerRes.rows[0].player_id;

    await client.query(
      `UPDATE games
          SET status = 'finished',
              ended_at = NOW(),
              winner_id = $2,
              total_points = $3,
              total_hands = $4
        WHERE id = $1`,
      [id, winnerId, totalPoints, totalHands]
    );

    await client.query('COMMIT');

    const { rows } = await pool.query(`${GAME_SELECT} WHERE g.id = $1`, [id]);
    return rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/** PATCH /api/games/:id/finish — chiusura manuale */
gamesRouter.patch(
  '/:id/finish',
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id, 'ID partita');
    res.json(await finishGame(id));
  })
);

/**
 * Chiude d'ufficio le partite in corso ferme da oltre STALE_MINUTES minuti.
 * Salta quelle senza mani: non ci sarebbe un vincitore da eleggere.
 */
export async function closeStaleGames(): Promise<number[]> {
  const { rows } = await pool.query(
    `SELECT g.id
       FROM games g
      WHERE g.status = 'in_progress'
        AND g.last_activity_at < NOW() - ($1::int * INTERVAL '1 minute')
        AND EXISTS (SELECT 1 FROM hands h WHERE h.game_id = g.id)
      ORDER BY g.last_activity_at ASC`,
    [STALE_MINUTES]
  );

  const closed: number[] = [];
  for (const row of rows as { id: number }[]) {
    try {
      await finishGame(row.id);
      closed.push(row.id);
    } catch (err) {
      // può essere stata chiusa nel frattempo da qualcun altro: la saltiamo
      console.warn(
        `Chiusura automatica della partita ${row.id} saltata:`,
        err instanceof Error ? err.message : err
      );
    }
  }
  return closed;
}

/** Avvia il controllo periodico delle partite inattive. */
export function startStaleGameSweeper(): void {
  const tick = (): void => {
    closeStaleGames()
      .then((closed) => {
        if (closed.length > 0) {
          console.log(
            `Chiusura automatica: partite ${closed.join(', ')} (ferme da oltre ${STALE_MINUTES} minuti)`
          );
        }
      })
      .catch((err) => console.error('Errore nella chiusura automatica delle partite', err));
  };

  tick();
  setInterval(tick, SWEEP_INTERVAL_MS);
}

/**
 * DELETE /api/games/:id
 * Elimina una partita mai giocata — tipicamente aperta per sbaglio.
 * Una partita con mani registrate non si elimina: va chiusa, per non perdere
 * punti e vittorie già conteggiati nelle statistiche dei giocatori.
 */
gamesRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id, 'ID partita');

    const deleted = await pool.query(
      `DELETE FROM games g
        WHERE g.id = $1
          AND NOT EXISTS (SELECT 1 FROM hands h WHERE h.game_id = g.id)`,
      [id]
    );

    if (deleted.rowCount === 0) {
      const existing = await pool.query('SELECT 1 FROM games WHERE id = $1', [id]);
      if (existing.rowCount === 0) {
        throw new HttpError(404, 'Partita non trovata');
      }
      throw new HttpError(409, 'La partita ha mani registrate: chiudila invece di eliminarla');
    }

    res.status(204).send();
  })
);
