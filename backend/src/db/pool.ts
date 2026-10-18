import { Pool } from 'pg';

/**
 * Pool di connessioni condiviso da tutte le route.
 * Le variabili d'ambiente vengono fornite da docker-compose (o da un file .env in locale).
 */
export const pool = new Pool({
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  user: process.env.DB_USER ?? 'dernier',
  password: process.env.DB_PASSWORD ?? 'dernierpass',
  database: process.env.DB_NAME ?? 'dernier',
  max: 10,
  idleTimeoutMillis: 30_000,
});

pool.on('error', (err) => {
  console.error('Errore inatteso sul pool Postgres', err);
});
