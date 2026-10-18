import { Router } from 'express';
import { pool } from '../db/pool';
import { asyncHandler } from '../utils/asyncHandler';
import { HttpError } from '../utils/httpError';
import { parseId } from '../utils/parseId';

export const playersRouter = Router();

const PLAYER_FIELDS = 'id, name, created_at, is_active';

/** GET /api/players — lista giocatori (di default solo attivi) */
playersRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const includeInactive = req.query.include_inactive === 'true';
    const { rows } = await pool.query(
      `SELECT ${PLAYER_FIELDS}
         FROM players
        ${includeInactive ? '' : 'WHERE is_active = TRUE'}
        ORDER BY name ASC`
    );
    res.json(rows);
  })
);

/** GET /api/players/:id/stats — vittorie, punti pagati e partite giocate */
playersRouter.get(
  '/:id/stats',
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id, 'ID giocatore');

    const player = await pool.query(`SELECT ${PLAYER_FIELDS} FROM players WHERE id = $1`, [id]);
    if (player.rowCount === 0) {
      throw new HttpError(404, 'Giocatore non trovato');
    }

    const { rows } = await pool.query(
      `SELECT
         (SELECT COUNT(*)::int FROM hands h WHERE h.winner_id = $1) AS hands_won,
         (SELECT COUNT(*)::int FROM games g WHERE g.winner_id = $1 AND g.status = 'finished') AS games_won,
         (SELECT COUNT(*)::int FROM game_players gp WHERE gp.player_id = $1) AS games_played,
         COALESCE((SELECT SUM(hs.points)::int FROM hand_scores hs WHERE hs.player_id = $1), 0) AS total_points_paid`,
      [id]
    );

    res.json({ player: player.rows[0], ...rows[0] });
  })
);

/** POST /api/players — crea un giocatore */
playersRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const rawName = req.body?.name;
    const name = typeof rawName === 'string' ? rawName.trim() : '';
    if (!name) {
      throw new HttpError(400, 'Il nome del giocatore è obbligatorio');
    }
    if (name.length > 100) {
      throw new HttpError(400, 'Il nome non può superare i 100 caratteri');
    }

    try {
      const { rows } = await pool.query(
        `INSERT INTO players (name) VALUES ($1) RETURNING ${PLAYER_FIELDS}`,
        [name]
      );
      res.status(201).json(rows[0]);
    } catch (err) {
      if ((err as { code?: string }).code === '23505') {
        throw new HttpError(409, 'Esiste già un giocatore con questo nome');
      }
      throw err;
    }
  })
);

/** PUT /api/players/:id — modifica nome e/o stato attivo */
playersRouter.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id, 'ID giocatore');

    const rawName = req.body?.name;
    const name = typeof rawName === 'string' ? rawName.trim() : null;
    const isActive = typeof req.body?.is_active === 'boolean' ? req.body.is_active : null;

    if (name === null && isActive === null) {
      throw new HttpError(400, 'Nessun campo da aggiornare');
    }
    if (name !== null && (name.length === 0 || name.length > 100)) {
      throw new HttpError(400, 'Il nome deve contenere da 1 a 100 caratteri');
    }

    try {
      const { rows } = await pool.query(
        `UPDATE players
            SET name = COALESCE($2, name),
                is_active = COALESCE($3, is_active)
          WHERE id = $1
          RETURNING ${PLAYER_FIELDS}`,
        [id, name, isActive]
      );
      if (rows.length === 0) {
        throw new HttpError(404, 'Giocatore non trovato');
      }
      res.json(rows[0]);
    } catch (err) {
      if ((err as { code?: string }).code === '23505') {
        throw new HttpError(409, 'Esiste già un giocatore con questo nome');
      }
      throw err;
    }
  })
);

/**
 * DELETE /api/players/:id
 * Disattivazione logica: il giocatore non compare più nelle nuove partite
 * ma lo storico resta consultabile.
 */
playersRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id, 'ID giocatore');

    const { rows } = await pool.query(
      `UPDATE players SET is_active = FALSE WHERE id = $1 RETURNING ${PLAYER_FIELDS}`,
      [id]
    );
    if (rows.length === 0) {
      throw new HttpError(404, 'Giocatore non trovato');
    }
    res.json(rows[0]);
  })
);
