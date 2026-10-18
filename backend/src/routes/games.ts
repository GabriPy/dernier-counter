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

/**
 * PATCH /api/games/:id/finish
 * Chiude la partita calcolando vincitore, punti totali e numero di mani.
 * Vince chi ha pagato meno punti; a parità, chi ha vinto più mani.
 */
gamesRouter.patch(
  '/:id/finish',
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id, 'ID partita');
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
      res.json(rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  })
);
