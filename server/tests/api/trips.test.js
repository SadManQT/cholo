import assert from 'node:assert/strict';
import { randomInt } from 'node:crypto';
import { once } from 'node:events';
import { after, before, mock, test } from 'node:test';

import app from '../../src/app.js';
import { pool } from '../../src/config/db.js';
import { env } from '../../src/config/env.js';
import { signAccessToken } from '../../src/utils/tokens.js';

// Same reasoning as tests/api/dispatch.test.js: real pool, no savepoint
// mocking (each test needs its own genuinely-committed trip to transition),
// and no cleanup — every test here accepts an offer, which creates a trip,
// which is permanently undeletable (trip_status_history's append-only
// trigger blocks even the CASCADE a trip delete would trigger). These
// fixtures are meant to be left in the disposable dev DB, same as the
// dispatch race test's.
let server;
let baseUrl;
let seed = randomInt(10_000_000, 100_000_000);
const realFetch = globalThis.fetch;

before(async () => {
  mock.method(globalThis, 'fetch', async (url, options) => {
    if (typeof url === 'string' && url.startsWith(env.OSRM_BASE_URL)) {
      return { ok: true, json: async () => ({ code: 'Ok', routes: [{ distance: 10340, duration: 660, geometry: { coordinates: [[90.3742, 23.7461], [90.4078, 23.7925]] } }] }) };
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
  const phone = `017${String(seed).padStart(8, '0').slice(-8)}`;
  const { rows } = await pool.query(
    `INSERT INTO users (full_name, phone, password_hash, phone_verified_at)
     VALUES ('Trip Lifecycle Passenger', $1, 'test-hash', now()) RETURNING id`,
    [phone],
  );
  const userId = rows[0].id;
  await pool.query(`INSERT INTO user_roles (user_id, role_id) SELECT $1, id FROM roles WHERE name = 'PASSENGER'`, [userId]);
  await pool.query(`INSERT INTO passenger_profiles (user_id) VALUES ($1)`, [userId]);

  return { userId, accessToken: signAccessToken({ userId, roles: ['PASSENGER'], sessionId: userId }) };
}

// t (node:test's TestContext) resets this driver back offline right after
// ITS OWN test — see tests/api/dispatch.test.js's createOnlineDriver for
// why that matters: every test here dispatches at the same coordinates, so
// a driver left 'online' would still be "nearby and eligible" for every
// later test's booking in the same run, inflating offer counts.
async function createOnlineDriver(t, { lat, lng }) {
  seed += 1;
  const phone = `018${String(seed).padStart(8, '0').slice(-8)}`;
  const { rows } = await pool.query(
    `INSERT INTO users (full_name, phone, password_hash, phone_verified_at)
     VALUES ('Trip Lifecycle Driver', $1, 'test-hash', now()) RETURNING id`,
    [phone],
  );
  const userId = rows[0].id;
  await pool.query(`INSERT INTO user_roles (user_id, role_id) SELECT $1, id FROM roles WHERE name = 'DRIVER'`, [userId]);
  await pool.query(
    `INSERT INTO driver_profiles (user_id, nid_number, license_number, license_expiry, verification_status)
     VALUES ($1, $2, $3, '2035-12-31', 'approved')`,
    [userId, String(userId).padStart(10, '0'), `DL-TRIP-${userId}`],
  );
  const { rows: vehicleRows } = await pool.query(
    `INSERT INTO vehicles (driver_id, category_id, registration_no, verification_status, is_active)
     SELECT $1, id, $2, 'approved', true FROM vehicle_categories WHERE name = 'Car' RETURNING id`,
    [userId, `DHAKA-TRIP-${userId}`],
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

// Deliberately a DIFFERENT area of Dhaka than tests/api/dispatch.test.js's
// Gulshan/Dhanmondi coordinates (~10km apart, outside dispatch.service.js's
// 5km radius either way) — node's test runner can run files concurrently,
// and per-test t.after() cleanup only protects against cross-test overlap
// WITHIN a file, not a driver from a different file being briefly online
// at the exact same spot mid-run.
const PICKUP = { lat: 23.8759, lng: 90.3795 }; // Uttara Sector 4
const DROPOFF = { lat: 23.8593, lng: 90.3936 }; // Uttara Sector 10

// Books a ride, dispatches it, and has the driver accept — returns the
// assigned trip's code, ready for arrived/start/complete. paymentIntent
// defaults to 'cash' (T2 auto-settles at completion); pass 'wallet' for
// tests that need a trip still 'unpaid' after completion, for T3's /pay.
// Pass an existing `passenger` to book a SECOND trip for the same person
// (the double-spend race test needs one passenger, two trips, two drivers).
async function createAssignedTrip(t, { paymentIntent = 'cash', passenger: existingPassenger } = {}) {
  const passenger = existingPassenger ?? await createPassenger();
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

test('POST /trips/:tripCode/arrived requires a bearer token', async () => {
  const response = await request('POST', '/trips/JT-2026-000001/arrived');
  assert.equal(response.status, 401);
});

test('POST /trips/:tripCode/arrived rejects a non-DRIVER caller', async () => {
  const passenger = await createPassenger();
  const response = await request('POST', '/trips/JT-2026-000001/arrived', { accessToken: passenger.accessToken });
  assert.equal(response.status, 403);
  assert.equal((await response.json()).error.code, 'FORBIDDEN_ROLE');
});

test('a driver who is not on the trip gets 404 TRIP_NOT_FOUND, not 403 (no existence leak)', async (t) => {
  const { tripCode } = await createAssignedTrip(t);
  const stranger = await createOnlineDriver(t, { lat: 23.9, lng: 90.5 });

  const response = await request('POST', `/trips/${tripCode}/arrived`, { accessToken: stranger.accessToken });
  assert.equal(response.status, 404);
  assert.equal((await response.json()).error.code, 'TRIP_NOT_FOUND');
});

test('BAD_TRANSITION: start before arrived', async (t) => {
  const { tripCode, driver } = await createAssignedTrip(t);
  const response = await request('POST', `/trips/${tripCode}/start`, { accessToken: driver.accessToken });
  assert.equal(response.status, 409);
  assert.equal((await response.json()).error.code, 'BAD_TRANSITION');
});

test('BAD_TRANSITION: complete before arrived or started — the exact scenario in the task', async (t) => {
  const { tripCode, driver } = await createAssignedTrip(t);
  const response = await request('POST', `/trips/${tripCode}/complete`, {
    accessToken: driver.accessToken,
    body: {},
  });
  assert.equal(response.status, 409);
  assert.equal((await response.json()).error.code, 'BAD_TRANSITION');
});

test('an assigned trip owns the passenger booking slot until the trip becomes terminal', async (t) => {
  const { passenger } = await createAssignedTrip(t);
  const { rows: cityRows } = await pool.query(`SELECT id FROM cities WHERE name = 'Dhaka'`);

  const secondBooking = await request('POST', '/ride-requests', {
    accessToken: passenger.accessToken,
    body: {
      cityId: cityRows[0].id,
      categoryId: 3,
      pickup: PICKUP,
      dropoff: DROPOFF,
      paymentIntent: 'cash',
    },
  });

  assert.equal(secondBooking.status, 409);
  assert.equal((await secondBooking.json()).error.code, 'ACTIVE_REQUEST_EXISTS');
});

test('BAD_TRANSITION: arrived twice', async (t) => {
  const { tripCode, driver } = await createAssignedTrip(t);
  const first = await request('POST', `/trips/${tripCode}/arrived`, { accessToken: driver.accessToken });
  assert.equal(first.status, 200);

  const second = await request('POST', `/trips/${tripCode}/arrived`, { accessToken: driver.accessToken });
  assert.equal(second.status, 409);
  assert.equal((await second.json()).error.code, 'BAD_TRANSITION');
});

test('the full happy path: arrived -> start -> complete, with a fare breakdown satisfying chk_fare_identity', async (t) => {
  const { tripCode, driver } = await createAssignedTrip(t);

  const arrived = await request('POST', `/trips/${tripCode}/arrived`, { accessToken: driver.accessToken });
  assert.equal(arrived.status, 200);
  assert.equal((await arrived.json()).data.status, 'arrived');

  const started = await request('POST', `/trips/${tripCode}/start`, { accessToken: driver.accessToken });
  assert.equal(started.status, 200);
  assert.equal((await started.json()).data.status, 'in_progress');

  const completed = await request('POST', `/trips/${tripCode}/complete`, {
    accessToken: driver.accessToken,
    body: { waitingMin: 2 },
  });
  assert.equal(completed.status, 200);
  const { data } = await completed.json();

  assert.equal(data.status, 'completed');
  assert.equal(data.fare.base, '60.00'); // seeded Dhaka/Car tariff
  assert.equal(data.fare.distance, '227.48'); // 10.34km real OSRM route * 22/km
  assert.equal(data.fare.currency, 'BDT');
  // createAssignedTrip books with paymentIntent: 'cash' — settled inline,
  // atomically, at completion (doc 02-03 §8 T2), not left pending like a
  // gateway/wallet payment would be.
  assert.equal(data.payment.method, 'cash');
  assert.equal(data.payment.status, 'paid');

  const identitySum = Number(data.fare.base) + Number(data.fare.distance) + Number(data.fare.time)
    + Number(data.fare.waiting) + Number(data.fare.surge) + Number(data.fare.bookingFee)
    - Number(data.fare.discount);
  assert.equal(Math.round(identitySum * 100) / 100, Number(data.fare.total));

  // The real proof: chk_fare_identity is a DATABASE constraint. If the
  // insert had violated it, this row would not exist at all.
  const { rows } = await pool.query(
    `SELECT status, total_fare, actual_distance_km, actual_duration_min FROM trips WHERE trip_code = $1`,
    [tripCode],
  );
  assert.equal(rows[0].status, 'completed');
  assert.equal(Number(rows[0].total_fare), Number(data.fare.total));
  assert.ok(rows[0].actual_distance_km > 0);
});

test('T2: cash-trip completion inserts a succeeded payment, a driver_earnings split, and debits the driver wallet — atomically', async (t) => {
  const { tripCode, driver } = await createAssignedTrip(t);
  const { rows: beforeRows } = await pool.query(
    `SELECT balance FROM wallets WHERE user_id = $1`,
    [driver.userId],
  );
  const balanceBefore = Number(beforeRows[0].balance);

  await request('POST', `/trips/${tripCode}/arrived`, { accessToken: driver.accessToken });
  await request('POST', `/trips/${tripCode}/start`, { accessToken: driver.accessToken });
  const completed = await request('POST', `/trips/${tripCode}/complete`, { accessToken: driver.accessToken, body: {} });
  assert.equal(completed.status, 200);
  const { data } = await completed.json();
  const totalFare = Number(data.fare.total);

  const { rows: tripRows } = await pool.query(`SELECT id FROM trips WHERE trip_code = $1`, [tripCode]);
  const tripId = tripRows[0].id;

  const { rows: paymentRows } = await pool.query(
    `SELECT purpose, method_type, gateway, amount, status, completed_at FROM payments WHERE trip_id = $1`,
    [tripId],
  );
  assert.equal(paymentRows.length, 1);
  assert.equal(paymentRows[0].purpose, 'trip');
  assert.equal(paymentRows[0].method_type, 'cash');
  assert.equal(paymentRows[0].gateway, 'none');
  assert.equal(paymentRows[0].status, 'succeeded');
  assert.equal(Number(paymentRows[0].amount), totalFare);
  assert.ok(paymentRows[0].completed_at);

  const { rows: earningRows } = await pool.query(
    `SELECT driver_id, gross_fare, commission_pct, commission_amount, net_earning FROM driver_earnings WHERE trip_id = $1`,
    [tripId],
  );
  assert.equal(earningRows.length, 1);
  assert.equal(Number(earningRows[0].driver_id), Number(driver.userId));
  assert.equal(Number(earningRows[0].gross_fare), totalFare);
  assert.equal(Number(earningRows[0].commission_pct), 15);
  const expectedCommission = Math.round(totalFare * 0.15 * 100) / 100;
  assert.equal(Number(earningRows[0].commission_amount), expectedCommission);
  // chk_driver_earnings_identity is a DATABASE constraint — this row
  // existing at all is proof net_earning = gross_fare - commission_amount.
  assert.equal(Number(earningRows[0].net_earning), Math.round((totalFare - expectedCommission) * 100) / 100);

  const { rows: ledgerRows } = await pool.query(
    `SELECT wt.txn_type, wt.direction, wt.amount, wt.reference_type, wt.reference_id, wt.idempotency_key
     FROM wallet_transactions wt JOIN wallets w ON w.id = wt.wallet_id
     WHERE w.user_id = $1 AND wt.reference_type = 'trip' AND wt.reference_id = $2`,
    [driver.userId, tripId],
  );
  assert.equal(ledgerRows.length, 1);
  assert.equal(ledgerRows[0].txn_type, 'commission');
  assert.equal(ledgerRows[0].direction, 'debit');
  assert.equal(Number(ledgerRows[0].amount), expectedCommission);
  assert.equal(ledgerRows[0].idempotency_key, `commission-trip-${tripId}`);

  // fn_apply_wallet_txn actually moved the cached balance, not just logged
  // a row that nothing acted on.
  const { rows: afterRows } = await pool.query(`SELECT balance FROM wallets WHERE user_id = $1`, [driver.userId]);
  assert.equal(Number(afterRows[0].balance), Math.round((balanceBefore - expectedCommission) * 100) / 100);
});

// T3 — wallet payment (doc 02-03 §8): completeAssignedTrip drives a
// 'wallet'-intent trip to 'completed' (payment_status stays 'unpaid' —
// only cash auto-settles at completion), creditWallet funds the payer's
// wallet directly via the ledger (same trigger-computed balance_after
// path every other credit uses), so /pay is exercised against real state
// exactly like a passenger would produce it, not a hand-set balance.
async function completeAssignedTrip(tripCode, driverAccessToken) {
  await request('POST', `/trips/${tripCode}/arrived`, { accessToken: driverAccessToken });
  await request('POST', `/trips/${tripCode}/start`, { accessToken: driverAccessToken });
  const response = await request('POST', `/trips/${tripCode}/complete`, { accessToken: driverAccessToken, body: {} });
  return (await response.json()).data;
}

async function creditWallet(userId, amount) {
  seed += 1;
  await pool.query(
    `INSERT INTO wallet_transactions (wallet_id, txn_type, direction, amount, reference_type, idempotency_key)
     SELECT id, 'topup', 'credit', $2, 'manual', $3 FROM wallets WHERE user_id = $1`,
    [userId, amount, `test-topup-${userId}-${seed}`],
  );
}

test('T3: POST /trips/:tripCode/pay settles a wallet-intent trip — payment succeeded, ledger debited, trip marked paid', async (t) => {
  const setup = await createAssignedTrip(t, { paymentIntent: 'wallet' });
  const completed = await completeAssignedTrip(setup.tripCode, setup.driver.accessToken);
  assert.equal(completed.status, 'completed');
  assert.equal(completed.payment.method, 'wallet');
  assert.equal(completed.payment.status, 'unpaid'); // wallet doesn't auto-settle at completion, unlike cash
  const totalFare = Number(completed.fare.total);

  await creditWallet(setup.passenger.userId, totalFare + 100); // more than enough

  const paid = await request('POST', `/trips/${setup.tripCode}/pay`, {
    accessToken: setup.passenger.accessToken,
    body: { method: 'wallet' },
  });
  assert.equal(paid.status, 201);
  const paidBody = (await paid.json()).data;
  assert.equal(paidBody.status, 'paid');
  assert.equal(paidBody.method, 'wallet');

  const { rows: tripRows } = await pool.query(
    `SELECT payment_status FROM trips WHERE trip_code = $1`,
    [setup.tripCode],
  );
  assert.equal(tripRows[0].payment_status, 'paid');

  const { rows: paymentRows } = await pool.query(
    `SELECT p.purpose, p.method_type, p.status, p.amount FROM payments p
     JOIN trips t ON t.id = p.trip_id WHERE t.trip_code = $1`,
    [setup.tripCode],
  );
  assert.equal(paymentRows.length, 1);
  assert.equal(paymentRows[0].method_type, 'wallet');
  assert.equal(paymentRows[0].status, 'succeeded');
  assert.equal(Number(paymentRows[0].amount), totalFare);

  const { rows: ledgerRows } = await pool.query(
    `SELECT wt.txn_type, wt.direction, wt.amount FROM wallet_transactions wt
     JOIN wallets w ON w.id = wt.wallet_id
     JOIN trips t ON t.id = wt.reference_id AND wt.reference_type = 'trip'
     WHERE w.user_id = $1 AND t.trip_code = $2 AND wt.txn_type = 'trip_payment'`,
    [setup.passenger.userId, setup.tripCode],
  );
  assert.equal(ledgerRows.length, 1);
  assert.equal(ledgerRows[0].direction, 'debit');
  assert.equal(Number(ledgerRows[0].amount), totalFare);
});

test('T3: POST /trips/:tripCode/pay rejects with 422 INSUFFICIENT_FUNDS and touches nothing when the wallet is short', async (t) => {
  const setup = await createAssignedTrip(t, { paymentIntent: 'wallet' });
  await completeAssignedTrip(setup.tripCode, setup.driver.accessToken);
  // No creditWallet call — the wallet is still at its fresh 0.00 balance.

  const response = await request('POST', `/trips/${setup.tripCode}/pay`, {
    accessToken: setup.passenger.accessToken,
    body: { method: 'wallet' },
  });
  assert.equal(response.status, 422);
  assert.equal((await response.json()).error.code, 'INSUFFICIENT_FUNDS');

  const { rows: tripRows } = await pool.query(
    `SELECT payment_status FROM trips WHERE trip_code = $1`,
    [setup.tripCode],
  );
  assert.equal(tripRows[0].payment_status, 'unpaid'); // the failed attempt changed nothing

  const { rows: paymentRows } = await pool.query(
    `SELECT count(*)::int AS n FROM payments p JOIN trips t ON t.id = p.trip_id WHERE t.trip_code = $1`,
    [setup.tripCode],
  );
  assert.equal(paymentRows[0].n, 0);
});

test('T3: POST /trips/:tripCode/pay is 409 ALREADY_PAID on a second attempt', async (t) => {
  const setup = await createAssignedTrip(t, { paymentIntent: 'wallet' });
  const completed = await completeAssignedTrip(setup.tripCode, setup.driver.accessToken);
  await creditWallet(setup.passenger.userId, Number(completed.fare.total) + 100);

  const first = await request('POST', `/trips/${setup.tripCode}/pay`, {
    accessToken: setup.passenger.accessToken,
    body: { method: 'wallet' },
  });
  assert.equal(first.status, 201);

  const second = await request('POST', `/trips/${setup.tripCode}/pay`, {
    accessToken: setup.passenger.accessToken,
    body: { method: 'wallet' },
  });
  assert.equal(second.status, 409);
  assert.equal((await second.json()).error.code, 'ALREADY_PAID');
});

test('T3: POST /trips/:tripCode/pay on an ALREADY cash-settled trip is also 409 ALREADY_PAID', async (t) => {
  const { tripCode, passenger, driver } = await createAssignedTrip(t); // default paymentIntent: 'cash'
  await completeAssignedTrip(tripCode, driver.accessToken); // T2 auto-settles this

  const response = await request('POST', `/trips/${tripCode}/pay`, {
    accessToken: passenger.accessToken,
    body: { method: 'wallet' },
  });
  assert.equal(response.status, 409);
  assert.equal((await response.json()).error.code, 'ALREADY_PAID');
});

test('T3: POST /trips/:tripCode/pay before completion is 409 BAD_TRANSITION', async (t) => {
  const { tripCode, passenger } = await createAssignedTrip(t, { paymentIntent: 'wallet' }); // still 'assigned'

  const response = await request('POST', `/trips/${tripCode}/pay`, {
    accessToken: passenger.accessToken,
    body: { method: 'wallet' },
  });
  assert.equal(response.status, 409);
  assert.equal((await response.json()).error.code, 'BAD_TRANSITION');
});

test('T3: POST /trips/:tripCode/pay rejects a non-PASSENGER caller', async (t) => {
  const setup = await createAssignedTrip(t, { paymentIntent: 'wallet' });
  await completeAssignedTrip(setup.tripCode, setup.driver.accessToken);

  const response = await request('POST', `/trips/${setup.tripCode}/pay`, {
    accessToken: setup.driver.accessToken, // DRIVER role, not PASSENGER
    body: { method: 'wallet' },
  });
  assert.equal(response.status, 403);
  assert.equal((await response.json()).error.code, 'FORBIDDEN_ROLE');
});

test('T3: POST /trips/:tripCode/pay by a passenger who is not on the trip gets 404 (no existence leak)', async (t) => {
  const setup = await createAssignedTrip(t, { paymentIntent: 'wallet' });
  await completeAssignedTrip(setup.tripCode, setup.driver.accessToken);
  const stranger = await createPassenger();

  const response = await request('POST', `/trips/${setup.tripCode}/pay`, {
    accessToken: stranger.accessToken,
    body: { method: 'wallet' },
  });
  assert.equal(response.status, 404);
  assert.equal((await response.json()).error.code, 'TRIP_NOT_FOUND');
});

// Gateway methods (bkash/nagad/card) are covered in tests/api/payments.
// test.js, which mocks the SSLCommerz HTTP calls — kept out of this file
// so trips.test.js's fetch mock (OSRM pass-through only) doesn't also
// have to know about gateway URLs.

// This fires two real concurrent HTTP requests, same shape as dispatch.
// test.js's THE RACE — but verified (by temporarily pulling the FOR
// UPDATE out of getByUserIdForUpdate and running this 20x) that it passes
// regardless of whether the lock exists: against a fast local Postgres,
// one request's whole transaction routinely finishes before the second's
// balance check even starts, so there's often no real overlap to
// serialize. The deterministic proof of the lock itself — two raw clients
// with controlled interleaving — lives in tests/integration/walletLock.
// test.js. This test still earns its keep as an end-to-end functional
// check: real concurrent requests hit real business-logic error codes and
// leave the DB in a consistent state, which is worth knowing even when
// the timing doesn't happen to force the lock to do any work.
test('two of the SAME passenger\'s trips paid the same instant, wallet funded for exactly one — ends with exactly one 201 and one 422, DB left consistent', async (t) => {
  // skipCleanup semantics don't apply here (trips.test.js never cleans up
  // trips anyway — see file-level note near createPassenger), but the
  // driver fixtures DO reset back offline via t.after in createOnlineDriver.
  //
  // M8 hardening releases a request's unique booking slot at 'matched':
  // from that point the trips row owns active lifecycle state, and
  // rides.service.js rejects a new booking only while that trip remains
  // assigned/arrived/in_progress. Completing A must therefore allow the
  // same passenger to book B without a direct SQL workaround.
  const passenger = await createPassenger();
  const setupA = await createAssignedTrip(t, { paymentIntent: 'wallet', passenger });
  const completedA = await completeAssignedTrip(setupA.tripCode, setupA.driver.accessToken);
  const setupB = await createAssignedTrip(t, { paymentIntent: 'wallet', passenger });
  const completedB = await completeAssignedTrip(setupB.tripCode, setupB.driver.accessToken);

  const fareA = Number(completedA.fare.total);
  const fareB = Number(completedB.fare.total);

  // Fund the ONE shared wallet with enough for exactly the cheaper of the
  // two trips — not both — so whichever request lands second (whether
  // that's because it was truly blocked on the lock, or simply because
  // the first had already finished) must find the wallet already spent.
  const fundedAmount = Math.min(fareA, fareB);
  await creditWallet(passenger.userId, fundedAmount);

  const pay = (tripCode) => request('POST', `/trips/${tripCode}/pay`, {
    accessToken: passenger.accessToken,
    body: { method: 'wallet' },
  });

  // Real concurrent HTTP requests against the real pool — Promise.all, not
  // sequential awaits, so both payment attempts genuinely overlap (same
  // reasoning as dispatch.test.js's THE RACE test for T1's accept race).
  const [responseA, responseB] = await Promise.all([pay(setupA.tripCode), pay(setupB.tripCode)]);
  const [bodyA, bodyB] = await Promise.all([responseA.json(), responseB.json()]);

  const statuses = [responseA.status, responseB.status].sort();
  assert.deepEqual(statuses, [201, 422]);

  const loserBody = responseA.status === 422 ? bodyA : bodyB;
  assert.equal(loserBody.error.code, 'INSUFFICIENT_FUNDS');

  // The real proof: query actual DB state, not just trust the HTTP
  // responses. Exactly one payment exists, exactly one trip is paid, and
  // the wallet landed at exactly 0 — never negative (double-spent) and
  // never left at fundedAmount (nothing debited at all).
  const { rows: paymentRows } = await pool.query(
    `SELECT t.trip_code AS "tripCode" FROM payments p
     JOIN trips t ON t.id = p.trip_id
     WHERE t.trip_code IN ($1, $2) AND p.status = 'succeeded'`,
    [setupA.tripCode, setupB.tripCode],
  );
  assert.equal(paymentRows.length, 1, 'exactly one of the two trips must have a succeeded payment');

  const winnerTripCode = paymentRows[0].tripCode;
  const loserTripCode = winnerTripCode === setupA.tripCode ? setupB.tripCode : setupA.tripCode;

  const { rows: statusRows } = await pool.query(
    `SELECT trip_code AS "tripCode", payment_status AS "paymentStatus" FROM trips WHERE trip_code IN ($1, $2)`,
    [setupA.tripCode, setupB.tripCode],
  );
  const winnerRow = statusRows.find((row) => row.tripCode === winnerTripCode);
  const loserRow = statusRows.find((row) => row.tripCode === loserTripCode);
  assert.equal(winnerRow.paymentStatus, 'paid');
  assert.equal(loserRow.paymentStatus, 'unpaid');

  const { rows: walletRows } = await pool.query(`SELECT balance FROM wallets WHERE user_id = $1`, [passenger.userId]);
  const expectedBalance = fundedAmount - (winnerTripCode === setupA.tripCode ? fareA : fareB);
  assert.equal(Number(walletRows[0].balance), Math.round(expectedBalance * 100) / 100);

  assert.equal(await walletBalanceMatchesAudit(passenger.userId), true);
});

async function walletBalanceMatchesAudit(userId) {
  const { rows } = await pool.query(
    `SELECT w.balance = fn_wallet_balance_audit(w.id) AS matches FROM wallets w WHERE w.user_id = $1`,
    [userId],
  );
  return rows[0].matches;
}

test('BAD_TRANSITION: completing an already-completed trip', async (t) => {
  const { tripCode, driver } = await createAssignedTrip(t);
  await request('POST', `/trips/${tripCode}/arrived`, { accessToken: driver.accessToken });
  await request('POST', `/trips/${tripCode}/start`, { accessToken: driver.accessToken });
  const first = await request('POST', `/trips/${tripCode}/complete`, { accessToken: driver.accessToken, body: {} });
  assert.equal(first.status, 200);

  const second = await request('POST', `/trips/${tripCode}/complete`, { accessToken: driver.accessToken, body: {} });
  assert.equal(second.status, 409);
  assert.equal((await second.json()).error.code, 'BAD_TRANSITION');
});

test('waiting time beyond free_wait_minutes is billed at waiting_per_min', async (t) => {
  await pool.query(`UPDATE pricing_rules SET waiting_per_min = 3.00, free_wait_minutes = 1 WHERE category_id = 3`);
  try {
    const { tripCode, driver } = await createAssignedTrip(t);
    await request('POST', `/trips/${tripCode}/arrived`, { accessToken: driver.accessToken });
    await request('POST', `/trips/${tripCode}/start`, { accessToken: driver.accessToken });

    const response = await request('POST', `/trips/${tripCode}/complete`, {
      accessToken: driver.accessToken,
      body: { waitingMin: 5 },
    });
    const { data } = await response.json();

    assert.equal(data.fare.waiting, '12.00'); // (5 - 1 free) * 3.00
  } finally {
    await pool.query(`UPDATE pricing_rules SET waiting_per_min = 0.00, free_wait_minutes = 0 WHERE category_id = 3`);
  }
});

test('POST /trips/:tripCode/complete rejects a malformed trip code before touching the database', async (t) => {
  const { driver } = await createAssignedTrip(t);
  const response = await request('POST', '/trips/not-a-real-trip-code/complete', {
    accessToken: driver.accessToken,
    body: {},
  });
  assert.equal(response.status, 422);
  assert.equal((await response.json()).error.code, 'VALIDATION_FAILED');
});

test('POST /trips/:tripCode/cancel requires a bearer token', async () => {
  const response = await request('POST', '/trips/JT-2026-000001/cancel', { body: { reasonCode: 'changed_mind' } });
  assert.equal(response.status, 401);
});

test('POST /trips/:tripCode/cancel rejects an invalid reasonCode before touching the database', async (t) => {
  const { tripCode, passenger } = await createAssignedTrip(t);
  const response = await request('POST', `/trips/${tripCode}/cancel`, {
    accessToken: passenger.accessToken,
    body: { reasonCode: 'not_a_real_reason' },
  });
  assert.equal(response.status, 422);
  assert.equal((await response.json()).error.code, 'VALIDATION_FAILED');
});

test('cancel: a caller who is neither the passenger nor the driver on the trip gets 404 (no existence leak)', async (t) => {
  const { tripCode } = await createAssignedTrip(t);
  const stranger = await createPassenger();

  const response = await request('POST', `/trips/${tripCode}/cancel`, {
    accessToken: stranger.accessToken,
    body: { reasonCode: 'changed_mind' },
  });
  assert.equal(response.status, 404);
  assert.equal((await response.json()).error.code, 'TRIP_NOT_FOUND');
});

test('cancel: passenger cancelling right after assignment (inside the grace period) owes no fee', async (t) => {
  const { tripCode, passenger } = await createAssignedTrip(t);

  const response = await request('POST', `/trips/${tripCode}/cancel`, {
    accessToken: passenger.accessToken,
    body: { reasonCode: 'changed_mind', reasonText: 'wrong pickup pin' },
  });
  assert.equal(response.status, 200);
  const { data } = await response.json();

  assert.equal(data.status, 'cancelled');
  assert.equal(data.cancelledBy, 'passenger');
  assert.equal(data.feeCharged, '0.00');

  // Freed up, not stuck 'matched' forever — otherwise
  // ux_one_active_request_per_passenger would lock this passenger out of
  // ever booking again.
  const { rows } = await pool.query(`SELECT rr.status FROM ride_requests rr JOIN trips t ON t.request_id = rr.id WHERE t.trip_code = $1`, [tripCode]);
  assert.equal(rows[0].status, 'cancelled');
});

test('cancel: passenger cancelling an assigned trip past the grace period owes the tariff\'s cancellation_fee', async (t) => {
  await pool.query(`UPDATE pricing_rules SET cancellation_fee = 25.00 WHERE category_id = 3`);
  try {
    const { tripCode, passenger } = await createAssignedTrip(t);
    await pool.query(`UPDATE trips SET assigned_at = now() - INTERVAL '10 minutes' WHERE trip_code = $1`, [tripCode]);

    const response = await request('POST', `/trips/${tripCode}/cancel`, {
      accessToken: passenger.accessToken,
      body: { reasonCode: 'changed_mind' },
    });
    assert.equal(response.status, 200);
    const { data } = await response.json();
    assert.equal(data.feeCharged, '25.00');
  } finally {
    await pool.query(`UPDATE pricing_rules SET cancellation_fee = 0.00 WHERE category_id = 3`);
  }
});

test('cancel: passenger cancelling after the driver has arrived always owes the cancellation_fee (no grace period)', async (t) => {
  await pool.query(`UPDATE pricing_rules SET cancellation_fee = 25.00 WHERE category_id = 3`);
  try {
    const { tripCode, passenger, driver } = await createAssignedTrip(t);
    const arrived = await request('POST', `/trips/${tripCode}/arrived`, { accessToken: driver.accessToken });
    assert.equal(arrived.status, 200);

    const response = await request('POST', `/trips/${tripCode}/cancel`, {
      accessToken: passenger.accessToken,
      body: { reasonCode: 'wrong_pickup' },
    });
    assert.equal(response.status, 200);
    const { data } = await response.json();
    assert.equal(data.status, 'cancelled');
    assert.equal(data.feeCharged, '25.00');
  } finally {
    await pool.query(`UPDATE pricing_rules SET cancellation_fee = 0.00 WHERE category_id = 3`);
  }
});

test('cancel: a driver cancelling never owes a fee, even past the grace period, and goes back online', async (t) => {
  await pool.query(`UPDATE pricing_rules SET cancellation_fee = 25.00 WHERE category_id = 3`);
  try {
    const { tripCode, driver } = await createAssignedTrip(t);
    await pool.query(`UPDATE trips SET assigned_at = now() - INTERVAL '10 minutes' WHERE trip_code = $1`, [tripCode]);

    const response = await request('POST', `/trips/${tripCode}/cancel`, {
      accessToken: driver.accessToken,
      body: { reasonCode: 'vehicle_issue' },
    });
    assert.equal(response.status, 200);
    const { data } = await response.json();
    assert.equal(data.cancelledBy, 'driver');
    assert.equal(data.feeCharged, '0.00');

    const { rows } = await pool.query(`SELECT status FROM driver_availability WHERE driver_id = $1`, [driver.userId]);
    assert.equal(rows[0].status, 'online');
  } finally {
    await pool.query(`UPDATE pricing_rules SET cancellation_fee = 0.00 WHERE category_id = 3`);
  }
});

test('BAD_TRANSITION: cancelling an in_progress trip is rejected for both roles', async (t) => {
  const { tripCode, passenger, driver } = await createAssignedTrip(t);
  await request('POST', `/trips/${tripCode}/arrived`, { accessToken: driver.accessToken });
  await request('POST', `/trips/${tripCode}/start`, { accessToken: driver.accessToken });

  const asPassenger = await request('POST', `/trips/${tripCode}/cancel`, {
    accessToken: passenger.accessToken,
    body: { reasonCode: 'changed_mind' },
  });
  assert.equal(asPassenger.status, 409);
  assert.equal((await asPassenger.json()).error.code, 'BAD_TRANSITION');

  const asDriver = await request('POST', `/trips/${tripCode}/cancel`, {
    accessToken: driver.accessToken,
    body: { reasonCode: 'vehicle_issue' },
  });
  assert.equal(asDriver.status, 409);
  assert.equal((await asDriver.json()).error.code, 'BAD_TRANSITION');
});

test('BAD_TRANSITION: cancelling an already-cancelled trip', async (t) => {
  const { tripCode, passenger } = await createAssignedTrip(t);
  const first = await request('POST', `/trips/${tripCode}/cancel`, {
    accessToken: passenger.accessToken,
    body: { reasonCode: 'changed_mind' },
  });
  assert.equal(first.status, 200);

  const second = await request('POST', `/trips/${tripCode}/cancel`, {
    accessToken: passenger.accessToken,
    body: { reasonCode: 'changed_mind' },
  });
  assert.equal(second.status, 409);
  assert.equal((await second.json()).error.code, 'BAD_TRANSITION');
});

test('M6 read APIs return participant-scoped history, detail, and tracking fallback', async (t) => {
  const { tripCode, passenger, driver } = await createAssignedTrip(t);

  const list = await request('GET', '/trips?status=active&page=1&limit=5', {
    accessToken: passenger.accessToken,
  });
  assert.equal(list.status, 200);
  const listBody = await list.json();
  assert.equal(listBody.data.some((trip) => trip.publicCode === tripCode), true);
  assert.equal(listBody.meta.page, 1);

  const wrongRole = await request('GET', '/trips?status=active&role=driver', {
    accessToken: passenger.accessToken,
  });
  assert.equal(wrongRole.status, 200);
  assert.equal((await wrongRole.json()).data.length, 0);

  const detail = await request('GET', `/trips/${tripCode}`, { accessToken: passenger.accessToken });
  assert.equal(detail.status, 200);
  const detailData = (await detail.json()).data;
  assert.equal(detailData.publicCode, tripCode);
  assert.equal(detailData.participantRole, 'passenger');
  assert.equal(detailData.driver.name, 'Trip Lifecycle Driver');
  assert.equal(detailData.history[0].toStatus, 'assigned');

  const track = await request('GET', `/trips/${tripCode}/track`, { accessToken: passenger.accessToken });
  assert.equal(track.status, 200);
  const tracked = (await track.json()).data;
  assert.equal(tracked.lat, PICKUP.lat);
  assert.equal(tracked.lng, PICKUP.lng);

  const stranger = await createPassenger();
  const hidden = await request('GET', `/trips/${tripCode}`, { accessToken: stranger.accessToken });
  assert.equal(hidden.status, 404);

  const driverDetail = await request('GET', `/trips/${tripCode}`, { accessToken: driver.accessToken });
  assert.equal((await driverDetail.json()).data.participantRole, 'driver');
});

test('M6 trip chat and SOS writes are participant-scoped and stored', async (t) => {
  const { tripCode, passenger, driver } = await createAssignedTrip(t);

  const sent = await request('POST', `/trips/${tripCode}/messages`, {
    accessToken: passenger.accessToken,
    body: { body: 'I am at the pickup', messageType: 'quick_reply' },
  });
  assert.equal(sent.status, 201);
  assert.equal((await sent.json()).data.body, 'I am at the pickup');

  const messages = await request('GET', `/trips/${tripCode}/messages`, { accessToken: driver.accessToken });
  assert.equal(messages.status, 200);
  const messageRows = (await messages.json()).data;
  assert.equal(messageRows.length, 1);
  assert.equal(messageRows[0].senderName, 'Trip Lifecycle Passenger');

  const sos = await request('POST', `/trips/${tripCode}/sos`, {
    accessToken: passenger.accessToken,
    body: { lat: PICKUP.lat, lng: PICKUP.lng },
  });
  assert.equal(sos.status, 201);
  assert.equal((await sos.json()).data.status, 'active');

  const { rows } = await pool.query(
    `SELECT count(*)::int AS count FROM sos_alerts sa
     JOIN trips t ON t.id = sa.trip_id WHERE t.trip_code = $1`,
    [tripCode],
  );
  assert.equal(rows[0].count, 1);
});
