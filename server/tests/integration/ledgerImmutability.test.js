import assert from 'node:assert/strict';
import { after, test } from 'node:test';

import { pool } from '../../src/config/db.js';


async function createFundedUser(balance) {
  const phone = `019${String(Date.now() % 100_000_000).padStart(8, '0')}`;
  const { rows } = await pool.query(
    `INSERT INTO users (full_name, phone, password_hash, phone_verified_at)
     VALUES ('Ledger Immutability Test User', $1, 'test-hash', now()) RETURNING id`,
    [phone],
  );
  const userId = rows[0].id;
  const { rows: txnRows } = await pool.query(
    `INSERT INTO wallet_transactions (wallet_id, txn_type, direction, amount, reference_type, idempotency_key)
     SELECT id, 'topup', 'credit', $2, 'manual', $3 FROM wallets WHERE user_id = $1
     RETURNING id`,
    [userId, balance, `ledger-immutability-${userId}`],
  );
  return txnRows[0].id;
}

after(async () => {
  await pool.end();
});

test('UPDATE on wallet_transactions is rejected by fn_block_mutation, not silently allowed', async () => {
  const txnId = await createFundedUser(100);

  await assert.rejects(
    pool.query(`UPDATE wallet_transactions SET amount = 999 WHERE id = $1`, [txnId]),
    (error) => {
      assert.equal(error.code, 'P0001');
      assert.match(error.message, /wallet_transactions is append-only/);
      return true;
    },
  );

  const { rows } = await pool.query(`SELECT amount FROM wallet_transactions WHERE id = $1`, [txnId]);
  assert.equal(Number(rows[0].amount), 100);
});

test('DELETE on wallet_transactions is rejected by the same trigger', async () => {
  const txnId = await createFundedUser(50);

  await assert.rejects(
    pool.query(`DELETE FROM wallet_transactions WHERE id = $1`, [txnId]),
    (error) => {
      assert.equal(error.code, 'P0001');
      assert.match(error.message, /wallet_transactions is append-only/);
      return true;
    },
  );

  const { rows } = await pool.query(`SELECT id FROM wallet_transactions WHERE id = $1`, [txnId]);
  assert.equal(rows.length, 1);
});
