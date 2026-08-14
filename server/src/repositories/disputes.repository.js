import { pool } from '../config/db.js';

export async function findParticipantTrip(tripCode, userId, client = pool) {
  const { rows } = await client.query(
    `SELECT id, trip_code AS "tripCode", passenger_id AS "passengerId", driver_id AS "driverId",
            total_fare AS "totalFare", payment_status AS "paymentStatus", status
     FROM trips WHERE trip_code = $1 AND (passenger_id = $2 OR driver_id = $2)`,
    [tripCode, userId],
  );
  return rows[0];
}

export async function hasOpenDispute(tripId, userId, client = pool) {
  const { rowCount } = await client.query(
    `SELECT 1 FROM disputes WHERE trip_id = $1 AND raised_by = $2 AND status IN ('open','under_review') LIMIT 1`,
    [tripId, userId],
  );
  return rowCount > 0;
}

export async function insert({ tripId, raisedBy, disputeType, description, disputedAmount }, client = pool) {
  const { rows } = await client.query(
    `INSERT INTO disputes (trip_id, raised_by, dispute_type, description, disputed_amount)
     VALUES ($1,$2,$3,$4,$5)
     RETURNING id, dispute_no AS "disputeNo", dispute_type AS "disputeType", description,
               disputed_amount AS "disputedAmount", status, created_at AS "createdAt"`,
    [tripId, raisedBy, disputeType, description, disputedAmount ?? null],
  );
  return rows[0];
}

export async function listForUser(userId, { page, limit }, client = pool) {
  const offset = (page - 1) * limit;
  const { rows } = await client.query(
    `SELECT d.id, d.dispute_no AS "disputeNo", t.trip_code AS "tripCode",
            d.dispute_type AS "disputeType", d.description, d.disputed_amount AS "disputedAmount",
            d.status, d.resolution_note AS "resolutionNote", d.created_at AS "createdAt",
            d.resolved_at AS "resolvedAt", count(*) OVER()::int AS "totalCount"
     FROM disputes d JOIN trips t ON t.id = d.trip_id
     WHERE d.raised_by = $1 ORDER BY d.created_at DESC, d.id DESC LIMIT $2 OFFSET $3`,
    [userId, limit, offset],
  );
  return rows;
}

export async function listQueue({ status, page, limit }, client = pool) {
  const offset = (page - 1) * limit;
  const { rows } = await client.query(
    `SELECT d.id, d.dispute_no AS "disputeNo", t.trip_code AS "tripCode",
            d.dispute_type AS "disputeType", d.description, d.disputed_amount AS "disputedAmount",
            d.status, d.resolution_note AS "resolutionNote", d.created_at AS "createdAt",
            d.resolved_at AS "resolvedAt", u.full_name AS "raisedByName", u.phone AS "raisedByPhone",
            t.total_fare AS "tripTotal", t.payment_status AS "paymentStatus",
            count(*) OVER()::int AS "totalCount"
     FROM disputes d JOIN trips t ON t.id = d.trip_id JOIN users u ON u.id = d.raised_by
     WHERE ($1::text IS NULL OR d.status::text = $1)
     ORDER BY CASE WHEN d.status IN ('open','under_review') THEN 0 ELSE 1 END, d.created_at ASC
     LIMIT $2 OFFSET $3`,
    [status ?? null, limit, offset],
  );
  return rows;
}

export async function findForUpdate(disputeId, client) {
  const { rows } = await client.query(
    `SELECT d.id, d.dispute_no AS "disputeNo", d.trip_id AS "tripId", d.raised_by AS "raisedBy",
            d.status, d.disputed_amount AS "disputedAmount", t.passenger_id AS "passengerId",
            t.total_fare AS "tripTotal", t.payment_status AS "paymentStatus"
     FROM disputes d JOIN trips t ON t.id = d.trip_id WHERE d.id = $1 FOR UPDATE OF d, t`,
    [disputeId],
  );
  return rows[0];
}

export async function findSucceededPaymentForTrip(tripId, client) {
  const { rows } = await client.query(
    `SELECT id, amount, status FROM payments
     WHERE trip_id = $1 AND purpose = 'trip' AND status = 'succeeded'
     ORDER BY completed_at DESC LIMIT 1 FOR UPDATE`,
    [tripId],
  );
  return rows[0];
}

export async function markPaymentRefunded(paymentId, amount, client) {
  await client.query(
    `UPDATE payments SET status = 'refunded', refund_amount = $2, refunded_at = now() WHERE id = $1`,
    [paymentId, amount],
  );
}

export async function markTripRefunded(tripId, client) {
  await client.query(`UPDATE trips SET payment_status = 'refunded' WHERE id = $1`, [tripId]);
}

export async function resolve(disputeId, { status, resolutionNote, adminId, refundPaymentId }, client) {
  const { rows } = await client.query(
    `UPDATE disputes SET status = $2, resolution_note = $3, resolved_by = $4,
       refund_payment_id = $5, resolved_at = now()
     WHERE id = $1
     RETURNING id, dispute_no AS "disputeNo", status, resolution_note AS "resolutionNote",
               refund_payment_id AS "refundPaymentId", resolved_at AS "resolvedAt"`,
    [disputeId, status, resolutionNote, adminId, refundPaymentId ?? null],
  );
  return rows[0];
}
