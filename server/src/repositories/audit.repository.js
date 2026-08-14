import { pool } from '../config/db.js';

export async function insert(
  { actorId, actorRole, action, entityType, entityId, oldValue, newValue, ipAddress },
  client = pool,
) {
  const { rows } = await client.query(
    `INSERT INTO audit_logs
       (actor_id, actor_role, action, entity_type, entity_id,
        old_value, new_value, ip_address)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8)
     RETURNING id, created_at AS "createdAt"`,
    [
      actorId,
      actorRole,
      action,
      entityType,
      entityId,
      oldValue == null ? null : JSON.stringify(oldValue),
      newValue == null ? null : JSON.stringify(newValue),
      ipAddress ?? null,
    ],
  );

  return rows[0];
}

export async function list({ entityType, actorId, action, page, limit }, client = pool) {
  const offset = (page - 1) * limit;
  const { rows } = await client.query(
    `SELECT al.id, al.actor_id AS "actorId", u.full_name AS "actorName",
            al.actor_role AS "actorRole", al.action, al.entity_type AS "entityType",
            al.entity_id AS "entityId", al.old_value AS "oldValue",
            al.new_value AS "newValue", host(al.ip_address) AS "ipAddress",
            al.created_at AS "createdAt", count(*) OVER()::int AS "totalCount"
     FROM audit_logs al
     LEFT JOIN users u ON u.id = al.actor_id
     WHERE ($1::text IS NULL OR al.entity_type = $1)
       AND ($2::bigint IS NULL OR al.actor_id = $2)
       AND ($3::text IS NULL OR al.action ILIKE '%' || $3 || '%')
     ORDER BY al.created_at DESC, al.id DESC
     LIMIT $4 OFFSET $5`,
    [entityType ?? null, actorId ?? null, action ?? null, limit, offset],
  );
  return rows;
}
