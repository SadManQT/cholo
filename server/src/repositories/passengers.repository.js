import { pool } from '../config/db.js';

// Mirrors driver.service.js's driver_profiles creation on /driver/apply:
// the profile is created at the moment the role is actually granted, not
// via a trigger — passenger_profiles isn't in doc 02-03 §7's trigger
// catalog the way wallets/driver_availability are, so this stays
// application-level like driver_profiles does.
export async function insertProfile(userId, client = pool) {
  await client.query(
    `INSERT INTO passenger_profiles (user_id) VALUES ($1)
     ON CONFLICT (user_id) DO NOTHING`,
    [userId],
  );
}

// rating_avg deliberately NOT cast to float8 — doc 08-09-10 §10.2's worked
// example shows the accept response as a fixed 2-decimal string ("5.00"),
// which NUMERIC(3,2)'s default pg-driver string representation already is.
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
