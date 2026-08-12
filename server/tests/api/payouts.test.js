import assert from 'node:assert/strict';
import { randomInt } from 'node:crypto';
import { once } from 'node:events';
import { after, before, mock, test } from 'node:test';

import app from '../../src/app.js';
import { pool } from '../../src/config/db.js';
import { env } from '../../src/config/env.js';
import { signAccessToken } from '../../src/utils/tokens.js';

// Same reasoning as trips.test.js/payments.test.js: real pool, no
// savepoint mocking, no cleanup — trip fixtures are permanently
// undeletable (append-only trigger). fetch mocked for OSRM only (no
// gateway calls in this file — withdrawals settle from the wallet, no
// SSLCommerz session involved).
let server;
let baseUrl;
let seed = randomInt(10_000_000, 100_000_000);
const realFetch = globalThis.fetch;

before(async () => {
  mock.method(globalThis, 'fetch', async (url, options) => {
    if (typeof url === 'string' && url.startsWith(env.OSRM_BASE_URL)) {
      return { ok: true, json: async () => ({ code: 'Ok', routes: [{ distance: 10340, duration: 660 }] }) };
    }
    return realFetch(url, options);
  });
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  server.close();
  await once(server, 'close');
  mock.restoreAll();
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

async function createPassenger() {
  seed += 1;
  const phone = `015${String(seed).padStart(8, '0').slice(-8)}`;
  const { rows } = await pool.query(
    `INSERT INTO users (full_name, phone, password_hash, phone_verified_at)
     VALUES ('Payouts Test Passenger', $1, 'test-hash', now()) RETURNING id`,
    [phone],
  );
  const userId = rows[0].id;
  await pool.query(`INSERT INTO user_roles (user_id, role_id) SELECT $1, id FROM roles WHERE name = 'PASSENGER'`, [userId]);
  await pool.query(`INSERT INTO passenger_profiles (user_id) VALUES ($1)`, [userId]);

  return { userId, accessToken: signAccessToken({ userId, roles: ['PASSENGER'], sessionId: userId }) };
}

async function createOnlineDriver(t, { lat, lng }) {
  seed += 1;
  const phone = `018${String(seed).padStart(8, '0').slice(-8)}`;
  const { rows } = await pool.query(
    `INSERT INTO users (full_name, phone, password_hash, phone_verified_at)
     VALUES ('Payouts Test Driver', $1, 'test-hash', now()) RETURNING id`,
    [phone],
  );
  const userId = rows[0].id;
  await pool.query(`INSERT INTO user_roles (user_id, role_id) SELECT $1, id FROM roles WHERE name = 'DRIVER'`, [userId]);
  await pool.query(
    `INSERT INTO driver_profiles (user_id, nid_number, license_number, license_expiry, verification_status)
     VALUES ($1, $2, $3, '2035-12-31', 'approved')`,
    [userId, String(userId).padStart(10, '0'), `DL-PO-${userId}`],
  );
  const { rows: vehicleRows } = await pool.query(
    `INSERT INTO vehicles (driver_id, category_id, registration_no, verification_status, is_active)
     SELECT $1, id, $2, 'approved', true FROM vehicle_categories WHERE name = 'Car' RETURNING id`,
    [userId, `DHAKA-PO-${userId}`],
  );
  await pool.query(`UPDATE driver_profiles SET active_vehicle_id = $2 WHERE user_id = $1`, [userId, vehicleRows[0].id]);
  await pool.query(
    `UPDATE driver_availability SET status = 'online', current_lat = $2, current_lng = $3 WHERE driver_id = $1`,
    [userId, lat, lng],
  );
  t.after(async () => {
    await pool.query(`UPDATE driver_availability SET status = 'offline' WHERE driver_id = $1`, [userId]);
  });

  return { userId, accessToken: signAccessToken({ userId, roles: ['DRIVER'], sessionId: userId }) };
}

async function createAdmin(accessLevel) {
  seed += 1;
  const phone = `014${String(seed).padStart(8, '0').slice(-8)}`;
  const { rows } = await pool.query(
    `INSERT INTO users (full_name, phone, password_hash, phone_verified_at)
     VALUES ('Payouts Test Admin', $1, 'test-hash', now()) RETURNING id`,
    [phone],
  );
  const userId = rows[0].id;
  await pool.query(`INSERT INTO user_roles (user_id, role_id) SELECT $1, id FROM roles WHERE name = 'ADMIN'`, [userId]);
  await pool.query(
    `INSERT INTO admin_profiles (user_id, designation, access_level) VALUES ($1, 'Test Admin', $2)`,
    [userId, accessLevel],
  );

  return { userId, accessToken: signAccessToken({ userId, roles: ['ADMIN'], sessionId: userId }) };
}

// A fourth area of Dhaka, away from every other test file's coordinates
// (same cross-file collision reasoning established in trips.test.js).
const PICKUP = { lat: 23.8103, lng: 90.4125 }; // Dhaka geographic center
const DROPOFF = { lat: 23.8223, lng: 90.3654 }; // Mirpur

async function createAssignedTrip(t) {
  const passenger = await createPassenger();
  const driver = await createOnlineDriver(t, { lat: PICKUP.lat, lng: PICKUP.lng });

  const { rows: cityRows } = await pool.query(`SELECT id FROM cities WHERE name = 'Dhaka'`);
  const booked = await request('POST', '/ride-requests', {
    accessToken: passenger.accessToken,
    body: { cityId: cityRows[0].id, categoryId: 3, pickup: PICKUP, dropoff: DROPOFF, paymentIntent: 'cash' },
  });
  assert.equal(booked.status, 201);

  const offersResponse = await request('GET', '/driver/offers', { accessToken: driver.accessToken });
  const [offer] = (await offersResponse.json()).data;
  const accepted = await request('POST', `/driver/offers/${offer.id}/respond`, {
    accessToken: driver.accessToken,
    body: { response: 'accepted' },
  });
  assert.equal(accepted.status, 200);
  const tripCode = (await accepted.json()).data.trip.publicCode;

  return { tripCode, passenger, driver };
}

async function creditWallet(userId, amount) {
  seed += 1;
  await pool.query(
    `INSERT INTO wallet_transactions (wallet_id, txn_type, direction, amount, reference_type, idempotency_key)
     SELECT id, 'topup', 'credit', $2, 'manual', $3 FROM wallets WHERE user_id = $1`,
    [userId, amount, `payouts-test-credit-${userId}-${seed}`],
  );
}

// Cash trips settle instantly (T2) with a COMMISSION DEBIT, not a
// credit — no good for withdrawal tests, which need real WITHDRAWABLE
// (credit) balance. A wallet-paid trip credits the DRIVER's wallet with
// net_earning instead (platformCollected: true) — this drives that whole
// path through the real app rather than hand-crafting a wallet_
// transactions row, so it's also incidental coverage of T3 + settlement.
async function createDriverWithBalance(t) {
  const passenger = await createPassenger();
  const driver = await createOnlineDriver(t, { lat: PICKUP.lat, lng: PICKUP.lng });
  const { rows: cityRows } = await pool.query(`SELECT id FROM cities WHERE name = 'Dhaka'`);
  const booked = await request('POST', '/ride-requests', {
    accessToken: passenger.accessToken,
    body: { cityId: cityRows[0].id, categoryId: 3, pickup: PICKUP, dropoff: DROPOFF, paymentIntent: 'wallet' },
  });
  assert.equal(booked.status, 201);
  const [offer] = (await (await request('GET', '/driver/offers', { accessToken: driver.accessToken })).json()).data;
  const accepted = await request('POST', `/driver/offers/${offer.id}/respond`, {
    accessToken: driver.accessToken, body: { response: 'accepted' },
  });
  const tripCode = (await accepted.json()).data.trip.publicCode;

  await request('POST', `/trips/${tripCode}/arrived`, { accessToken: driver.accessToken });
  await request('POST', `/trips/${tripCode}/start`, { accessToken: driver.accessToken });
  const completed = await request('POST', `/trips/${tripCode}/complete`, { accessToken: driver.accessToken, body: {} });
  const totalFare = Number((await completed.json()).data.fare.total);

  await creditWallet(passenger.userId, totalFare + 100);
  await request('POST', `/trips/${tripCode}/pay`, { accessToken: passenger.accessToken, body: { method: 'wallet' } });

  const { rows } = await pool.query(`SELECT balance FROM wallets WHERE user_id = $1`, [driver.userId]);
  return { driver, tripCode, walletBalance: Number(rows[0].balance) };
}

async function createPayoutAccount(driverAccessToken, overrides = {}) {
  const response = await request('POST', '/driver/payout-accounts', {
    accessToken: driverAccessToken,
    body: { accountType: 'bkash', accountName: 'Test Driver', accountNo: '01911223344', ...overrides },
  });
  assert.equal(response.status, 201);
  return (await response.json()).data;
}

// ---------------------------------------------------------------------
// GET /driver/earnings
// ---------------------------------------------------------------------

test('GET /driver/earnings returns daily aggregates (v_driver_daily_earnings) and per-trip rows for a completed trip', async (t) => {
  const { tripCode, driver } = await createAssignedTrip(t);
  await request('POST', `/trips/${tripCode}/arrived`, { accessToken: driver.accessToken });
  await request('POST', `/trips/${tripCode}/start`, { accessToken: driver.accessToken });
  const completed = await request('POST', `/trips/${tripCode}/complete`, { accessToken: driver.accessToken, body: {} });
  const totalFare = Number((await completed.json()).data.fare.total);

  const response = await request('GET', '/driver/earnings', { accessToken: driver.accessToken });
  assert.equal(response.status, 200);
  const { daily, trips } = (await response.json()).data;

  const today = new Date().toISOString().slice(0, 10);
  const todayRow = daily.find((row) => row.earningDate === today);
  assert.ok(todayRow, 'today should have a daily aggregate row');
  assert.ok(todayRow.tripsCount >= 1);

  const tripRow = trips.find((row) => row.tripCode === tripCode);
  assert.ok(tripRow, 'the completed trip should appear in the per-trip rows');
  assert.equal(Number(tripRow.grossFare), totalFare);
  assert.equal(Number(tripRow.netEarning), Number(tripRow.grossFare) - Number(tripRow.commissionAmount));
});

test('GET /driver/earnings defaults to a trailing 30-day window with no query params', async (t) => {
  const driver = await createOnlineDriver(t, { lat: PICKUP.lat, lng: PICKUP.lng });
  const response = await request('GET', '/driver/earnings', { accessToken: driver.accessToken });
  assert.equal(response.status, 200);
  const { daily, trips } = (await response.json()).data;
  assert.deepEqual(daily, []);
  assert.deepEqual(trips, []);
});

test('GET /driver/earnings requires a bearer token', async () => {
  const response = await request('GET', '/driver/earnings');
  assert.equal(response.status, 401);
});

// ---------------------------------------------------------------------
// Payout accounts
// ---------------------------------------------------------------------

test('POST /driver/payout-accounts masks the account number and never stores it raw', async (t) => {
  const driver = await createOnlineDriver(t, { lat: PICKUP.lat, lng: PICKUP.lng });

  const response = await request('POST', '/driver/payout-accounts', {
    accessToken: driver.accessToken,
    body: { accountType: 'bkash', accountName: 'Rafiq Islam', accountNo: '01712345678' },
  });
  assert.equal(response.status, 201);
  const body = (await response.json()).data;
  assert.equal(body.accountNoMasked, '*******5678');
  assert.equal(body.accountType, 'bkash');
  assert.equal(body.isVerified, true);

  const { rows } = await pool.query(`SELECT * FROM driver_payout_accounts WHERE id = $1`, [body.id]);
  assert.equal(Object.keys(rows[0]).some((column) => column.toLowerCase().includes('account_no') && column !== 'account_no_masked'), false);
});

test('POST /driver/payout-accounts requires bankName for a bank account', async (t) => {
  const driver = await createOnlineDriver(t, { lat: PICKUP.lat, lng: PICKUP.lng });

  const response = await request('POST', '/driver/payout-accounts', {
    accessToken: driver.accessToken,
    body: { accountType: 'bank', accountName: 'Rafiq Islam', accountNo: '1234567890' },
  });
  assert.equal(response.status, 422);
  assert.equal((await response.json()).error.code, 'VALIDATION_FAILED');
});

test('GET /driver/payout-accounts only lists the caller\'s own accounts', async (t) => {
  const driverA = await createOnlineDriver(t, { lat: PICKUP.lat, lng: PICKUP.lng });
  const driverB = await createOnlineDriver(t, { lat: PICKUP.lat, lng: PICKUP.lng });
  await createPayoutAccount(driverA.accessToken);

  const response = await request('GET', '/driver/payout-accounts', { accessToken: driverB.accessToken });
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).data, []);
});

