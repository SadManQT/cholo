import { pool } from '../config/db.js';

export async function insert({ userId, category, title, body, payload }, client = pool) {
  await client.query(
    `INSERT INTO notifications (user_id, category, title, body, payload) VALUES ($1, $2, $3, $4, $5)`,
    [userId, category, title, body ?? null, payload ?? null],
  );
}

export async function listForUser(userId, { page, limit }, client = pool) {
  const { rows } = await client.query(
    `SELECT id, category, title, body, payload, read_at AS "readAt", created_at AS "createdAt",
            count(*) OVER()::int AS "totalCount"
     FROM notifications WHERE user_id = $1
     ORDER BY created_at DESC, id DESC LIMIT $2 OFFSET $3`,
    [userId, limit, (page - 1) * limit],
  );
  return rows;
}

export async function countUnread(userId, client = pool) {
  const { rows } = await client.query(
    `SELECT count(*)::int AS unread FROM notifications WHERE user_id = $1 AND read_at IS NULL`,
    [userId],
  );
  return rows[0].unread;
}

export async function markRead(userId, ids, client = pool) {
  const { rowCount } = await client.query(
    `UPDATE notifications SET read_at = now()
     WHERE user_id = $1 AND read_at IS NULL AND ($2::bigint[] IS NULL OR id = ANY($2::bigint[]))`,
    [userId, ids ?? null],
  );
  return rowCount;
}
