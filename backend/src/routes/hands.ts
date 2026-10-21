import { Router } from 'express';
import { pool } from '../db/pool';
import { asyncHandler } from '../utils/asyncHandler';
import { HttpError } from '../utils/httpError';
import { parseId } from '../utils/parseId';

/**
 * Router montato su /api/games/:gameId/hands — mergeParams permette
 * di leggere :gameId dal router genitore.
 */
export const handsRouter = Router({ mergeParams: true });

interface ParsedScore {
  playerId: number;
  points: number;
}

/** POST /api/games/:gameId/hands — registra una mano con i punteggi dei giocatori */
handsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const gameId = parseId((req.params as { gameId?: string }).gameId, 'ID partita');

    const rawScores: unknown = req.body?.scores;
    if (!Array.isArray(rawScores) || rawScores.length === 0) {
      throw new HttpError(400, 'Il campo "scores" deve essere un array non vuoto');
    }

    const scores: ParsedScore[] = rawScores.map((entry) => {
      const playerId = Number((entry as { player_id?: unknown })?.player_id);
      const points = Number((entry as { points?: unknown })?.points);

      if (!Number.isInteger(playerId) || playerId <= 0) {
        throw new HttpError(400, 'Ogni voce deve avere un "player_id" valido');
      }
      if (!Number.isInteger(points) || points < 0) {
        throw new HttpError(400, 'I punti devono essere interi non negativi');
      }
      return { playerId, points };
    });

    const uniqueIds = new Set(scores.map((score) => score.playerId));
    if (uniqueIds.size !== scores.length) {
      throw new HttpError(400, 'Ogni giocatore può comparire una sola volta nella mano');
    }

    const winners = scores.filter((score) => score.points === 0);
    if (winners.length !== 1) {
      throw new HttpError(400, 'Deve esserci esattamente un giocatore con 0 punti');
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const gameRes = await client.query('SELECT id, status FROM games WHERE id = $1 FOR UPDATE', [gameId]);
      if (gameRes.rowCount === 0) {
        throw new HttpError(404, 'Partita non trovata');
      }
      if (gameRes.rows[0].status !== 'in_progress') {
        throw new HttpError(409, 'La partita è già stata chiusa');
      }

      const playersRes = await client.query('SELECT player_id FROM game_players WHERE game_id = $1', [gameId]);
      const gamePlayerIds: number[] = playersRes.rows.map((row) => row.player_id);

      const allPlayersScored = gamePlayerIds.every((id) => uniqueIds.has(id));
      if (gamePlayerIds.length !== scores.length || !allPlayersScored) {
        throw new HttpError(400, 'I punteggi devono includere tutti e soli i giocatori della partita');
      }

      const numberRes = await client.query(
        'SELECT COALESCE(MAX(hand_number), 0) + 1 AS hand_number FROM hands WHERE game_id = $1',
        [gameId]
      );
      const handNumber: number = numberRes.rows[0].hand_number;

      const handRes = await client.query(
        `INSERT INTO hands (game_id, hand_number, winner_id)
         VALUES ($1, $2, $3)
         RETURNING id, game_id, hand_number, winner_id`,
        [gameId, handNumber, winners[0].playerId]
      );
      const handId: number = handRes.rows[0].id;

      // tiene traccia dell'ultima mano: da qui decorre la chiusura automatica
      await client.query('UPDATE games SET last_activity_at = NOW() WHERE id = $1', [gameId]);

      for (const score of scores) {
        await client.query(
          'INSERT INTO hand_scores (hand_id, player_id, points) VALUES ($1, $2, $3)',
          [handId, score.playerId, score.points]
        );
      }

      await client.query('COMMIT');

      res.status(201).json({
        ...handRes.rows[0],
        scores: scores.map((score) => ({
          player_id: score.playerId,
          points: score.points,
        })),
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  })
);