test('DELETE /driver/payout-accounts/:id removes an account with no withdrawal history', async (t) => {
  const driver = await createOnlineDriver(t, { lat: PICKUP.lat, lng: PICKUP.lng });
  const account = await createPayoutAccount(driver.accessToken);

  const response = await request('DELETE', `/driver/payout-accounts/${account.id}`, { accessToken: driver.accessToken });
  assert.equal(response.status, 204);

  const { rows } = await pool.query(`SELECT id FROM driver_payout_accounts WHERE id = $1`, [account.id]);
  assert.equal(rows.length, 0);
});

test('DELETE /driver/payout-accounts/:id is 409 PAYOUT_ACCOUNT_IN_USE once a withdrawal references it', async (t) => {
  const { driver } = await createDriverWithBalance(t);
  const account = await createPayoutAccount(driver.accessToken);
  const withdrawn = await request('POST', '/driver/withdrawals', {
    accessToken: driver.accessToken,
    body: { amount: 50, payoutAccountId: account.id },
  });
  assert.equal(withdrawn.status, 201);

  const response = await request('DELETE', `/driver/payout-accounts/${account.id}`, { accessToken: driver.accessToken });
  assert.equal(response.status, 409);
  assert.equal((await response.json()).error.code, 'PAYOUT_ACCOUNT_IN_USE');
});

