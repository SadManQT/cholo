import assert from 'node:assert/strict';
import { once } from 'node:events';
import { after, afterEach, before, beforeEach, mock, test } from 'node:test';

import app from '../../src/app.js';
import { pool } from '../../src/config/db.js';
import { env } from '../../src/config/env.js';
import { signAccessToken } from '../../src/utils/tokens.js';

let server;
let baseUrl;
let databaseClient;
let savepointCounter = 0;
let phoneCounter = 0;

// Gulshan 2 -> Dhanmondi 27 — fixed and mocked at the fetch boundary (see
// tests/api/rides.test.js for why mock.method can't patch geo.service.js's
// named export directly).
const DEFAULT_ROUTE = { distanceMeters: 9210, durationSeconds: 540 }; // 9.21 km, 9 min
let routeResponse = DEFAULT_ROUTE;
const realFetch = globalThis.fetch;

before(async () => {
  databaseClient = await pool.connect();
  await databaseClient.query('BEGIN');

  mock.method(pool, 'query', (sql, values) => databaseClient.query(sql, values));
  mock.method(pool, 'connect', async () => {
    const savepointName = `rr_sp_${savepointCounter += 1}`;

    return {
      async query(sql, values) {
        const command = typeof sql === 'string' ? sql.trim().toUpperCase() : '';
        if (command === 'BEGIN') return databaseClient.query(`SAVEPOINT ${savepointName}`);
        if (command === 'COMMIT') return databaseClient.query(`RELEASE SAVEPOINT ${savepointName}`);
        if (command === 'ROLLBACK') return databaseClient.query(`ROLLBACK TO SAVEPOINT ${savepointName}`);
        return databaseClient.query(sql, values);
      },
      release() {},
    };
  });
  mock.method(globalThis, 'fetch', async (url, options) => {
    if (typeof url === 'string' && url.startsWith(env.OSRM_BASE_URL)) {
      return {
        ok: true,
        json: async () => ({
          code: 'Ok',
          routes: [{ distance: routeResponse.distanceMeters, duration: routeResponse.durationSeconds, geometry: { coordinates: [[90.3742, 23.7461], [90.4078, 23.7925]] } }],
        }),
      };
    }
    return realFetch(url, options);
  });

  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

beforeEach(async () => {
  await databaseClient.query('SAVEPOINT test_savepoint');
});

afterEach(async () => {
  await databaseClient.query('ROLLBACK TO SAVEPOINT test_savepoint');
  routeResponse = DEFAULT_ROUTE;
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

// Direct SQL, not the real /auth/register flow — same convention
// tests/api/driver-onboarding.test.js uses for admin_profiles. This is
// exactly the row auth.service.js's register() now creates for every
// passenger (see the passengers.repository.js fix in this same change).
async function createUser({ roles = ['PASSENGER'] } = {}) {
  phoneCounter += 1;
  const phone = `019${String(30000000 + phoneCounter).slice(-8)}`;
  const { rows } = await databaseClient.query(
    `INSERT INTO users (full_name, phone, password_hash, phone_verified_at)
     VALUES ('Ride Request Test User', $1, 'test-hash', now())
     RETURNING id`,
    [phone],
  );
  const userId = rows[0].id;

  await databaseClient.query(
    `INSERT INTO user_roles (user_id, role_id)
     SELECT $1, id FROM roles WHERE name = ANY($2::varchar[])`,
    [userId, roles],
  );

  if (roles.includes('PASSENGER')) {
    await databaseClient.query(`INSERT INTO passenger_profiles (user_id) VALUES ($1)`, [userId]);
  }

  return { userId, accessToken: signAccessToken({ userId, roles, sessionId: userId }) };
}

async function dhakaCityId() {
  const { rows } = await databaseClient.query(`SELECT id FROM cities WHERE name = 'Dhaka'`);
  return rows[0].id;
}

async function carCategoryId() {
  const { rows } = await databaseClient.query(`SELECT id FROM vehicle_categories WHERE name = 'Car'`);
  return rows[0].id;
}

async function insertPromo({ code = 'WELCOME50', promoType = 'fixed_amount', value = 50, maxDiscount = null, minFare = null } = {}) {
  await databaseClient.query(
    `INSERT INTO promo_codes (code, promo_type, value, max_discount, min_fare, valid_from, valid_until, is_active)
     VALUES ($1, $2, $3, $4, $5, now() - interval '1 day', now() + interval '30 days', true)`,
    [code, promoType, value, maxDiscount, minFare],
  );
}

const PICKUP = { lat: 23.7925, lng: 90.4078, address: 'Gulshan 2 Circle' };
const DROPOFF = { lat: 23.7461, lng: 90.3742, address: 'House 27, Road 27, Dhanmondi' };

async function bookRide(passenger, overrides = {}) {
  const cityId = await dhakaCityId();
  const categoryId = await carCategoryId();

  return request('POST', '/ride-requests', {
    accessToken: passenger.accessToken,
    body: {
      cityId, categoryId, pickup: PICKUP, dropoff: DROPOFF, paymentIntent: 'cash', ...overrides,
    },
  });
}

test('POST /ride-requests requires a bearer token', async () => {
  const response = await bookRide({ accessToken: undefined });
  assert.equal(response.status, 401);
});

test('POST /ride-requests rejects a caller without the PASSENGER role', async () => {
  const driver = await createUser({ roles: ['DRIVER'] });
  const response = await bookRide(driver);
  assert.equal(response.status, 403);
  assert.equal((await response.json()).error.code, 'FORBIDDEN_ROLE');
});

test('POST /ride-requests returns 422 VALIDATION_FAILED when paymentIntent is missing', async () => {
  const passenger = await createUser();
  const cityId = await dhakaCityId();
  const categoryId = await carCategoryId();

  const response = await request('POST', '/ride-requests', {
    accessToken: passenger.accessToken,
    body: { cityId, categoryId, pickup: PICKUP, dropoff: DROPOFF },
  });

  assert.equal(response.status, 422);
  assert.equal((await response.json()).error.code, 'VALIDATION_FAILED');
});

test('POST /ride-requests returns 422 NO_TARIFF_FOR_MARKET when no pricing_rules row matches', async () => {
  const passenger = await createUser();
  const response = await bookRide(passenger, { categoryId: 32_000 });

  assert.equal(response.status, 422);
  assert.equal((await response.json()).error.code, 'NO_TARIFF_FOR_MARKET');
});

test('POST /ride-requests creates a searching request and snapshots the quote into the row', async () => {
  const passenger = await createUser();
  const response = await bookRide(passenger);

  assert.equal(response.status, 201);
  const { data } = await response.json();

  assert.equal(data.status, 'searching');
  assert.equal(data.quote.estFare, 295.12); // seeded Dhaka/Car tariff (doc 01 §6.1) at 9.21km/9min
  assert.equal(data.quote.estDiscount, 0);
  assert.equal(data.quote.estPayable, 295.12);
  assert.equal(data.quote.estDistanceKm, 9.21);
  assert.equal(data.quote.estDurationMin, 9);

  // expiresAt is exactly 5 minutes after requestedAt (doc 08-09-10 §10.1 worked example)
  const requestedAt = new Date(data.requestedAt).getTime();
  const expiresAt = new Date(data.expiresAt).getTime();
  assert.equal(expiresAt - requestedAt, 5 * 60_000);

  const { rows } = await databaseClient.query(
    `SELECT est_fare AS "estFare", pickup_address AS "pickupAddress", status
     FROM ride_requests WHERE public_id = $1`,
    [data.publicId],
  );
  assert.equal(Number(rows[0].estFare), 295.12);
  assert.equal(rows[0].pickupAddress, 'Gulshan 2 Circle');
  assert.equal(rows[0].status, 'searching');
});

test('POST /ride-requests leaves expiresAt null for a scheduled ride instead of the 5-minute immediate-ride window', async () => {
  const passenger = await createUser();
  const scheduledFor = new Date(Date.now() + 60 * 60_000).toISOString(); // +1 hour

  const response = await bookRide(passenger, { scheduledFor });

  assert.equal(response.status, 201);
  const { data } = await response.json();
  assert.equal(data.expiresAt, null);

  const { rows } = await databaseClient.query(
    `SELECT expires_at AS "expiresAt", scheduled_for AS "scheduledFor" FROM ride_requests WHERE public_id = $1`,
    [data.publicId],
  );
  assert.equal(rows[0].expiresAt, null);
  assert.ok(rows[0].scheduledFor);
});

test('POST /ride-requests snapshots est_fare — a later pricing_rules change does not retroactively alter it', async () => {
  const passenger = await createUser();
  const response = await bookRide(passenger);
  const { data } = await response.json();

  const categoryId = await carCategoryId();
  await databaseClient.query(`UPDATE pricing_rules SET base_fare = 9999 WHERE category_id = $1`, [categoryId]);

  const { rows } = await databaseClient.query(
    `SELECT est_fare AS "estFare" FROM ride_requests WHERE public_id = $1`,
    [data.publicId],
  );

  assert.equal(Number(rows[0].estFare), 295.12); // unchanged, despite the live tariff now saying otherwise
});

test('POST /ride-requests returns 409 ACTIVE_REQUEST_EXISTS for a second open request from the same passenger', async () => {
  const passenger = await createUser();
  const first = await bookRide(passenger);
  assert.equal(first.status, 201);

  const second = await bookRide(passenger);
  assert.equal(second.status, 409);
  assert.equal((await second.json()).error.code, 'ACTIVE_REQUEST_EXISTS');
});

test('POST /ride-requests: an existing scheduled ride does not block booking an immediate one', async () => {
  const passenger = await createUser();
  const scheduledFor = new Date(Date.now() + 60 * 60_000).toISOString();

  const scheduled = await bookRide(passenger, { scheduledFor });
  assert.equal(scheduled.status, 201);

  const immediate = await bookRide(passenger);
  assert.equal(immediate.status, 201); // not 409 — scheduled_for IS NULL scopes the one-active-request guard

  const { rows } = await databaseClient.query(
    `SELECT count(*)::int AS count FROM ride_requests WHERE passenger_id = $1 AND status = 'searching'`,
    [passenger.userId],
  );
  assert.equal(rows[0].count, 2);
});

test('POST /ride-requests: a second immediate request is still blocked while a scheduled one is also open', async () => {
  const passenger = await createUser();
  const scheduledFor = new Date(Date.now() + 60 * 60_000).toISOString();

  await bookRide(passenger, { scheduledFor });
  const firstImmediate = await bookRide(passenger);
  assert.equal(firstImmediate.status, 201);

  const secondImmediate = await bookRide(passenger);
  assert.equal(secondImmediate.status, 409);
  assert.equal((await secondImmediate.json()).error.code, 'ACTIVE_REQUEST_EXISTS');
});

test('POST /ride-requests applies a fixed_amount promo, capped so the payable amount never goes negative', async () => {
  await insertPromo({ code: 'WELCOME50', promoType: 'fixed_amount', value: 50, minFare: 100 });
  const passenger = await createUser();

  const response = await bookRide(passenger, { promoCode: 'welcome50' }); // lowercase on purpose

  assert.equal(response.status, 201);
  const { data } = await response.json();
  assert.equal(data.quote.estDiscount, 50);
  assert.equal(data.quote.estPayable, 245.12);

  const { rows } = await databaseClient.query(
    `SELECT promo_code_id AS "promoCodeId" FROM ride_requests WHERE public_id = $1`,
    [data.publicId],
  );
  assert.ok(rows[0].promoCodeId);
});

test('POST /ride-requests returns 422 PROMO_INVALID for a code that does not exist', async () => {
  const passenger = await createUser();
  const response = await bookRide(passenger, { promoCode: 'DOES-NOT-EXIST' });

  assert.equal(response.status, 422);
  assert.equal((await response.json()).error.code, 'PROMO_INVALID');
});

test('POST /ride-requests returns 422 PROMO_INVALID when the ride does not meet the promo min_fare', async () => {
  await insertPromo({ code: 'BIGSPEND', promoType: 'fixed_amount', value: 10, minFare: 100_000 });
  const passenger = await createUser();

  const response = await bookRide(passenger, { promoCode: 'BIGSPEND' });

  assert.equal(response.status, 422);
  assert.equal((await response.json()).error.code, 'PROMO_INVALID');
});

test('GET /ride-requests/:publicId lets the passenger recover searching state after a page reload', async () => {
  const passenger = await createUser();
  const booked = await bookRide(passenger);
  const created = (await booked.json()).data;

  const response = await request('GET', `/ride-requests/${created.publicId}`, {
    accessToken: passenger.accessToken,
  });

  assert.equal(response.status, 200);
  const { data } = await response.json();
  assert.equal(data.publicId, created.publicId);
  assert.equal(data.status, 'searching');
  assert.equal(data.pickup.address, PICKUP.address);
  assert.equal(data.dropoff.address, DROPOFF.address);
  assert.equal(data.tripCode, null);
});

test('DELETE /ride-requests/:publicId cancels only the owner\'s searching request', async () => {
  const passenger = await createUser();
  const stranger = await createUser();
  const booked = await bookRide(passenger);
  const created = (await booked.json()).data;

  const hidden = await request('DELETE', `/ride-requests/${created.publicId}`, {
    accessToken: stranger.accessToken,
  });
  assert.equal(hidden.status, 404);

  const cancelled = await request('DELETE', `/ride-requests/${created.publicId}`, {
    accessToken: passenger.accessToken,
  });
  assert.equal(cancelled.status, 200);
  assert.equal((await cancelled.json()).data.status, 'cancelled');

  const status = await request('GET', `/ride-requests/${created.publicId}`, {
    accessToken: passenger.accessToken,
  });
  assert.equal((await status.json()).data.status, 'cancelled');
});
