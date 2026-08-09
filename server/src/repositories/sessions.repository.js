import { pool } from '../config/db.js';

export async function createSession({ userId, deviceType, deviceName, ipAddress, userAgent }, client = pool) {
  const { rows } = await client.query(
    `INSERT INTO login_sessions (user_id, device_type, device_name, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [userId, deviceType, deviceName ?? null, ipAddress ?? null, userAgent ?? null],
  );

  return rows[0].id;
}

export async function createRefreshToken({ userId, sessionId, tokenHash, expiresAt }, client = pool) {
  const { rows } = await client.query(
    `INSERT INTO refresh_tokens (user_id, session_id, token_hash, expires_at)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [userId, sessionId, tokenHash, expiresAt],
  );

  return rows[0].id;
}

// Locks the row so two concurrent refresh calls with the same token can't
// both win the rotation race (doc 10 §7) — must be called inside a
// transaction (BEGIN already issued on `client`).
export async function findByHashForUpdate(tokenHash, client) {
  const { rows } = await client.query(
    `SELECT id, user_id AS "userId", session_id AS "sessionId",
            revoked_at AS "revokedAt", expires_at AS "expiresAt"
     FROM refresh_tokens
     WHERE token_hash = $1
     FOR UPDATE`,
    [tokenHash],
  );

  return rows[0];
}

export async function revoke(id, client = pool) {
  await client.query(
    `UPDATE refresh_tokens SET revoked_at = now() WHERE id = $1`,
    [id],
  );
}

export async function setReplacedBy(id, replacedById, client = pool) {
  await client.query(
    `UPDATE refresh_tokens SET replaced_by = $2 WHERE id = $1`,
    [id, replacedById],
  );
}

export async function revokeActiveForSession(sessionId, client = pool) {
  await client.query(
    `UPDATE refresh_tokens SET revoked_at = now() WHERE session_id = $1 AND revoked_at IS NULL`,
    [sessionId],
  );
}

export async function revokeActiveForUser(userId, client = pool) {
  await client.query(
    `UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`,
    [userId],
  );
}

export async function endSession(sessionId, client = pool) {
  await client.query(
    `UPDATE login_sessions SET logged_out_at = now(), is_active = false WHERE id = $1`,
    [sessionId],
  );
}

export async function endAllSessionsForUser(userId, client = pool) {
  await client.query(
    `UPDATE login_sessions SET logged_out_at = now(), is_active = false
     WHERE user_id = $1 AND is_active = true`,
    [userId],
  );
}

// Change-password (doc 10 §8) revokes every OTHER session but keeps the one
// making the request alive — it just proved it knows the current password.
export async function revokeActiveForUserExceptSession(userId, exceptSessionId, client = pool) {
  await client.query(
    `UPDATE refresh_tokens SET revoked_at = now()
     WHERE user_id = $1 AND session_id <> $2 AND revoked_at IS NULL`,
    [userId, exceptSessionId],
  );
}

export async function endAllSessionsForUserExceptSession(userId, exceptSessionId, client = pool) {
  await client.query(
    `UPDATE login_sessions SET logged_out_at = now(), is_active = false
     WHERE user_id = $1 AND id <> $2 AND is_active = true`,
    [userId, exceptSessionId],
  );
}