test('DELETE /driver/payout-accounts/:id by a non-owner gets 404 (no existence leak)', async (t) => {
  const owner = await createOnlineDriver(t, { lat: PICKUP.lat, lng: PICKUP.lng });
  const stranger = await createOnlineDriver(t, { lat: PICKUP.lat, lng: PICKUP.lng });
  const account = await createPayoutAccount(owner.accessToken);

  const response = await request('DELETE', `/driver/payout-accounts/${account.id}`, { accessToken: stranger.accessToken });
  assert.equal(response.status, 404);
  assert.equal((await response.json()).error.code, 'PAYOUT_ACCOUNT_NOT_FOUND');
});

// ---------------------------------------------------------------------
// Withdrawal request
// ---------------------------------------------------------------------

test('POST /driver/withdrawals debits the wallet immediately (holds funds at request time, not approval)', async (t) => {
  const { driver, walletBalance } = await createDriverWithBalance(t);
  const account = await createPayoutAccount(driver.accessToken);

  const response = await request('POST', '/driver/withdrawals', {
    accessToken: driver.accessToken,
    body: { amount: 50, payoutAccountId: account.id },
  });
  assert.equal(response.status, 201);
  const body = (await response.json()).data;
  assert.equal(body.status, 'requested');
  assert.equal(Number(body.amount), 50);

  const { rows } = await pool.query(`SELECT balance FROM wallets WHERE user_id = $1`, [driver.userId]);
  assert.equal(Number(rows[0].balance), Math.round((walletBalance - 50) * 100) / 100);

  const { rows: ledgerRows } = await pool.query(
    `SELECT direction, amount, idempotency_key AS "idempotencyKey" FROM wallet_transactions wt
     JOIN wallets w ON w.id = wt.wallet_id
     WHERE w.user_id = $1 AND wt.reference_type = 'withdrawal' AND wt.reference_id = $2`,
    [driver.userId, body.id],
  );
  assert.equal(ledgerRows.length, 1);
  assert.equal(ledgerRows[0].direction, 'debit');
  assert.equal(ledgerRows[0].idempotencyKey, `withdrawal-request-${body.id}`);
});

