import pg from 'pg';

import { env } from './env.js';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  // Supabase's pooler presents a certificate from its own CA, so encrypt without CA verification.
  ssl: env.DATABASE_SSL ? { rejectUnauthorized: false } : undefined,
});

// Cholo runs in Bangladesh: every "today", daily and monthly bucket (views included) is a Dhaka calendar
// day. Hosted Postgres defaults to UTC, which filed 00:00–06:00 trips under the previous day.
pool.on('connect', (client) => {
  client.query("SET TIME ZONE 'Asia/Dhaka'").catch((error) => console.error('Could not set session time zone:', error));
});

pool.on('error', (error) => {
  console.error('Unexpected PostgreSQL pool error:', error);
});

export async function checkDatabaseConnection() {
  const client = await pool.connect();
  client.release();
}

export async function withTransaction(work) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}
