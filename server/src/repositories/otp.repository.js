import { pool } from '../config/db.js';

export async function insert({ userId, phone, otpHash, purpose, expiresAt }, client = pool) {
  const { rows } = await client.query(
    `INSERT INTO otp_verifications (user_id, phone, otp_hash, purpose, expires_at)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [userId, phone, otpHash, purpose, expiresAt],
  );

  return rows[0].id;
}

export async function findLatestActiveForUpdate(phone, purpose, client) {
  const { rows } = await client.query(
    `SELECT id, user_id AS "userId", otp_hash AS "otpHash", attempts,
            expires_at AS "expiresAt"
     FROM otp_verifications
     WHERE phone = $1 AND purpose = $2 AND verified_at IS NULL
     ORDER BY id DESC
     LIMIT 1
     FOR UPDATE`,
    [phone, purpose],
  );

  return rows[0];
}

export async function incrementAttempts(id, client = pool) {
  await client.query(
    `UPDATE otp_verifications SET attempts = attempts + 1 WHERE id = $1`,
    [id],
  );
}

export async function markVerified(id, client = pool) {
  await client.query(
    `UPDATE otp_verifications SET verified_at = now() WHERE id = $1`,
    [id],
  );
}