test('POST /driver/withdrawals is 422 INSUFFICIENT_BALANCE and touches nothing when the wallet is short', async (t) => {
  const driver = await createOnlineDriver(t, { lat: PICKUP.lat, lng: PICKUP.lng }); // fresh, 0 balance
  const account = await createPayoutAccount(driver.accessToken);

  const response = await request('POST', '/driver/withdrawals', {
    accessToken: driver.accessToken,
    body: { amount: 100, payoutAccountId: account.id },
  });
  assert.equal(response.status, 422);
  assert.equal((await response.json()).error.code, 'INSUFFICIENT_BALANCE');

  const { rows } = await pool.query(`SELECT count(*)::int AS n FROM withdrawals WHERE payout_account_id = $1`, [account.id]);
  assert.equal(rows[0].n, 0);
});

test('POST /driver/withdrawals is 409 PAYOUT_ACCOUNT_UNVERIFIED for an unverified account', async (t) => {
  const { driver } = await createDriverWithBalance(t);
  const account = await createPayoutAccount(driver.accessToken);
  await pool.query(`UPDATE driver_payout_accounts SET is_verified = false WHERE id = $1`, [account.id]);

  const response = await request('POST', '/driver/withdrawals', {
    accessToken: driver.accessToken,
    body: { amount: 50, payoutAccountId: account.id },
  });
  assert.equal(response.status, 409);
  assert.equal((await response.json()).error.code, 'PAYOUT_ACCOUNT_UNVERIFIED');
});

