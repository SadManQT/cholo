import { pool } from '../config/db.js';

export async function insert({ driverId, payoutAccountId, amount, fee }, client) {
  const { rows } = await client.query(
    `INSERT INTO withdrawals (driver_id, payout_account_id, amount, fee)
     VALUES ($1, $2, $3, $4)
     RETURNING id, public_id AS "publicId", amount, fee, status, requested_at AS "requestedAt"`,
    [driverId, payoutAccountId, amount, fee],
  );

  return rows[0];
}

export async function listForDriver(driverId, { page, limit }, client = pool) {
  const offset = (page - 1) * limit;
  const { rows } = await client.query(
    `SELECT w.id, w.public_id AS "publicId", w.amount, w.fee, w.status,
            w.rejection_reason AS "rejectionReason", w.requested_at AS "requestedAt",
            w.processed_at AS "processedAt",
            pa.account_type AS "accountType", pa.account_no_masked AS "accountNoMasked",
            count(*) OVER()::int AS "totalCount"
     FROM withdrawals w
     JOIN driver_payout_accounts pa ON pa.id = w.payout_account_id
     WHERE w.driver_id = $1
     ORDER BY w.requested_at DESC
     LIMIT $2 OFFSET $3`,
    [driverId, limit, offset],
  );

  return rows;
}

// FOR UPDATE: the same "lock before check" shape as T3's wallet payment —
// approve/reject both need to be certain they're the only ones acting on
// this ONE withdrawal at this instant (two finance admins approving the
// same request concurrently would otherwise both pass a "still requested?"
// check and both try to move money).
export async function findByIdForUpdate(withdrawalId, client) {
  const { rows } = await client.query(
    `SELECT id, public_id AS "publicId", driver_id AS "driverId", payout_account_id AS "payoutAccountId",
            amount, fee, status
     FROM withdrawals
     WHERE id = $1
     FOR UPDATE`,
    [withdrawalId],
  );

  return rows[0];
}

export async function markApproved(withdrawalId, adminId, client) {
  const { rows } = await client.query(
    `UPDATE withdrawals SET status = 'approved', processed_by = $2, processed_at = now()
     WHERE id = $1
     RETURNING id, status, processed_at AS "processedAt"`,
    [withdrawalId, adminId],
  );

  return rows[0];
}

export async function markRejected(withdrawalId, adminId, reason, client) {
  const { rows } = await client.query(
    `UPDATE withdrawals
     SET status = 'rejected', processed_by = $2, processed_at = now(), rejection_reason = $3
     WHERE id = $1
     RETURNING id, status, processed_at AS "processedAt"`,
    [withdrawalId, adminId, reason],
  );

  return rows[0];
}

// doc 09 §9: GET /admin/withdrawals?status=requested — the finance queue.
export async function listQueue({ status, page, limit }, client = pool) {
  const offset = (page - 1) * limit;
  const { rows } = await client.query(
    `SELECT w.id, w.public_id AS "publicId", w.amount, w.fee, w.status,
            w.requested_at AS "requestedAt", w.processed_at AS "processedAt",
            u.full_name AS "driverName", u.phone AS "driverPhone",
            pa.account_type AS "accountType", pa.account_name AS "accountName",
            pa.account_no_masked AS "accountNoMasked", pa.bank_name AS "bankName",
            count(*) OVER()::int AS "totalCount"
     FROM withdrawals w
     JOIN users u ON u.id = w.driver_id
     JOIN driver_payout_accounts pa ON pa.id = w.payout_account_id
     WHERE ($1::text IS NULL OR w.status::text = $1)
     ORDER BY w.requested_at ASC
     LIMIT $2 OFFSET $3`,
    [status ?? null, limit, offset],
  );

  return rows;
}
