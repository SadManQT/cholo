import { pool } from '../config/db.js';

export async function insertPayment(
  { purpose, tripId, payerId, methodType, gateway, amount, status },
  client = pool,
) {
  const { rows } = await client.query(
    `INSERT INTO payments (purpose, trip_id, payer_id, method_type, gateway, amount, status, completed_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, CASE WHEN $8 = 'succeeded' THEN now() ELSE NULL END)
     RETURNING id, public_id AS "publicId", trip_id AS "tripId", payer_id AS "payerId",
               purpose, method_type AS "methodType", amount, status, completed_at AS "completedAt"`,
    [purpose, tripId ?? null, payerId, methodType, gateway, amount, status, status],
  );

  return rows[0];
}

export async function findActiveForTrip(tripId, client) {
  const { rows } = await client.query(
    `SELECT id FROM payments
     WHERE trip_id = $1 AND purpose = 'trip' AND status = 'initiated'
       -- an attempt abandoned at the gateway must not block paying forever
       AND initiated_at > now() - interval '30 minutes'
     LIMIT 1`,
    [tripId],
  );

  return rows[0];
}

export async function findByPublicId(publicId, client = pool) {
  const { rows } = await client.query(
    `SELECT id, public_id AS "publicId", purpose, trip_id AS "tripId", payer_id AS "payerId",
            method_type AS "methodType", gateway, amount, status,
            initiated_at AS "initiatedAt", completed_at AS "completedAt",
            (SELECT trip_code FROM trips WHERE trips.id = payments.trip_id) AS "tripCode"
     FROM payments
     WHERE public_id = $1`,
    [publicId],
  );

  return rows[0];
}

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

export async function markFailedIfInitiated(publicId, client = pool) {
  await client.query(
    `UPDATE payments SET status = 'failed', completed_at = now() WHERE public_id = $1 AND status = 'initiated'`,
    [publicId],
  );
}
