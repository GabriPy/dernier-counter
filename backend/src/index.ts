import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import { pool } from './db/pool';
import { gamesRouter } from './routes/games';
import { handsRouter } from './routes/hands';
import { playersRouter } from './routes/players';

const app = express();
const PORT = Number(process.env.PORT ?? 3000);

app.use(cors());
app.use(express.json());

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok' });
  } catch {
    res.status(503).json({ status: 'db_unavailable' });
  }
});

app.use('/api/players', playersRouter);
app.use('/api/games', gamesRouter);
app.use('/api/games/:gameId/hands', handsRouter);

app.use((_req, res) => {
  res.status(404).json({ error: 'Endpoint non trovato' });
});

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const status = (err as { status?: number }).status ?? 500;
  const message = err instanceof Error ? err.message : 'Errore interno del server';

  if (status >= 500) {
    console.error(err);
  }
  res.status(status).json({ error: message });
});

app.listen(PORT, () => {
  console.log(`API dernier in ascolto sulla porta ${PORT}`);
});
