import { pool } from '../config/db.js';

export async function getByUserId(userId, client = pool) {
  const { rows } = await client.query(
    `SELECT id, user_id AS "userId", balance, currency, status
     FROM wallets
     WHERE user_id = $1`,
    [userId],
  );

  return rows[0];
}

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
