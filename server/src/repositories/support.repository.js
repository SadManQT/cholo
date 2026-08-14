import { pool } from '../config/db.js';

export async function findParticipantTripId(tripCode, userId, client = pool) {
  const { rows } = await client.query(
    `SELECT id FROM trips WHERE trip_code = $1 AND (passenger_id = $2 OR driver_id = $2)`,
    [tripCode, userId],
  );
  return rows[0]?.id;
}

export async function insertTicket({ userId, tripId, category, subject, description }, client) {
  const { rows } = await client.query(
    `INSERT INTO support_tickets (user_id, trip_id, category, subject, description)
     VALUES ($1,$2,$3,$4,$5)
     RETURNING id, ticket_no AS "ticketNo", category, subject, description, status, priority,
               created_at AS "createdAt"`,
    [userId, tripId ?? null, category, subject, description],
  );
  return rows[0];
}

export async function insertMessage({ ticketId, senderId, body, attachmentUrl, isInternalNote = false }, client = pool) {
  const { rows } = await client.query(
    `INSERT INTO support_ticket_messages (ticket_id, sender_id, body, attachment_url, is_internal_note)
     VALUES ($1,$2,$3,$4,$5)
     RETURNING id, body, attachment_url AS "attachmentUrl", is_internal_note AS "isInternalNote",
               sent_at AS "sentAt"`,
    [ticketId, senderId, body, attachmentUrl ?? null, isInternalNote],
  );
  return rows[0];
}

export async function listForUser(userId, { page, limit }, client = pool) {
  const offset = (page - 1) * limit;
  const { rows } = await client.query(
    `SELECT st.id, st.ticket_no AS "ticketNo", st.category, st.subject, st.status, st.priority,
            t.trip_code AS "tripCode", st.created_at AS "createdAt", st.resolved_at AS "resolvedAt",
            count(*) OVER()::int AS "totalCount"
     FROM support_tickets st
     LEFT JOIN trips t ON t.id = st.trip_id
     WHERE st.user_id = $1
     ORDER BY st.created_at DESC, st.id DESC
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset],
  );
  return rows;
}

export async function findOwned(ticketId, userId, client = pool) {
  const { rows } = await client.query(
    `SELECT st.id, st.ticket_no AS "ticketNo", st.user_id AS "userId", st.category,
            st.subject, st.description, st.status, st.priority, t.trip_code AS "tripCode",
            st.created_at AS "createdAt", st.resolved_at AS "resolvedAt", st.closed_at AS "closedAt"
     FROM support_tickets st LEFT JOIN trips t ON t.id = st.trip_id
     WHERE st.id = $1 AND st.user_id = $2`,
    [ticketId, userId],
  );
  return rows[0];
}

export async function findById(ticketId, client = pool, forUpdate = false) {
  const { rows } = await client.query(
    `SELECT st.id, st.ticket_no AS "ticketNo", st.user_id AS "userId", u.full_name AS "userName",
            u.phone AS "userPhone", st.category, st.subject, st.description, st.status, st.priority,
            st.assigned_to AS "assignedTo", t.trip_code AS "tripCode", st.created_at AS "createdAt",
            st.resolved_at AS "resolvedAt", st.closed_at AS "closedAt"
     FROM support_tickets st JOIN users u ON u.id = st.user_id LEFT JOIN trips t ON t.id = st.trip_id
     WHERE st.id = $1 ${forUpdate ? 'FOR UPDATE OF st' : ''}`,
    [ticketId],
  );
  return rows[0];
}

export async function listMessages(ticketId, includeInternal, client = pool) {
  const { rows } = await client.query(
    `SELECT stm.id, u.public_id AS "senderId", u.full_name AS "senderName", stm.body,
            stm.attachment_url AS "attachmentUrl", stm.is_internal_note AS "isInternalNote",
            stm.sent_at AS "sentAt"
     FROM support_ticket_messages stm JOIN users u ON u.id = stm.sender_id
     WHERE stm.ticket_id = $1 AND ($2::boolean OR NOT stm.is_internal_note)
     ORDER BY stm.sent_at, stm.id`,
    [ticketId, includeInternal],
  );
  return rows;
}

export async function listQueue({ status, priority, page, limit }, client = pool) {
  const offset = (page - 1) * limit;
  const { rows } = await client.query(
    `SELECT st.id, st.ticket_no AS "ticketNo", st.category, st.subject, st.status, st.priority,
            st.created_at AS "createdAt", u.full_name AS "userName", u.phone AS "userPhone",
            au.full_name AS "assignedToName", t.trip_code AS "tripCode", count(*) OVER()::int AS "totalCount"
     FROM support_tickets st JOIN users u ON u.id = st.user_id
     LEFT JOIN users au ON au.id = st.assigned_to LEFT JOIN trips t ON t.id = st.trip_id
     WHERE ($1::text IS NULL OR st.status::text = $1) AND ($2::text IS NULL OR st.priority::text = $2)
     ORDER BY CASE st.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
              st.created_at ASC
     LIMIT $3 OFFSET $4`,
    [status ?? null, priority ?? null, limit, offset],
  );
  return rows;
}

export async function updateTicket(ticketId, input, adminId, client) {
  const { rows } = await client.query(
    `UPDATE support_tickets SET
       status = COALESCE($2, status), priority = COALESCE($3, priority),
       assigned_to = CASE WHEN $4::boolean THEN $5 ELSE assigned_to END,
       resolved_at = CASE WHEN $2 = 'resolved' THEN now() WHEN $2 IS NOT NULL THEN NULL ELSE resolved_at END,
       closed_at = CASE WHEN $2 = 'closed' THEN now() WHEN $2 IS NOT NULL THEN NULL ELSE closed_at END
     WHERE id = $1
     RETURNING id, ticket_no AS "ticketNo", status, priority, assigned_to AS "assignedTo",
               resolved_at AS "resolvedAt", closed_at AS "closedAt"`,
    [ticketId, input.status ?? null, input.priority ?? null, input.assignedToMe ?? false, adminId],
  );
  return rows[0];
}