test('POST /driver/withdrawals rejects a payout account that belongs to someone else', async (t) => {
  const { driver: owner } = await createDriverWithBalance(t);
  const account = await createPayoutAccount(owner.accessToken);
  const { driver: stranger } = await createDriverWithBalance(t);

  const response = await request('POST', '/driver/withdrawals', {
    accessToken: stranger.accessToken,
    body: { amount: 50, payoutAccountId: account.id },
  });
  assert.equal(response.status, 404);
  assert.equal((await response.json()).error.code, 'PAYOUT_ACCOUNT_NOT_FOUND');
});

test('GET /driver/withdrawals lists the caller\'s own request history', async (t) => {
  const { driver } = await createDriverWithBalance(t);
  const account = await createPayoutAccount(driver.accessToken);
  await request('POST', '/driver/withdrawals', { accessToken: driver.accessToken, body: { amount: 50, payoutAccountId: account.id } });

  const response = await request('GET', '/driver/withdrawals', { accessToken: driver.accessToken });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.data.length, 1);
  assert.equal(body.data[0].status, 'requested');
  assert.equal(body.data[0].accountType, 'bkash');
  assert.equal(body.meta.total, 1);
});

// ---------------------------------------------------------------------
// Admin payout queue — the finance-access-level enforcement
// ---------------------------------------------------------------------

test('GET /admin/withdrawals is visible to ANY admin (no access-level restriction on the list itself)', async (t) => {
  const { driver } = await createDriverWithBalance(t);
  const account = await createPayoutAccount(driver.accessToken);
  await request('POST', '/driver/withdrawals', { accessToken: driver.accessToken, body: { amount: 50, payoutAccountId: account.id } });

  const opsAdmin = await createAdmin('ops');
  const response = await request('GET', '/admin/withdrawals?status=requested', { accessToken: opsAdmin.accessToken });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.ok(body.data.length >= 1);
  assert.ok(body.data.every((row) => row.status === 'requested'));
  const row = body.data[0];
  assert.equal(row.accountType, 'bkash');
  assert.ok(row.accountNoMasked.startsWith('*'));
});

test('POST /admin/withdrawals/:id/approve is 403 FORBIDDEN_ACCESS_LEVEL for a non-finance, non-super admin', async (t) => {
  const { driver } = await createDriverWithBalance(t);
  const account = await createPayoutAccount(driver.accessToken);
  const requested = await request('POST', '/driver/withdrawals', { accessToken: driver.accessToken, body: { amount: 50, payoutAccountId: account.id } });
  const { id: withdrawalId } = (await requested.json()).data;

  const opsAdmin = await createAdmin('ops');
  const response = await request('POST', `/admin/withdrawals/${withdrawalId}/approve`, { accessToken: opsAdmin.accessToken });
  assert.equal(response.status, 403);
  assert.equal((await response.json()).error.code, 'FORBIDDEN_ACCESS_LEVEL');

  const { rows } = await pool.query(`SELECT status FROM withdrawals WHERE id = $1`, [withdrawalId]);
  assert.equal(rows[0].status, 'requested'); // untouched
});

