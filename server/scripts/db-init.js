import { readdir, readFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import pg from 'pg';
import dotenv from 'dotenv';

const here = dirname(fileURLToPath(import.meta.url));
const databaseDirectory = resolve(here, '../../database');
dotenv.config({ path: resolve(here, '../../.env'), quiet: true });
const connectionString = process.env.DATABASE_URL;

if (!connectionString) throw new Error('DATABASE_URL is required for db:init');

const client = new pg.Client({ connectionString });
await client.connect();

try {
  const { rows } = await client.query(`SELECT to_regclass('public.users') AS users`);
  if (!rows[0].users) {
    await client.query(await readFile(resolve(databaseDirectory, 'schema.sql'), 'utf8'));
    await client.query(await readFile(resolve(databaseDirectory, 'seeds/seed.reference.sql'), 'utf8'));
    console.log('Database schema and reference data initialized.');
  }

  await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    filename text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`);

  const migrationDirectory = resolve(databaseDirectory, 'migrations');
  const files = (await readdir(migrationDirectory)).filter((name) => name.endsWith('.sql')).sort();
  for (const filename of files) {
    const applied = await client.query(`SELECT 1 FROM schema_migrations WHERE filename = $1`, [filename]);
    if (applied.rowCount) continue;

    // Databases born from the current schema already contain the changes
    // described by historical migrations. Record those as a baseline
    // instead of replaying CREATE FUNCTION statements into a fresh schema.
    if (filename === '0003_fn_current_commission.sql') {
      const exists = await client.query(
        `SELECT to_regprocedure('fn_current_commission(smallint,smallint,timestamp with time zone)') AS fn`,
      );
      if (exists.rows[0].fn) {
        await client.query(`INSERT INTO schema_migrations (filename) VALUES ($1)`, [filename]);
        continue;
      }
    }

    await client.query(await readFile(resolve(migrationDirectory, filename), 'utf8'));
    await client.query(`INSERT INTO schema_migrations (filename) VALUES ($1)`, [filename]);
    console.log(`Applied migration ${basename(filename)}.`);
  }

  await client.query(await readFile(resolve(databaseDirectory, 'seeds/seed.reference.sql'), 'utf8'));
} finally {
  await client.end();
}
