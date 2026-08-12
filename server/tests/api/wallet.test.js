import assert from 'node:assert/strict';
import { once } from 'node:events';
import { after, afterEach, before, beforeEach, mock, test } from 'node:test';

import app from '../../src/app.js';
import { pool } from '../../src/config/db.js';
import { logger } from '../../src/utils/logger.js';

let server;
let baseUrl;
let databaseClient;

before(async () => {
  databaseClient = await pool.connect();
  await databaseClient.query('BEGIN');

  mock.method(pool, 'query', (sql, values) => databaseClient.query(sql, values));
  mock.method(logger, 'info', () => {});

  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

beforeEach(async () => {
  await databaseClient.query('SAVEPOINT test_savepoint');
});

afterEach(async () => {
  await databaseClient.query('ROLLBACK TO SAVEPOINT test_savepoint');
});

after(async () => {
  server.close();
  await once(server, 'close');
  mock.restoreAll();
  await databaseClient.query('ROLLBACK');
  databaseClient.release();
  await pool.end();
});

function request(method, path, { body, accessToken } = {}) {
  const headers = {};
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (accessToken) headers.authorization = `Bearer ${accessToken}`;

  return fetch(`${baseUrl}/api/v1${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function otpSentTo(phone) {
  const call = logger.info.mock.calls.findLast((entry) => entry.arguments[1]?.phone === phone);
  return call?.arguments[1]?.message.match(/(\d{6})$/)?.[1];
}

let seed = 0;
// fn_create_user_wallet (schema.sql) fires on every users INSERT — going
// through real registration is what makes wallet_id resolvable at all,
// same as me.test.js's own registerVerifiedUser.
async function registerVerifiedUser() {
  seed += 1;
  const phone = `0173${String(seed).padStart(7, '0')}`;
  await request('POST', '/auth/register', { body: { fullName: 'Wallet Test User', phone, password: 'Password123' } });
  const otp = otpSentTo(phone);
  const response = await request('POST', '/auth/verify-otp', { body: { phone, otp, purpose: 'signup' } });
  const body = await response.json();

  // body.data.user.id is the public UUID (doc 10) — creditWallet needs the
  // internal BIGINT that wallets.user_id actually references.
  const { rows } = await databaseClient.query(`SELECT id FROM users WHERE phone = $1`, [phone]);

  return { accessToken: body.data.accessToken, userId: rows[0].id };
}

async function creditWallet(userId, amount, note) {
  await databaseClient.query(
    `INSERT INTO wallet_transactions (wallet_id, txn_type, direction, amount, reference_type, idempotency_key, note)
     SELECT id, 'topup', 'credit', $2, 'manual', $3, $4 FROM wallets WHERE user_id = $1`,
    [userId, amount, `test-credit-${userId}-${note}`, note],
  );
}

test('GET /wallet requires a bearer token', async () => {
  const response = await request('GET', '/wallet');
  assert.equal(response.status, 401);
  assert.equal((await response.json()).error.code, 'AUTH_REQUIRED');
});

test('GET /wallet returns a fresh user\'s zero-balance wallet', async () => {
  const { accessToken } = await registerVerifiedUser();

  const response = await request('GET', '/wallet', { accessToken });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.data.balance, '0.00');
  assert.equal(body.data.currency, 'BDT');
  assert.equal(body.data.status, 'active');
});

test('GET /wallet reflects the ledger after a credit — fn_apply_wallet_txn actually moved the cached balance', async () => {
  const { accessToken, userId } = await registerVerifiedUser();
  await creditWallet(userId, 250, 'first');

  const response = await request('GET', '/wallet', { accessToken });
  const body = await response.json();

  assert.equal(body.data.balance, '250.00');
});

test('GET /wallet/transactions requires a bearer token', async () => {
  const response = await request('GET', '/wallet/transactions');
  assert.equal(response.status, 401);
});

test('GET /wallet/transactions returns an empty ledger with correct meta for a fresh wallet', async () => {
  const { accessToken } = await registerVerifiedUser();

  const response = await request('GET', '/wallet/transactions', { accessToken });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(body.data, []);
  assert.deepEqual(body.meta, { page: 1, limit: 20, total: 0 });
});

test('GET /wallet/transactions lists entries newest-first with running balance_after', async () => {
  const { accessToken, userId } = await registerVerifiedUser();
  await creditWallet(userId, 100, 'one');
  await creditWallet(userId, 50, 'two');

  const response = await request('GET', '/wallet/transactions', { accessToken });
  const body = await response.json();

  assert.equal(body.meta.total, 2);
  assert.equal(body.data.length, 2);
  assert.equal(body.data[0].note, 'two'); // newest first
  assert.equal(body.data[0].balanceAfter, '150.00');
  assert.equal(body.data[1].note, 'one');
  assert.equal(body.data[1].balanceAfter, '100.00');
  assert.equal(body.data[0].direction, 'credit');
  assert.equal(body.data[0].txnType, 'topup');
});

test('GET /wallet/transactions paginates — page 2 excludes page 1\'s rows', async () => {
  const { accessToken, userId } = await registerVerifiedUser();
  for (let i = 0; i < 3; i += 1) await creditWallet(userId, 10, `txn-${i}`);

  const pageOne = await request('GET', '/wallet/transactions?limit=2&page=1', { accessToken });
  const pageOneBody = await pageOne.json();
  const pageTwo = await request('GET', '/wallet/transactions?limit=2&page=2', { accessToken });
  const pageTwoBody = await pageTwo.json();

  assert.equal(pageOneBody.data.length, 2);
  assert.equal(pageTwoBody.data.length, 1);
  assert.equal(pageOneBody.meta.total, 3);
  assert.equal(pageTwoBody.meta.total, 3);
  const pageOneIds = pageOneBody.data.map((txn) => txn.id);
  const pageTwoIds = pageTwoBody.data.map((txn) => txn.id);
  assert.equal(pageOneIds.some((id) => pageTwoIds.includes(id)), false);
});

test('GET /wallet/transactions only returns the caller\'s own ledger', async () => {
  const userA = await registerVerifiedUser();
  const userB = await registerVerifiedUser();
  await creditWallet(userA.userId, 500, 'a-only');

  const response = await request('GET', '/wallet/transactions', { accessToken: userB.accessToken });
  const body = await response.json();

  assert.equal(body.data.length, 0);
});
