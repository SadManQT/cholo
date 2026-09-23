import { pool } from '../config/db.js';

export async function findTripForRating(tripCode, userId, client) {
  const { rows } = await client.query(
    `SELECT id, status, passenger_id AS "passengerId", driver_id AS "driverId"
     FROM trips WHERE trip_code = $1 AND (passenger_id = $2 OR driver_id = $2)
     FOR UPDATE`,
    [tripCode, userId],
  );
  return rows[0];
}

export async function insert({ tripId, raterId, rateeId, raterRole, score, comment }, client = pool) {
  const { rows } = await client.query(
    `INSERT INTO ratings (trip_id, rater_id, ratee_id, rater_role, score, comment)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING score, comment, created_at AS "createdAt"`,
    [tripId, raterId, rateeId, raterRole, score, comment ?? null],
  );
  return rows[0];
}

/** Recomputes the ratee's average from the ratings table so it can never drift from the source rows. */
export async function refreshAverage(rateeId, raterRole, client) {
  const table = raterRole === 'passenger' ? 'driver_profiles' : 'passenger_profiles';
  await client.query(
    `UPDATE ${table} p SET rating_avg = COALESCE(s.avg, 5.00), rating_count = s.n
     FROM (SELECT round(avg(score)::numeric, 2) AS avg, count(*)::int AS n
           FROM ratings WHERE ratee_id = $1 AND rater_role = $2) s
     WHERE p.user_id = $1`,
    [rateeId, raterRole],
  );
}
