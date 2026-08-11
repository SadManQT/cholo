import { pool } from '../config/db.js';

export async function insert({ userId, phone, otpHash, purpose, expiresAt }) {
  const { rows } = await pool.query(
    `INSERT INTO otp_verifications (user_id, phone, otp_hash, purpose, expires_at)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [userId, phone, otpHash, purpose, expiresAt],
  );

  return rows[0].id;
}

// The most recent unconsumed code for this phone+purpose — older codes are
// implicitly superseded once a newer one is requested (register() then
// resendOtp() can each insert a row within the same request-handling
// window). Ordered by id, not created_at: Postgres's now() is frozen for
// the lifetime of a transaction, so two inserts issued close together can
// share an identical created_at — id is a BIGINT IDENTITY column, strictly
// increasing regardless, and is the only reliable "most recent" tiebreaker.
export async function findLatestActive(phone, purpose) {
  const { rows } = await pool.query(
    `SELECT id, user_id AS "userId", otp_hash AS "otpHash", attempts,
            expires_at AS "expiresAt"
     FROM otp_verifications
     WHERE phone = $1 AND purpose = $2 AND verified_at IS NULL
     ORDER BY id DESC
     LIMIT 1`,
    [phone, purpose],
  );

  return rows[0];
}

export async function incrementAttempts(id) {
  await pool.query(
    `UPDATE otp_verifications SET attempts = attempts + 1 WHERE id = $1`,
    [id],
  );
}

export async function markVerified(id) {
  await pool.query(
    `UPDATE otp_verifications SET verified_at = now() WHERE id = $1`,
    [id],
  );
}
