import { pool } from '../config/db.js';

// balance/amount deliberately NOT cast to float8 — same reasoning as
// trips.repository.js's completeTrip: these flow straight into an API
// response as money, and NUMERIC's default driver representation is
// already the fixed 2-decimal string ("150.00") a client should display,
// not a float a client would have to re-format.
export async function getByUserId(userId, client = pool) {
  const { rows } = await client.query(
    `SELECT id, user_id AS "userId", balance, currency, status
     FROM wallets
     WHERE user_id = $1`,
    [userId],
  );

  return rows[0];
}

// T3 (doc 02-03 §8): "the FOR UPDATE inside fn_apply_wallet_txn prevents
// two simultaneous spends from both passing a balance check" — but only
// for the ROW the debit INSERT itself locks. A caller that wants to
// REJECT an insufficient-funds spend (rather than just letting the
// balance go negative, which is correct for T2's commission debit but not
// for a passenger's own spend) has to make its own check participate in
// that same lock, by taking it first. Postgres row locks are per-
// transaction and re-entrant: this SELECT ... FOR UPDATE and the trigger's
// own later SELECT ... FOR UPDATE on the same row, same transaction, don't
// block each other — but a SECOND transaction calling this function on
// the same wallet genuinely blocks here until the first commits, then
// reads the POST-debit balance, not a stale pre-debit one.
export async function getByUserIdForUpdate(userId, client) {
  const { rows } = await client.query(
    `SELECT id, user_id AS "userId", balance, currency, status
     FROM wallets
     WHERE user_id = $1
     FOR UPDATE`,
    [userId],
  );

  return rows[0];
}

export async function listTransactions(walletId, { page, limit }, client = pool) {
  const offset = (page - 1) * limit;
  const { rows } = await client.query(
    `SELECT id, txn_type AS "txnType", direction, amount,
            balance_after AS "balanceAfter", reference_type AS "referenceType",
            reference_id AS "referenceId", note, created_at AS "createdAt",
            count(*) OVER()::int AS "totalCount"
     FROM wallet_transactions
     WHERE wallet_id = $1
     ORDER BY created_at DESC, id DESC
     LIMIT $2 OFFSET $3`,
    [walletId, limit, offset],
  );

  return rows;
}

// The append-only ledger insert — trg_apply_wallet_txn (schema.sql, BEFORE
// INSERT) locks the wallet row, stamps balance_after, and updates the
// cached wallets.balance. This function is deliberately generic (not
// "debitCommission") — every wallet-affecting feature (T2's commission
// debit here, T3's wallet payment, topups, withdrawals later) inserts
// through this same one path, never touches wallets.balance directly.
export async function insertTransaction(
  { walletId, txnType, direction, amount, referenceType, referenceId, idempotencyKey, note },
  client,
) {
  const { rows } = await client.query(
    `INSERT INTO wallet_transactions
       (wallet_id, txn_type, direction, amount, reference_type, reference_id, idempotency_key, note)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, balance_after AS "balanceAfter", created_at AS "createdAt"`,
    [walletId, txnType, direction, amount, referenceType, referenceId ?? null, idempotencyKey, note ?? null],
  );

  return rows[0];
}
