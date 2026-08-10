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
