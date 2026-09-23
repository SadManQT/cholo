import { pool } from '../config/db.js';

export async function insertProfile(userId, client = pool) {
  await client.query(
    `INSERT INTO passenger_profiles (user_id) VALUES ($1)
     ON CONFLICT (user_id) DO NOTHING`,
    [userId],
  );
}

export async function findNameAndRating(userId, client = pool) {
  const { rows } = await client.query(
    `SELECT u.full_name AS "fullName", pp.rating_avg AS "ratingAvg"
     FROM passenger_profiles pp
     JOIN users u ON u.id = pp.user_id
     WHERE pp.user_id = $1`,
    [userId],
  );

  return rows[0];
}
