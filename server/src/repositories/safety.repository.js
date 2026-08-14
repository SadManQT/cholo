import { pool } from '../config/db.js';

export async function notifyAdmins(alert, triggeredBy, client) {
  await client.query(
    `INSERT INTO notifications (user_id, category, title, body, payload)
     SELECT ur.user_id, 'safety', 'New SOS alert',
            'An SOS alert needs immediate attention.',
            jsonb_build_object('alertId', $1::bigint, 'triggeredBy', $2::bigint)
     FROM user_roles ur JOIN roles r ON r.id = ur.role_id
     JOIN users u ON u.id = ur.user_id
     WHERE r.name = 'ADMIN' AND u.status = 'active'`,
    [alert.id, triggeredBy],
  );
}

export async function listEmergencyContacts(userId, client) {
  const { rows } = await client.query(
    `SELECT name, phone, relationship, priority FROM emergency_contacts
     WHERE user_id = $1 ORDER BY priority, id`,
    [userId],
  );
  return rows;
}

export async function listQueue({ status, page, limit }, client = pool) {
  const offset = (page - 1) * limit;
  const { rows } = await client.query(
    `SELECT sa.id, sa.status, sa.lat::float8 AS lat, sa.lng::float8 AS lng,
            sa.triggered_at AS "triggeredAt", sa.resolved_at AS "resolvedAt",
            sa.resolution_note AS "resolutionNote", u.full_name AS "triggeredByName",
            u.phone AS "triggeredByPhone", t.trip_code AS "tripCode",
            au.full_name AS "acknowledgedByName", count(*) OVER()::int AS "totalCount"
     FROM sos_alerts sa JOIN users u ON u.id = sa.triggered_by
     LEFT JOIN trips t ON t.id = sa.trip_id LEFT JOIN users au ON au.id = sa.acknowledged_by
     WHERE ($1::text IS NULL OR sa.status::text = $1)
     ORDER BY CASE WHEN sa.status = 'active' THEN 0 WHEN sa.status = 'acknowledged' THEN 1 ELSE 2 END,
              sa.triggered_at DESC LIMIT $2 OFFSET $3`,
    [status ?? null, limit, offset],
  );
  return rows;
}

export async function findForUpdate(alertId, client) {
  const { rows } = await client.query(
    `SELECT id, status, acknowledged_by AS "acknowledgedBy", resolution_note AS "resolutionNote"
     FROM sos_alerts WHERE id = $1 FOR UPDATE`,
    [alertId],
  );
  return rows[0];
}

export async function acknowledge(alertId, adminId, client) {
  const { rows } = await client.query(
    `UPDATE sos_alerts SET status = 'acknowledged', acknowledged_by = $2
     WHERE id = $1 RETURNING id, status, acknowledged_by AS "acknowledgedBy"`,
    [alertId, adminId],
  );
  return rows[0];
}

export async function resolve(alertId, { status, resolutionNote, adminId }, client) {
  const { rows } = await client.query(
    `UPDATE sos_alerts SET status = $2, resolution_note = $3,
       acknowledged_by = COALESCE(acknowledged_by, $4), resolved_at = now()
     WHERE id = $1
     RETURNING id, status, acknowledged_by AS "acknowledgedBy",
               resolution_note AS "resolutionNote", resolved_at AS "resolvedAt"`,
    [alertId, status, resolutionNote, adminId],
  );
  return rows[0];
}
