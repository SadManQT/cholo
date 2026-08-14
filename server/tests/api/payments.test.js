import assert from 'node:assert/strict';
import { randomInt } from 'node:crypto';
import { once } from 'node:events';
import { after, before, mock, test } from 'node:test';

import app from '../../src/app.js';
import { pool } from '../../src/config/db.js';
import { env } from '../../src/config/env.js';
import { signAccessToken } from '../../src/utils/tokens.js';

// Same reasoning as trips.test.js/dispatch.test.js: real pool, no
// savepoint mocking, no cleanup — trip fixtures are permanently
// undeletable (append-only trigger). fetch is mocked for OSRM (trip
// completion needs a route) AND SSLCommerz (session + validation) so this
// whole suite runs fast, deterministic, and offline — real-sandbox
// verification happens separately, by hand, not in the automated suite.
let server;
let baseUrl;
let seed = randomInt(10_000_000, 100_000_000);
const realFetch = globalThis.fetch;

// val_id -> what the Validation API should report for it. Each test
// registers its own entries before firing a webhook, so the mock can
// return a genuinely different (and controllable) answer per test instead
// of one fixed canned response — the whole point of the validation step
// is that it's independent of whatever the webhook POST body claims.
const mockValidations = new Map();

before(async () => {
  mock.method(globalThis, 'fetch', async (url, options) => {
    if (typeof url === 'string' && url.startsWith(env.OSRM_BASE_URL)) {
      return { ok: true, json: async () => ({ code: 'Ok', routes: [{ distance: 10340, duration: 660, geometry: { coordinates: [[90.3742, 23.7461], [90.4078, 23.7925]] } }] }) };
    }
    if (typeof url === 'string' && url.includes('/gwprocess/v4/api.php')) {
      const body = new URLSearchParams(options.body);
      return {
        ok: true,
        json: async () => ({
          status: 'SUCCESS',
          sessionkey: `MOCKSESSION-${body.get('tran_id')}`,
          GatewayPageURL: `https://sandbox.sslcommerz.com/EasyCheckOut/mock-${body.get('tran_id')}`,
        }),
      };
    }
    if (typeof url === 'string' && url.includes('/validator/api/validationserverAPI.php')) {
      const valId = new URL(url).searchParams.get('val_id');
      const known = mockValidations.get(valId);
      return {
        ok: true,
        json: async () => known
          ? { status: known.status ?? 'VALID', tran_id: known.tranId, amount: String(known.amount), bank_tran_id: known.bankTranId ?? `BANK-${valId}` }
          : { status: 'INVALID_TRANSACTION', tran_id: '', amount: '', bank_tran_id: '' },
      };
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

function postWebhook(gateway, formFields) {
  return fetch(`${baseUrl}/api/v1/webhooks/payments/${gateway}`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(formFields),
  });
}

// payments.gateway_txn_id is UNIQUE and these fixtures are never cleaned
// up (same reasoning as trips.test.js) — a hardcoded val_id/bank_tran_id
// collides with itself on the SECOND run of this file against the same
// persistent dev DB. Every val_id this file registers goes through here.
function uniqueValId(label) {
  seed += 1;
  return `${label}-${seed}`;
}

async function createPassenger() {
  seed += 1;
  const phone = `016${String(seed).padStart(8, '0').slice(-8)}`;
  const { rows } = await pool.query(
    `INSERT INTO users (full_name, phone, password_hash, phone_verified_at)
     VALUES ('Payments Test Passenger', $1, 'test-hash', now()) RETURNING id`,
    [phone],
  );
  const userId = rows[0].id;
  await pool.query(`INSERT INTO user_roles (user_id, role_id) SELECT $1, id FROM roles WHERE name = 'PASSENGER'`, [userId]);
  await pool.query(`INSERT INTO passenger_profiles (user_id) VALUES ($1)`, [userId]);

  return { userId, accessToken: signAccessToken({ userId, roles: ['PASSENGER'], sessionId: userId }) };
}

async function createOnlineDriver(t, { lat, lng }) {
  seed += 1;
  const phone = `019${String(seed).padStart(8, '0').slice(-8)}`;
  const { rows } = await pool.query(
    `INSERT INTO users (full_name, phone, password_hash, phone_verified_at)
     VALUES ('Payments Test Driver', $1, 'test-hash', now()) RETURNING id`,
    [phone],
  );
  const userId = rows[0].id;
  await pool.query(`INSERT INTO user_roles (user_id, role_id) SELECT $1, id FROM roles WHERE name = 'DRIVER'`, [userId]);
  await pool.query(
    `INSERT INTO driver_profiles (user_id, nid_number, license_number, license_expiry, verification_status)
     VALUES ($1, $2, $3, '2035-12-31', 'approved')`,
    [userId, String(userId).padStart(10, '0'), `DL-PAY-${userId}`],
  );
  const { rows: vehicleRows } = await pool.query(
    `INSERT INTO vehicles (driver_id, category_id, registration_no, verification_status, is_active)
     SELECT $1, id, $2, 'approved', true FROM vehicle_categories WHERE name = 'Car' RETURNING id`,
    [userId, `DHAKA-PAY-${userId}`],
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

// A third area of Dhaka, away from trips.test.js's Uttara and dispatch.
// test.js's Gulshan/Dhanmondi coordinates — same cross-file collision
// reasoning as both those files.
const PICKUP = { lat: 23.7461, lng: 90.3742 }; // Dhanmondi 27 (dispatch.test.js uses Dhanmondi too, but 2km away)
const DROPOFF = { lat: 23.7104, lng: 90.4074 }; // Jatrabari

async function createAssignedTrip(t, { paymentIntent = 'bkash' } = {}) {
  const passenger = await createPassenger();
  const driver = await createOnlineDriver(t, { lat: PICKUP.lat, lng: PICKUP.lng });

  const { rows: cityRows } = await pool.query(`SELECT id FROM cities WHERE name = 'Dhaka'`);
  const booked = await request('POST', '/ride-requests', {
    accessToken: passenger.accessToken,
    body: { cityId: cityRows[0].id, categoryId: 3, pickup: PICKUP, dropoff: DROPOFF, paymentIntent },
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

async function completeAssignedTrip(tripCode, driverAccessToken) {
  await request('POST', `/trips/${tripCode}/arrived`, { accessToken: driverAccessToken });
  await request('POST', `/trips/${tripCode}/start`, { accessToken: driverAccessToken });
  const response = await request('POST', `/trips/${tripCode}/complete`, { accessToken: driverAccessToken, body: {} });
  return (await response.json()).data;
}

// ---------------------------------------------------------------------
// POST /wallet/topup
// ---------------------------------------------------------------------

test('POST /wallet/topup creates an initiated payment and returns a redirect URL', async () => {
  const passenger = await createPassenger();

  const response = await request('POST', '/wallet/topup', {
    accessToken: passenger.accessToken,
    body: { amount: 500, method: 'bkash' },
  });
  assert.equal(response.status, 201);
  const body = (await response.json()).data;

  assert.equal(body.payment.status, 'initiated');
  assert.equal(Number(body.payment.amount), 500);
  assert.match(body.redirectUrl, /^https:\/\/sandbox\.sslcommerz\.com\/EasyCheckOut\/mock-/);

  const { rows } = await pool.query(
    `SELECT purpose, trip_id AS "tripId", method_type AS "methodType", gateway, status
     FROM payments WHERE public_id = $1`,
    [body.payment.publicId],
  );
  assert.equal(rows[0].purpose, 'wallet_topup');
  assert.equal(rows[0].tripId, null);
  assert.equal(rows[0].methodType, 'bkash');
  assert.equal(rows[0].gateway, 'sslcommerz');
  assert.equal(rows[0].status, 'initiated');
});

test('POST /wallet/topup rejects an amount below SSLCommerz\'s own 10.00 floor', async () => {
  const passenger = await createPassenger();

  const response = await request('POST', '/wallet/topup', {
    accessToken: passenger.accessToken,
    body: { amount: 5, method: 'bkash' },
  });
  assert.equal(response.status, 422);
  assert.equal((await response.json()).error.code, 'VALIDATION_FAILED');
});

test('POST /wallet/topup requires a bearer token', async () => {
  const response = await request('POST', '/wallet/topup', { body: { amount: 500, method: 'bkash' } });
  assert.equal(response.status, 401);
});

// ---------------------------------------------------------------------
// POST /trips/:tripCode/pay with a gateway method
// ---------------------------------------------------------------------

test('POST /trips/:tripCode/pay with method=bkash creates an initiated payment and returns pending_redirect', async (t) => {
  const { tripCode, passenger, driver } = await createAssignedTrip(t);
  await completeAssignedTrip(tripCode, driver.accessToken);

  const response = await request('POST', `/trips/${tripCode}/pay`, {
    accessToken: passenger.accessToken,
    body: { method: 'bkash' },
  });
  assert.equal(response.status, 201);
  const body = (await response.json()).data;

  assert.equal(body.status, 'pending_redirect');
  assert.equal(body.method, 'bkash');
  assert.match(body.redirectUrl, /^https:\/\/sandbox\.sslcommerz\.com\/EasyCheckOut\/mock-/);

  const { rows: tripRows } = await pool.query(`SELECT payment_status FROM trips WHERE trip_code = $1`, [tripCode]);
  assert.equal(tripRows[0].payment_status, 'unpaid'); // still unpaid — webhook hasn't fired
});

// ---------------------------------------------------------------------
// Webhook: trip payment settlement + THE idempotency proof
// ---------------------------------------------------------------------

test('webhook settles a gateway trip payment: payment succeeded, trip paid, driver_earnings + commission debit', async (t) => {
  const { tripCode, passenger, driver } = await createAssignedTrip(t);
  const completed = await completeAssignedTrip(tripCode, driver.accessToken);
  const totalFare = Number(completed.fare.total);

  const payResponse = await request('POST', `/trips/${tripCode}/pay`, {
    accessToken: passenger.accessToken,
    body: { method: 'bkash' },
  });
  const { publicId: tranId } = (await payResponse.json()).data.payment;

  const valId = uniqueValId('val-happy-path');
  const bankTranId = uniqueValId('BANK');
  mockValidations.set(valId, { tranId, amount: totalFare, bankTranId });

  const webhookResponse = await postWebhook('sslcommerz', {
    status: 'VALID', tran_id: tranId, val_id: valId, amount: String(totalFare), bank_tran_id: 'BANK-ignored-by-mock',
  });
  assert.equal(webhookResponse.status, 200);
  assert.deepEqual(await webhookResponse.json(), { received: true });

  const { rows: tripRows } = await pool.query(
    `SELECT id, payment_status AS "paymentStatus" FROM trips WHERE trip_code = $1`,
    [tripCode],
  );
  assert.equal(tripRows[0].paymentStatus, 'paid');
  const tripId = tripRows[0].id;

  const { rows: paymentRows } = await pool.query(
    `SELECT status, gateway_txn_id AS "gatewayTxnId" FROM payments WHERE public_id = $1`,
    [tranId],
  );
  assert.equal(paymentRows[0].status, 'succeeded');
  assert.equal(paymentRows[0].gatewayTxnId, bankTranId);

  const { rows: earningRows } = await pool.query(
    `SELECT gross_fare AS "grossFare", commission_amount AS "commissionAmount", net_earning AS "netEarning"
     FROM driver_earnings WHERE trip_id = $1`,
    [tripId],
  );
  assert.equal(earningRows.length, 1);
  assert.equal(Number(earningRows[0].grossFare), totalFare);

  // Gateway payments are platform-collected (the passenger paid SSLCommerz
  // directly, not the driver) — the driver gets CREDITED their net share,
  // unlike cash's commission debit (T2), which is the opposite direction
  // for the opposite reason (there, the driver already holds the cash).
  const { rows: ledgerRows } = await pool.query(
    `SELECT wt.direction, wt.amount FROM wallet_transactions wt
     JOIN wallets w ON w.id = wt.wallet_id
     WHERE w.user_id = $1 AND wt.reference_type = 'trip' AND wt.reference_id = $2 AND wt.txn_type = 'trip_earning'`,
    [driver.userId, tripId],
  );
  assert.equal(ledgerRows.length, 1);
  assert.equal(ledgerRows[0].direction, 'credit');
  assert.equal(Number(ledgerRows[0].amount), Number(earningRows[0].netEarning));
});

test('THE IDEMPOTENCY PROOF: the same webhook delivered twice settles the payment exactly once', async (t) => {
  const { tripCode, passenger, driver } = await createAssignedTrip(t);
  const completed = await completeAssignedTrip(tripCode, driver.accessToken);
  const totalFare = Number(completed.fare.total);

  await request('POST', `/trips/${tripCode}/pay`, { accessToken: passenger.accessToken, body: { method: 'nagad' } });
  const { rows: paymentLookup } = await pool.query(
    `SELECT public_id AS "publicId" FROM payments WHERE trip_id = (SELECT id FROM trips WHERE trip_code = $1)`,
    [tripCode],
  );
  const tranId = paymentLookup[0].publicId;
  const valId = uniqueValId('val-idempotency');
  mockValidations.set(valId, { tranId, amount: totalFare, bankTranId: uniqueValId('BANK') });

  const webhookBody = { status: 'VALID', tran_id: tranId, val_id: valId, amount: String(totalFare), bank_tran_id: 'BANK-ignored-by-mock' };

  const first = await postWebhook('sslcommerz', webhookBody);
  assert.equal(first.status, 200);
  const second = await postWebhook('sslcommerz', webhookBody); // gateways retry on timeouts — same delivery again
  assert.equal(second.status, 200);
  assert.deepEqual(await second.json(), { received: true }); // still a clean 200, not an error

  // The real proof: query the DB, don't just trust two 200s.
  const { rows: paymentRows } = await pool.query(`SELECT status FROM payments WHERE public_id = $1`, [tranId]);
  assert.equal(paymentRows[0].status, 'succeeded'); // not double-anything, just succeeded

  const { rows: tripRows } = await pool.query(`SELECT id, payment_status AS "paymentStatus" FROM trips WHERE trip_code = $1`, [tripCode]);
  assert.equal(tripRows[0].paymentStatus, 'paid');
  const tripId = tripRows[0].id;

  const { rows: earningRows } = await pool.query(`SELECT count(*)::int AS n FROM driver_earnings WHERE trip_id = $1`, [tripId]);
  assert.equal(earningRows[0].n, 1, 'exactly one earnings row, not two');

  const { rows: ledgerRows } = await pool.query(
    `SELECT count(*)::int AS n FROM wallet_transactions wt
     JOIN wallets w ON w.id = wt.wallet_id
     WHERE w.user_id = $1 AND wt.reference_type = 'trip' AND wt.reference_id = $2 AND wt.txn_type = 'trip_earning'`,
    [driver.userId, tripId],
  );
  assert.equal(ledgerRows[0].n, 1, 'exactly one earnings credit, not two — the driver was not paid twice');
});

test('webhook credits the wallet for a topup (not driver earnings — purpose branches correctly)', async () => {
  const passenger = await createPassenger();
  const topupResponse = await request('POST', '/wallet/topup', {
    accessToken: passenger.accessToken,
    body: { amount: 300, method: 'card' },
  });
  const { publicId: tranId } = (await topupResponse.json()).data.payment;

  const valId = uniqueValId('val-topup');
  mockValidations.set(valId, { tranId, amount: 300, bankTranId: uniqueValId('BANK') });
  const webhookResponse = await postWebhook('sslcommerz', {
    status: 'VALID', tran_id: tranId, val_id: valId, amount: '300.00', bank_tran_id: 'BANK-ignored-by-mock',
  });
  assert.equal(webhookResponse.status, 200);

  const { rows: walletRows } = await pool.query(`SELECT balance FROM wallets WHERE user_id = $1`, [passenger.userId]);
  assert.equal(Number(walletRows[0].balance), 300);

  const { rows: ledgerRows } = await pool.query(
    `SELECT wt.txn_type, wt.direction, wt.amount FROM wallet_transactions wt
     JOIN wallets w ON w.id = wt.wallet_id
     WHERE w.user_id = $1 AND wt.reference_type = 'payment'`,
    [passenger.userId],
  );
  assert.equal(ledgerRows.length, 1);
  assert.equal(ledgerRows[0].txn_type, 'topup');
  assert.equal(ledgerRows[0].direction, 'credit');
  assert.equal(Number(ledgerRows[0].amount), 300);
});

test('webhook with an unrecognized val_id settles nothing (SSLCommerz\'s own server says there was no such transaction)', async (t) => {
  const { tripCode, passenger, driver } = await createAssignedTrip(t);
  await completeAssignedTrip(tripCode, driver.accessToken);
  await request('POST', `/trips/${tripCode}/pay`, { accessToken: passenger.accessToken, body: { method: 'card' } });

  // Deliberately NOT registered in mockValidations — the mock's fetch
  // handler falls through to INVALID_TRANSACTION, exactly like the real
  // sandbox does for a made-up val_id (verified live).
  const response = await postWebhook('sslcommerz', {
    status: 'VALID', tran_id: 'whatever-the-body-claims', val_id: 'val-never-registered', amount: '999',
  });
  assert.equal(response.status, 200); // still 200 — not the caller's fault, nothing to retry usefully

  const { rows: tripRows } = await pool.query(
    `SELECT payment_status AS "paymentStatus" FROM trips WHERE trip_code = $1`,
    [tripCode],
  );
  assert.equal(tripRows[0].paymentStatus, 'unpaid');
});

test('webhook rejects a mismatched gateway path with 401 BAD_SIGNATURE', async () => {
  const response = await postWebhook('bkash', { status: 'VALID', tran_id: 'x', val_id: 'x', amount: '10' });
  assert.equal(response.status, 401);
  assert.equal((await response.json()).error.code, 'BAD_SIGNATURE');
});

test('webhook rejects a verified transaction whose amount doesn\'t match the payment it claims to settle', async (t) => {
  const { tripCode, passenger, driver } = await createAssignedTrip(t);
  const completed = await completeAssignedTrip(tripCode, driver.accessToken);
  await request('POST', `/trips/${tripCode}/pay`, { accessToken: passenger.accessToken, body: { method: 'bkash' } });
  const { rows: paymentLookup } = await pool.query(
    `SELECT public_id AS "publicId" FROM payments WHERE trip_id = (SELECT id FROM trips WHERE trip_code = $1)`,
    [tripCode],
  );
  const tranId = paymentLookup[0].publicId;

  // Validation API "confirms" the val_id, but for the WRONG amount —
  // real fare was completed.fare.total, this claims half of it.
  mockValidations.set('val-amount-mismatch', { tranId, amount: Number(completed.fare.total) / 2 });

  const response = await postWebhook('sslcommerz', {
    status: 'VALID', tran_id: tranId, val_id: 'val-amount-mismatch', amount: String(Number(completed.fare.total) / 2),
  });
  assert.equal(response.status, 401);
  assert.equal((await response.json()).error.code, 'BAD_SIGNATURE');

  const { rows: paymentRows } = await pool.query(`SELECT status FROM payments WHERE public_id = $1`, [tranId]);
  assert.equal(paymentRows[0].status, 'initiated'); // untouched
});

// ---------------------------------------------------------------------
// GET /payments/:publicId
// ---------------------------------------------------------------------

test('GET /payments/:publicId returns the payer\'s own payment', async () => {
  const passenger = await createPassenger();
  const topupResponse = await request('POST', '/wallet/topup', {
    accessToken: passenger.accessToken,
    body: { amount: 500, method: 'bkash' },
  });
  const { publicId } = (await topupResponse.json()).data.payment;

  const response = await request('GET', `/payments/${publicId}`, { accessToken: passenger.accessToken });
  assert.equal(response.status, 200);
  const body = (await response.json()).data;
  assert.equal(body.publicId, publicId);
  assert.equal(body.status, 'initiated');
  assert.equal(Number(body.amount), 500);
});

test('GET /payments/:publicId gets 404 for a stranger (no existence leak)', async () => {
  const owner = await createPassenger();
  const stranger = await createPassenger();
  const topupResponse = await request('POST', '/wallet/topup', {
    accessToken: owner.accessToken,
    body: { amount: 500, method: 'bkash' },
  });
  const { publicId } = (await topupResponse.json()).data.payment;

  const response = await request('GET', `/payments/${publicId}`, { accessToken: stranger.accessToken });
  assert.equal(response.status, 404);
  assert.equal((await response.json()).error.code, 'PAYMENT_NOT_FOUND');
});
