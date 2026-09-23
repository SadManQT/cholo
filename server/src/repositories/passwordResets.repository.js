import { pool } from '../config/db.js';

export async function insert({ userId, tokenHash, expiresAt }, client = pool) {
  await client.query(
    `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
    [userId, tokenHash, expiresAt],
  );
}

export async function findUsableForUpdate(tokenHash, client) {
  const { rows } = await client.query(
    `SELECT id, user_id AS "userId" FROM password_reset_tokens
     WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()
     FOR UPDATE`,
    [tokenHash],
  );
  return rows[0];
}

export async function markUsed(id, client) {
  await client.query(`UPDATE password_reset_tokens SET used_at = now() WHERE id = $1`, [id]);
}