test('POST /admin/withdrawals/:id/approve succeeds for a finance-level admin and is audit-logged', async (t) => {
  const { driver } = await createDriverWithBalance(t);
  const account = await createPayoutAccount(driver.accessToken);
  const requested = await request('POST', '/driver/withdrawals', { accessToken: driver.accessToken, body: { amount: 50, payoutAccountId: account.id } });
  const { id: withdrawalId } = (await requested.json()).data;

  const financeAdmin = await createAdmin('finance');
  const response = await request('POST', `/admin/withdrawals/${withdrawalId}/approve`, { accessToken: financeAdmin.accessToken });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).data.status, 'approved');

  const { rows } = await pool.query(`SELECT status, processed_by AS "processedBy" FROM withdrawals WHERE id = $1`, [withdrawalId]);
  assert.equal(rows[0].status, 'approved');
  assert.equal(Number(rows[0].processedBy), Number(financeAdmin.userId));

  const { rows: auditRows } = await pool.query(
    `SELECT action, actor_id AS "actorId" FROM audit_logs WHERE entity_type = 'withdrawals' AND entity_id = $1`,
    [withdrawalId],
  );
  assert.equal(auditRows.length, 1);
  assert.equal(auditRows[0].action, 'WITHDRAWAL_APPROVED');
  assert.equal(Number(auditRows[0].actorId), Number(financeAdmin.userId));
});

test('POST /admin/withdrawals/:id/approve succeeds for a super-level admin too', async (t) => {
  const { driver } = await createDriverWithBalance(t);
  const account = await createPayoutAccount(driver.accessToken);
  const requested = await request('POST', '/driver/withdrawals', { accessToken: driver.accessToken, body: { amount: 50, payoutAccountId: account.id } });
  const { id: withdrawalId } = (await requested.json()).data;

  const superAdmin = await createAdmin('super');
  const response = await request('POST', `/admin/withdrawals/${withdrawalId}/approve`, { accessToken: superAdmin.accessToken });
  assert.equal(response.status, 200);
});

test('POST /admin/withdrawals/:id/reject reverses the held amount back into the driver\'s wallet', async (t) => {
  const { driver, walletBalance } = await createDriverWithBalance(t);
  const account = await createPayoutAccount(driver.accessToken);
  const requested = await request('POST', '/driver/withdrawals', { accessToken: driver.accessToken, body: { amount: 50, payoutAccountId: account.id } });
  const { id: withdrawalId } = (await requested.json()).data;

  const financeAdmin = await createAdmin('finance');
  const response = await request('POST', `/admin/withdrawals/${withdrawalId}/reject`, {
    accessToken: financeAdmin.accessToken,
    body: { reason: 'Account details could not be verified' },
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).data.status, 'rejected');

  const { rows } = await pool.query(`SELECT balance FROM wallets WHERE user_id = $1`, [driver.userId]);
  assert.equal(Number(rows[0].balance), Math.round(walletBalance * 100) / 100); // fully reversed, back to the pre-request balance

  const { rows: withdrawalRows } = await pool.query(
    `SELECT rejection_reason AS "rejectionReason" FROM withdrawals WHERE id = $1`,
    [withdrawalId],
  );
  assert.equal(withdrawalRows[0].rejectionReason, 'Account details could not be verified');
});

test('POST /admin/withdrawals/:id/approve on an already-reviewed withdrawal is 409 WITHDRAWAL_ALREADY_REVIEWED', async (t) => {
  const { driver } = await createDriverWithBalance(t);
  const account = await createPayoutAccount(driver.accessToken);
  const requested = await request('POST', '/driver/withdrawals', { accessToken: driver.accessToken, body: { amount: 50, payoutAccountId: account.id } });
  const { id: withdrawalId } = (await requested.json()).data;

  const financeAdmin = await createAdmin('finance');
  const first = await request('POST', `/admin/withdrawals/${withdrawalId}/approve`, { accessToken: financeAdmin.accessToken });
  assert.equal(first.status, 200);

  const second = await request('POST', `/admin/withdrawals/${withdrawalId}/approve`, { accessToken: financeAdmin.accessToken });
  assert.equal(second.status, 409);
  assert.equal((await second.json()).error.code, 'WITHDRAWAL_ALREADY_REVIEWED');
});

test('POST /admin/withdrawals/:id/approve requires ADMIN role, not just any authenticated user', async (t) => {
  const { driver } = await createDriverWithBalance(t);
  const account = await createPayoutAccount(driver.accessToken);
  const requested = await request('POST', '/driver/withdrawals', { accessToken: driver.accessToken, body: { amount: 50, payoutAccountId: account.id } });
  const { id: withdrawalId } = (await requested.json()).data;

  const response = await request('POST', `/admin/withdrawals/${withdrawalId}/approve`, { accessToken: driver.accessToken });
  assert.equal(response.status, 403);
  assert.equal((await response.json()).error.code, 'FORBIDDEN_ROLE');
});
