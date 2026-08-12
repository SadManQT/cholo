import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';

import { pool } from '../../src/config/db.js';
import * as walletRepo from '../../src/repositories/wallet.repository.js';

// The HTTP-level "two concurrent /pay requests" test in trips.test.js is
// good business-logic coverage, but proved to be an UNRELIABLE proof of
// the lock itself: against a fast local Postgres, one request's whole
// transaction (select, check, insert, insert, commit) routinely finishes
// before the second's balance check even runs — no real overlap, so it
// passes whether or not getByUserIdForUpdate's FOR UPDATE is even there
// (verified by temporarily removing it: the HTTP test still passed 20/20).
//
// This file proves the actual DB-level guarantee doc 02-03 §8 describes,
// by controlling the interleaving directly with two raw clients instead
// of hoping two HTTP requests happen to overlap: open transaction A,
// prove transaction B's SELECT ... FOR UPDATE genuinely blocks while A
// holds the row, prove B only unblocks after A commits, and prove B then
// reads A's POST-debit balance — never a stale pre-debit one.

async function createFundedUser(balance) {
  const phone = `019${String(Date.now() % 100_000_000).padStart(8, '0')}`;
  const { rows } = await pool.query(
    `INSERT INTO users (full_name, phone, password_hash, phone_verified_at)
     VALUES ('Wallet Lock Test User', $1, 'test-hash', now()) RETURNING id`,
    [phone],
  );
  const userId = rows[0].id;
  if (balance > 0) {
    await pool.query(
      `INSERT INTO wallet_transactions (wallet_id, txn_type, direction, amount, reference_type, idempotency_key)
       SELECT id, 'topup', 'credit', $2, 'manual', $3 FROM wallets WHERE user_id = $1`,
      [userId, balance, `walletlock-fund-${userId}`],
    );
  }
  return userId;
}

function pending(promise) {
  const SENTINEL = Symbol('pending');
  return Promise.race([promise, new Promise((resolve) => setTimeout(() => resolve(SENTINEL), 150))])
    .then((value) => value === SENTINEL ? 'still-pending' : 'resolved');
}

after(async () => {
  await pool.end();
});

test('getByUserIdForUpdate: a second transaction genuinely BLOCKS on the same wallet row until the first commits', async () => {
  const userId = await createFundedUser(100);
  const clientA = await pool.connect();
  const clientB = await pool.connect();

  try {
    await clientA.query('BEGIN');
    await clientB.query('BEGIN');

    const walletA = await walletRepo.getByUserIdForUpdate(userId, clientA);
    assert.equal(Number(walletA.balance), 100);

    // Don't await yet — this is the whole point: prove it does NOT
    // resolve while A still holds the row's lock.
    const bLockPromise = walletRepo.getByUserIdForUpdate(userId, clientB);
    assert.equal(await pending(bLockPromise), 'still-pending', 'B must block while A holds the row');

    await clientA.query('COMMIT');

    // Now that A released the lock, B's long-pending query must resolve.
    const walletB = await bLockPromise;
    assert.equal(Number(walletB.balance), 100); // A never wrote anything, just read+committed
  } finally {
    await clientA.query('ROLLBACK').catch(() => {});
    await clientB.query('ROLLBACK').catch(() => {});
    clientA.release();
    clientB.release();
  }
});

test('getByUserIdForUpdate + insertTransaction: B unblocks into the POST-debit balance, never a stale pre-debit one — the actual double-spend guard', async () => {
  const userId = await createFundedUser(100);
  const clientA = await pool.connect();
  const clientB = await pool.connect();

  try {
    await clientA.query('BEGIN');
    await clientB.query('BEGIN');

    // A: lock the row, see 100, decide (correctly) that an 80 debit fits.
    const walletA = await walletRepo.getByUserIdForUpdate(userId, clientA);
    assert.equal(Number(walletA.balance), 100);

    // B starts its own check WHILE A still holds the lock — this is the
    // exact double-spend shape: two spends both wanting to pass a check
    // against the same starting balance.
    const bLockPromise = walletRepo.getByUserIdForUpdate(userId, clientB);
    assert.equal(await pending(bLockPromise), 'still-pending');

    // A commits its 80 debit — balance is now genuinely 20.
    await walletRepo.insertTransaction({
      walletId: walletA.id,
      txnType: 'trip_payment',
      direction: 'debit',
      amount: 80,
      referenceType: 'manual',
      idempotencyKey: `walletlock-debit-a-${userId}`,
    }, clientA);
    await clientA.query('COMMIT');

    // B unblocks — it must see 20 (A's real post-debit balance), which
    // correctly fails an 80 check, not the stale 100 both could have
    // passed if B had read before A committed.
    const walletB = await bLockPromise;
    assert.equal(Number(walletB.balance), 20);
    assert.ok(Number(walletB.balance) < 80, 'B must now correctly see insufficient funds for its own 80 debit');

    await clientB.query('ROLLBACK'); // B backs off, as payTrip's service code would on this check failing
  } finally {
    await clientA.query('ROLLBACK').catch(() => {});
    await clientB.query('ROLLBACK').catch(() => {});
    clientA.release();
    clientB.release();
  }

  const { rows } = await pool.query(`SELECT balance FROM wallets WHERE user_id = $1`, [userId]);
  assert.equal(Number(rows[0].balance), 20, 'exactly one debit landed — B rolled back, never double-spent');
});
