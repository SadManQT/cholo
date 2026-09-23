import { pool } from '../config/db.js';

const PLACE_COLUMNS = `id, label, address_text AS "address", lat::float8 AS lat, lng::float8 AS lng, created_at AS "createdAt"`;

export async function listSaved(userId, client = pool) {
  const { rows } = await client.query(
    `SELECT ${PLACE_COLUMNS} FROM saved_places WHERE user_id = $1
     ORDER BY CASE lower(label) WHEN 'home' THEN 0 WHEN 'university' THEN 1 WHEN 'work' THEN 2 ELSE 3 END, created_at`,
    [userId],
  );
  return rows;
}

export async function countSaved(userId, client = pool) {
  const { rows } = await client.query(`SELECT count(*)::int AS n FROM saved_places WHERE user_id = $1`, [userId]);
  return rows[0].n;
}

export async function insertSaved(userId, { label, address, lat, lng }, client = pool) {
  const { rows } = await client.query(
    `INSERT INTO saved_places (user_id, label, address_text, lat, lng) VALUES ($1, $2, $3, $4, $5)
     RETURNING ${PLACE_COLUMNS}`,
    [userId, label, address, lat, lng],
  );
  return rows[0];
}

export async function updateSaved(userId, id, { label, address, lat, lng }, client = pool) {
  const { rows } = await client.query(
    `UPDATE saved_places SET label = COALESCE($3, label), address_text = COALESCE($4, address_text),
            lat = COALESCE($5, lat), lng = COALESCE($6, lng)
     WHERE id = $2 AND user_id = $1 RETURNING ${PLACE_COLUMNS}`,
    [userId, id, label ?? null, address ?? null, lat ?? null, lng ?? null],
  );
  return rows[0];
}

export async function deleteSaved(userId, id, client = pool) {
  const { rowCount } = await client.query(`DELETE FROM saved_places WHERE id = $2 AND user_id = $1`, [userId, id]);
  return rowCount > 0;
}

/** Distinct recent pickup and drop-off points from the passenger's own ride requests, newest first. */
export async function listRecent(userId, limit, client = pool) {
  const { rows } = await client.query(
    `SELECT address, lat, lng, max(used_at) AS "usedAt" FROM (
       SELECT dropoff_address AS address, dropoff_lat::float8 AS lat, dropoff_lng::float8 AS lng, requested_at AS used_at
       FROM ride_requests WHERE passenger_id = $1 AND dropoff_address IS NOT NULL
       UNION ALL
       SELECT pickup_address, pickup_lat::float8, pickup_lng::float8, requested_at
       FROM ride_requests WHERE passenger_id = $1 AND pickup_address IS NOT NULL
     ) points
     GROUP BY address, lat, lng ORDER BY max(used_at) DESC LIMIT $2`,
    [userId, limit],
  );
  return rows;
}

const CONTACT_COLUMNS = `id, name, phone, relationship, priority`;

export async function listContacts(userId, client = pool) {
  const { rows } = await client.query(
    `SELECT ${CONTACT_COLUMNS} FROM emergency_contacts WHERE user_id = $1 ORDER BY priority, id`,
    [userId],
  );
  return rows;
}

export async function insertContact(userId, { name, phone, relationship }, client = pool) {
  const { rows } = await client.query(
    `INSERT INTO emergency_contacts (user_id, name, phone, relationship, priority)
     VALUES ($1, $2, $3, $4, (SELECT COALESCE(max(priority), 0) + 1 FROM emergency_contacts WHERE user_id = $1))
     RETURNING ${CONTACT_COLUMNS}`,
    [userId, name, phone, relationship ?? null],
  );
  return rows[0];
}

export async function deleteContact(userId, id, client = pool) {
  const { rowCount } = await client.query(`DELETE FROM emergency_contacts WHERE id = $2 AND user_id = $1`, [userId, id]);
  return rowCount > 0;
}
