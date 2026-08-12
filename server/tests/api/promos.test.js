import assert from 'node:assert/strict';
import { randomInt } from 'node:crypto';
import { once } from 'node:events';
import { after, before, mock, test } from 'node:test';

import app from '../../src/app.js';
import { pool } from '../../src/config/db.js';
import { env } from '../../src/config/env.js';
import { computeDiscount } from '../../src/utils/promoMath.js';
import { signAccessToken } from '../../src/utils/tokens.js';

// Same reasoning as tests/api/trips.test.js: real pool, no savepoint
// mocking (redemption/receipt rows only ever get written by a genuinely
// completed trip), no cleanup — fixtures are left in the disposable dev DB.
let server;
let baseUrl;
let seed = randomInt(10_000_000, 100_000_000);
let promoSeed = 0;
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
  const phone = `017${String(seed).padStart(8, '0').slice(-8)}`;
  const { rows } = await pool.query(
    `INSERT INTO users (full_name, phone, password_hash, phone_verified_at)
     VALUES ('Promo Test Passenger', $1, 'test-hash', now()) RETURNING id`,
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
     VALUES ('Promo Test Driver', $1, 'test-hash', now()) RETURNING id`,
    [phone],
  );
  const userId = rows[0].id;
  await pool.query(`INSERT INTO user_roles (user_id, role_id) SELECT $1, id FROM roles WHERE name = 'DRIVER'`, [userId]);
  await pool.query(
    `INSERT INTO driver_profiles (user_id, nid_number, license_number, license_expiry, verification_status)
     VALUES ($1, $2, $3, '2035-12-31', 'approved')`,
    [userId, String(userId).padStart(10, '0'), `DL-PROMO-${userId}`],
  );
  const { rows: vehicleRows } = await pool.query(
    `INSERT INTO vehicles (driver_id, category_id, registration_no, verification_status, is_active)
     SELECT $1, id, $2, 'approved', true FROM vehicle_categories WHERE name = 'Car' RETURNING id`,
    [userId, `DHAKA-PROMO-${userId}`],
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

// Keraniganj — ~8km+ from every other test file's coordinate cluster
// (Dhanmondi/Gulshan, Dhaka-center/Mirpur, Uttara, Jatrabari/Sayedabad),
// so a driver briefly online here can't be "nearby" for another file's
// concurrently-running dispatch (same reasoning as trips.test.js's own
// comment on its Uttara coordinates).
const PICKUP = { lat: 23.6850, lng: 90.3300 };
const DROPOFF = { lat: 23.6700, lng: 90.3500 };

async function createAssignedTrip(t, { promoCode, passenger: existingPassenger } = {}) {
  const passenger = existingPassenger ?? await createPassenger();
  const driver = await createOnlineDriver(t, { lat: PICKUP.lat, lng: PICKUP.lng });

  const { rows: cityRows } = await pool.query(`SELECT id FROM cities WHERE name = 'Dhaka'`);
  const booked = await request('POST', '/ride-requests', {
    accessToken: passenger.accessToken,
    body: {
      cityId: cityRows[0].id, categoryId: 3, pickup: PICKUP, dropoff: DROPOFF,
      paymentIntent: 'cash', ...(promoCode ? { promoCode } : {}),
    },
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

async function completeTrip(tripCode, driver) {
  await request('POST', `/trips/${tripCode}/arrived`, { accessToken: driver.accessToken });
  await request('POST', `/trips/${tripCode}/start`, { accessToken: driver.accessToken });
  return request('POST', `/trips/${tripCode}/complete`, { accessToken: driver.accessToken, body: {} });
}

// Books, dispatches, accepts, and completes one full trip in cash — the
// shared setup every redemption/receipt test starts from.
//
// ux_one_active_request_per_passenger (schema.sql) blocks a second
// ride_request while the first is still 'pending'/'searching'/'matched' —
// and nothing in rides.repository.js ever moves a request OUT of 'matched'
// except cancelTrip's explicit markCancelled. Completing a trip doesn't
// touch its own ride_request at all, so a passenger's first ride_request
// stays 'matched' forever and genuinely blocks booking a second one — a
// real, pre-existing bug (tests/api/trips.test.js's own
// "double-spend" test hit and documented this first; not something this
// task is fixing). first_ride_only/usage_limit_per_user redemption tests
// need the SAME passenger to complete more than one trip, so this frees
// the slot directly after every completion, the same workaround
// trips.test.js already uses.
async function bookAndComplete(t, { promoCode, passenger } = {}) {
  const setup = await createAssignedTrip(t, { promoCode, passenger });
  const completed = await completeTrip(setup.tripCode, setup.driver);
  assert.equal(completed.status, 200);
  await pool.query(
    `UPDATE ride_requests SET status = 'expired' WHERE id = (SELECT request_id FROM trips WHERE trip_code = $1)`,
    [setup.tripCode],
  );
  return { ...setup, response: await completed.json() };
}

async function createPromo(overrides = {}) {
  promoSeed += 1;
  const code = overrides.code ?? `PROMO${seed}${promoSeed}`;
  const { rows } = await pool.query(
    `INSERT INTO promo_codes
       (code, promo_type, value, max_discount, min_fare, usage_limit_total,
        usage_limit_per_user, first_ride_only, city_id, category_id,
        valid_from, valid_until, is_active)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     RETURNING id, code`,
    [
      code,
      overrides.promoType ?? 'fixed_amount',
      overrides.value ?? 50,
      overrides.maxDiscount ?? null,
      overrides.minFare ?? null,
      overrides.usageLimitTotal ?? null,
      overrides.usageLimitPerUser ?? null,
      overrides.firstRideOnly ?? false,
      overrides.cityId ?? null,
      overrides.categoryId ?? null,
      overrides.validFrom ?? new Date(Date.now() - 24 * 60 * 60 * 1000),
      overrides.validUntil ?? null,
      overrides.isActive ?? true,
    ],
  );
  return rows[0];
}

async function dhakaCityId() {
  const { rows } = await pool.query(`SELECT id FROM cities WHERE name = 'Dhaka'`);
  return rows[0].id;
}

// ---------------------------------------------------------------------------
// POST /promos/validate
// ---------------------------------------------------------------------------

test('POST /promos/validate requires a bearer token', async () => {
  const response = await request('POST', '/promos/validate', {
    body: { code: 'X', cityId: 1, categoryId: 3, estFare: 100 },
  });
  assert.equal(response.status, 401);
});

test('POST /promos/validate: unknown code is 404 PROMO_NOT_FOUND', async () => {
  const passenger = await createPassenger();
  const response = await request('POST', '/promos/validate', {
    accessToken: passenger.accessToken,
    body: { code: 'DOES-NOT-EXIST', cityId: 1, categoryId: 3, estFare: 500 },
  });
  assert.equal(response.status, 404);
  assert.equal((await response.json()).error.code, 'PROMO_NOT_FOUND');
});

test('POST /promos/validate: inactive code is 422 PROMO_NOT_APPLICABLE', async () => {
  const passenger = await createPassenger();
  const promo = await createPromo({ isActive: false });
  const response = await request('POST', '/promos/validate', {
    accessToken: passenger.accessToken,
    body: { code: promo.code, cityId: await dhakaCityId(), categoryId: 3, estFare: 500 },
  });
  assert.equal(response.status, 422);
  assert.equal((await response.json()).error.code, 'PROMO_NOT_APPLICABLE');
});

test('POST /promos/validate: expired code (valid_until in the past) is 422 PROMO_NOT_APPLICABLE', async () => {
  const passenger = await createPassenger();
  const promo = await createPromo({ validUntil: new Date(Date.now() - 60_000) });
  const response = await request('POST', '/promos/validate', {
    accessToken: passenger.accessToken,
    body: { code: promo.code, cityId: await dhakaCityId(), categoryId: 3, estFare: 500 },
  });
  assert.equal(response.status, 422);
  assert.equal((await response.json()).error.code, 'PROMO_NOT_APPLICABLE');
});

test('POST /promos/validate: scoped to a different category is 422 PROMO_NOT_APPLICABLE', async () => {
  const passenger = await createPassenger();
  const promo = await createPromo({ categoryId: 1 }); // Bike-only
  const response = await request('POST', '/promos/validate', {
    accessToken: passenger.accessToken,
    body: { code: promo.code, cityId: await dhakaCityId(), categoryId: 3, estFare: 500 }, // Car
  });
  assert.equal(response.status, 422);
  assert.equal((await response.json()).error.code, 'PROMO_NOT_APPLICABLE');
});

test('POST /promos/validate: fare below min_fare is 422 PROMO_NOT_APPLICABLE', async () => {
  const passenger = await createPassenger();
  const promo = await createPromo({ minFare: 1000 });
  const response = await request('POST', '/promos/validate', {
    accessToken: passenger.accessToken,
    body: { code: promo.code, cityId: await dhakaCityId(), categoryId: 3, estFare: 500 },
  });
  assert.equal(response.status, 422);
  assert.equal((await response.json()).error.code, 'PROMO_NOT_APPLICABLE');
});

test('POST /promos/validate: valid code returns a discount preview matching computeDiscount, percentage capped by maxDiscount', async () => {
  const passenger = await createPassenger();
  const promo = await createPromo({ promoType: 'percentage', value: 20, maxDiscount: 30 });
  const response = await request('POST', '/promos/validate', {
    accessToken: passenger.accessToken,
    body: { code: promo.code, cityId: await dhakaCityId(), categoryId: 3, estFare: 500 },
  });
  assert.equal(response.status, 200);
  const { data } = await response.json();
  assert.equal(data.code, promo.code);
  // 20% of 500 = 100, capped at maxDiscount 30.
  assert.equal(data.discount, 30);
  assert.equal(data.finalFare, 470);
  assert.equal(data.discount, computeDiscount({ promoType: 'percentage', value: 20, maxDiscount: 30 }, 500));
});

test('POST /promos/validate: usage_limit_total already reached is 409 PROMO_LIMIT_REACHED', async (t) => {
  const promo = await createPromo({ usageLimitTotal: 1 });
  await bookAndComplete(t, { promoCode: promo.code });

  const anotherPassenger = await createPassenger();
  const response = await request('POST', '/promos/validate', {
    accessToken: anotherPassenger.accessToken,
    body: { code: promo.code, cityId: await dhakaCityId(), categoryId: 3, estFare: 500 },
  });
  assert.equal(response.status, 409);
  assert.equal((await response.json()).error.code, 'PROMO_LIMIT_REACHED');
});

test('POST /promos/validate: usage_limit_per_user reached for this user is 409 PROMO_LIMIT_REACHED', async (t) => {
  const promo = await createPromo({ usageLimitPerUser: 1 });
  const { passenger } = await bookAndComplete(t, { promoCode: promo.code });

  const response = await request('POST', '/promos/validate', {
    accessToken: passenger.accessToken,
    body: { code: promo.code, cityId: await dhakaCityId(), categoryId: 3, estFare: 500 },
  });
  assert.equal(response.status, 409);
  assert.equal((await response.json()).error.code, 'PROMO_LIMIT_REACHED');
});

test('POST /promos/validate: first_ride_only is 422 PROMO_NOT_APPLICABLE for a passenger who already completed a trip', async (t) => {
  const { passenger } = await bookAndComplete(t, {}); // any completed trip, no promo
  const promo = await createPromo({ firstRideOnly: true });

  const response = await request('POST', '/promos/validate', {
    accessToken: passenger.accessToken,
    body: { code: promo.code, cityId: await dhakaCityId(), categoryId: 3, estFare: 500 },
  });
  assert.equal(response.status, 422);
  assert.equal((await response.json()).error.code, 'PROMO_NOT_APPLICABLE');
});

// ---------------------------------------------------------------------------
// GET /promos/available
// ---------------------------------------------------------------------------

test('GET /promos/available requires a bearer token', async () => {
  const response = await request('GET', '/promos/available?cityId=1');
  assert.equal(response.status, 401);
});

test('GET /promos/available requires cityId', async () => {
  const passenger = await createPassenger();
  const response = await request('GET', '/promos/available', { accessToken: passenger.accessToken });
  assert.equal(response.status, 422);
  assert.equal((await response.json()).error.code, 'VALIDATION_FAILED');
});

test('GET /promos/available lists active campaigns for the city, excluding inactive/expired ones', async () => {
  const cityId = await dhakaCityId();
  const passenger = await createPassenger();
  const active = await createPromo({ cityId });
  const inactive = await createPromo({ cityId, isActive: false });
  const expired = await createPromo({ cityId, validUntil: new Date(Date.now() - 60_000) });

  const response = await request('GET', `/promos/available?cityId=${cityId}`, { accessToken: passenger.accessToken });
  assert.equal(response.status, 200);
  const { data } = await response.json();
  const codes = data.map((row) => row.code);
  assert.ok(codes.includes(active.code));
  assert.ok(!codes.includes(inactive.code));
  assert.ok(!codes.includes(expired.code));
  assert.equal(codes.length, new Set(codes).size); // no duplicates from a bad JOIN
});

// ---------------------------------------------------------------------------
// Redemption at trip completion
// ---------------------------------------------------------------------------

test('a valid promo reduces the completed trip total and creates a promo_redemptions row', async (t) => {
  const promo = await createPromo({ promoType: 'fixed_amount', value: 50 });
  const { tripCode, passenger, response } = await bookAndComplete(t, { promoCode: promo.code });

  const { data } = response;
  assert.equal(data.fare.discount, '50.00');
  assert.equal(Number(data.fare.total), Number(data.fare.base) + Number(data.fare.distance)
    + Number(data.fare.time) + Number(data.fare.waiting) + Number(data.fare.surge)
    + Number(data.fare.bookingFee) - Number(data.fare.discount));

  const { rows } = await pool.query(
    `SELECT pr.discount_amount, pr.user_id, pr.promo_code_id
     FROM promo_redemptions pr JOIN trips t ON t.id = pr.trip_id
     WHERE t.trip_code = $1`,
    [tripCode],
  );
  assert.equal(rows.length, 1);
  assert.equal(Number(rows[0].discount_amount), 50);
  assert.equal(Number(rows[0].user_id), Number(passenger.userId));
  assert.equal(Number(rows[0].promo_code_id), Number(promo.id));
});

test('a percentage promo is capped by maxDiscount at redemption, matching the preview math', async (t) => {
  const promo = await createPromo({ promoType: 'percentage', value: 50, maxDiscount: 10 });
  const { response } = await bookAndComplete(t, { promoCode: promo.code });

  // 50% of any realistic fare here is well above 10 — the cap must bind.
  assert.equal(response.data.fare.discount, '10.00');
});

test('usage_limit_total: once reached, a further completion applies no discount and creates no redemption row', async (t) => {
  const promo = await createPromo({ usageLimitTotal: 1 });
  await bookAndComplete(t, { promoCode: promo.code }); // consumes the only slot

  const second = await bookAndComplete(t, { promoCode: promo.code });
  assert.equal(second.response.data.fare.discount, '0.00');

  const { rows } = await pool.query(
    `SELECT count(*)::int AS n FROM promo_redemptions WHERE promo_code_id = $1`,
    [promo.id],
  );
  assert.equal(rows[0].n, 1); // still just the first trip's row
});

test('usage_limit_per_user: once reached for a user, their next completion applies no discount', async (t) => {
  const promo = await createPromo({ usageLimitPerUser: 1 });
  const first = await bookAndComplete(t, { promoCode: promo.code });
  assert.notEqual(first.response.data.fare.discount, '0.00');

  const second = await bookAndComplete(t, { promoCode: promo.code, passenger: first.passenger });
  assert.equal(second.response.data.fare.discount, '0.00');
});

test('first_ride_only: only the passenger\'s first completed trip is discounted', async (t) => {
  const promo = await createPromo({ firstRideOnly: true, usageLimitPerUser: null });

  const first = await bookAndComplete(t, { promoCode: promo.code });
  assert.notEqual(first.response.data.fare.discount, '0.00');

  const second = await bookAndComplete(t, { promoCode: promo.code, passenger: first.passenger });
  assert.equal(second.response.data.fare.discount, '0.00');
});

test('a promo that expires between booking and completion silently applies no discount (does not fail the trip)', async (t) => {
  const promo = await createPromo({ validUntil: new Date(Date.now() + 60 * 60_000) });
  const setup = await createAssignedTrip(t, { promoCode: promo.code });

  // Simulate the code expiring in the gap between booking and completion.
  await pool.query(`UPDATE promo_codes SET valid_until = now() - interval '1 minute' WHERE id = $1`, [promo.id]);

  const completed = await completeTrip(setup.tripCode, setup.driver);
  assert.equal(completed.status, 200); // still succeeds — no PROMO_* error surfaced to the driver
  const { data } = await completed.json();
  assert.equal(data.fare.discount, '0.00');

  const { rows } = await pool.query(
    `SELECT count(*)::int AS n FROM promo_redemptions pr JOIN trips t ON t.id = pr.trip_id WHERE t.trip_code = $1`,
    [setup.tripCode],
  );
  assert.equal(rows[0].n, 0);
});

// ---------------------------------------------------------------------------
// Receipt row on completion
// ---------------------------------------------------------------------------

test('every completed trip gets a numbered receipt row matching the fare breakdown', async (t) => {
  const { tripCode, passenger, response } = await bookAndComplete(t, {});
  assert.match(response.data.receiptNo, /^JTR-\d{4}-\d{6}$/);

  const { rows } = await pool.query(
    `SELECT receipt_no, subtotal, discount, total, issued_to
     FROM receipts r JOIN trips t ON t.id = r.trip_id
     WHERE t.trip_code = $1`,
    [tripCode],
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].receipt_no, response.data.receiptNo);
  assert.equal(Number(rows[0].discount), 0);
  assert.equal(Number(rows[0].subtotal), Number(rows[0].total));
  assert.equal(Number(rows[0].total), Number(response.data.fare.total));
  assert.equal(Number(rows[0].issued_to), Number(passenger.userId));
});

test('a receipt for a discounted trip has subtotal = total + discount', async (t) => {
  const promo = await createPromo({ promoType: 'fixed_amount', value: 40 });
  const { tripCode, response } = await bookAndComplete(t, { promoCode: promo.code });
  assert.equal(response.data.fare.discount, '40.00');

  const { rows } = await pool.query(
    `SELECT subtotal, discount, total
     FROM receipts r JOIN trips t ON t.id = r.trip_id
     WHERE t.trip_code = $1`,
    [tripCode],
  );
  assert.equal(Number(rows[0].discount), 40);
  assert.equal(Number(rows[0].subtotal), Number(rows[0].total) + 40);
});

test('GET /trips/:code exposes the receipt link once the trip is completed', async (t) => {
  const { tripCode, passenger, response } = await bookAndComplete(t, {});

  const detail = await request('GET', `/trips/${tripCode}`, { accessToken: passenger.accessToken });
  assert.equal(detail.status, 200);
  const { data } = await detail.json();
  assert.equal(data.receipt.receiptNo, response.data.receiptNo);
  assert.ok(data.receipt.issuedAt);
});
