import { pool } from '../config/db.js';

export async function findAll() {
  const { rows } = await pool.query(
    `SELECT
       id,
       name,
       country,
       timezone,
       currency,
       launched_at::text AS "launchedAt"
     FROM cities
     WHERE is_active = $1
     ORDER BY name ASC`,
    [true],
  );

  return rows;
}
