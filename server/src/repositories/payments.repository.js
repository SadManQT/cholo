import { pool } from '../config/db.js';

// payments — every money-in attempt (schema.sql). completed_at is derived
// from status rather than taken as a param: a payment is "complete" iff
// it's 'succeeded', by definition, so there is no separate value for a
// caller to get wrong.
export async function insertPayment(
  { purpose, tripId, payerId, methodType, gateway, amount, status },
  client = pool,
) {
  const { rows } = await client.query(
    // $7 and $8 are the same value, passed twice — reusing one parameter
    // number across two different inferred contexts (an enum column vs. a
    // text comparison) is what actually trips Postgres's "inconsistent
    // types deduced for parameter" error, not the value itself.
    `INSERT INTO payments (purpose, trip_id, payer_id, method_type, gateway, amount, status, completed_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, CASE WHEN $8 = 'succeeded' THEN now() ELSE NULL END)
     RETURNING id, public_id AS "publicId", trip_id AS "tripId", payer_id AS "payerId",
               purpose, method_type AS "methodType", amount, status, completed_at AS "completedAt"`,
    [purpose, tripId ?? null, payerId, methodType, gateway, amount, status, status],
  );

  return rows[0];
}

// trips.service.js's loadPayableTrip guard against opening a second gateway
// session on the same trip: called inside the same transaction that already
// holds the trip row's FOR UPDATE lock, so a second /pay call for the same
// trip either blocks until the first commits (and then sees this row) or
// runs after it — never races it.
export async function findActiveForTrip(tripId, client) {
  const { rows } = await client.query(
    `SELECT id FROM payments
     WHERE trip_id = $1 AND purpose = 'trip' AND status = 'initiated'
     LIMIT 1`,
    [tripId],
  );

  return rows[0];
}

export async function findByPublicId(publicId, client = pool) {
  const { rows } = await client.query(
    `SELECT id, public_id AS "publicId", purpose, trip_id AS "tripId", payer_id AS "payerId",
            method_type AS "methodType", gateway, amount, status,
            initiated_at AS "initiatedAt", completed_at AS "completedAt"
     FROM payments
     WHERE public_id = $1`,
    [publicId],
  );

  return rows[0];
}

// Webhook idempotency (doc 08-09-10 §10.4): lock the ONE payment row the
// incoming tran_id names before deciding whether there's anything left to
// do — the same "lock, then check, then act" shape T1/T3 already use, so
// two webhook deliveries for the same payment landing at the same instant
// serialize instead of racing each other into a double-settle.
export async function findByPublicIdForUpdate(publicId, client) {
  const { rows } = await client.query(
    `SELECT id, public_id AS "publicId", purpose, trip_id AS "tripId", payer_id AS "payerId",
            method_type AS "methodType", gateway, amount, status
     FROM payments
     WHERE public_id = $1
     FOR UPDATE`,
    [publicId],
  );

  return rows[0];
}

export async function markSucceeded(paymentId, gatewayTxnId, client) {
  const { rows } = await client.query(
    `UPDATE payments SET status = 'succeeded', gateway_txn_id = $2, completed_at = now()
     WHERE id = $1
     RETURNING id, public_id AS "publicId", status, completed_at AS "completedAt"`,
    [paymentId, gatewayTxnId],
  );

  return rows[0];
}
