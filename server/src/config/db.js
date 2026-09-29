import pg from 'pg';

import { env } from './env.js';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: env.DATABASE_SSL ? { rejectUnauthorized: false } : undefined,
});

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

export function afterCommit(client, callback) {
  if (client?.afterCommitCallbacks) client.afterCommitCallbacks.push(callback);
  else callback();
}

export async function withTransaction(work) {
  const client = await pool.connect();
  client.afterCommitCallbacks = [];

  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    for (const callback of client.afterCommitCallbacks) {
      try { callback(); } catch (error) { console.error('afterCommit callback failed:', error); }
    }
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.afterCommitCallbacks = undefined;
    client.release();
  }
}
