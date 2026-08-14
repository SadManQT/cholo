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

// Gulshan 2 -> Dhanmondi 27, roughly — kept fixed and mocked at the fetch
// boundary (mock.method can't patch a named ESM export, only object
// properties — see the Cannot redefine property TypeError otherwise) so
// this suite never depends on OSRM's public demo server being up.
const DEFAULT_ROUTE = { distanceMeters: 9210, durationSeconds: 540 }; // -> 9.21 km, 9 min
let routeResponse = DEFAULT_ROUTE;
let routeShouldFail = false;
let directRouteCrossesIndia = false;
let osrmFetchCount = 0;
let reverseCountryCode = 'bd';
const realFetch = globalThis.fetch;

before(async () => {
  databaseClient = await pool.connect();
  await databaseClient.query('BEGIN');

  mock.method(pool, 'query', (sql, values) => databaseClient.query(sql, values));
  mock.method(pool, 'connect', async () => {
    const savepointName = `rides_sp_${savepointCounter += 1}`;

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
      if (routeShouldFail) throw new Error('simulated OSRM outage');
      osrmFetchCount += 1;
      const encodedCoordinates = url.split('/route/v1/driving/')[1].split('?')[0];
      const coordinates = encodedCoordinates.split(';').map((pair) => pair.split(',').map(Number));
      const geometryCoordinates = directRouteCrossesIndia && coordinates.length === 2
        ? [coordinates[0], [91.2868, 23.8315], coordinates[1]] // Agartala, India
        : coordinates;
      return {
        ok: true,
        json: async () => ({
          code: 'Ok',
          routes: [{
            distance: routeResponse.distanceMeters,
            duration: routeResponse.durationSeconds,
            geometry: { coordinates: geometryCoordinates },
          }],
        }),
      };
    }
    if (typeof url === 'string' && url.startsWith(env.NOMINATIM_BASE_URL)) {
      if (url.includes('/search?')) {
        return {
          ok: true,
          json: async () => [{
            lat: '23.8103',
            lon: '90.4125',
            display_name: 'Gulshan, Dhaka, Bangladesh',
            address: { country_code: 'bd' },
          }],
        };
      }
      return {
        ok: true,
        json: async () => ({
          display_name: 'Dhanmondi, Dhaka, Bangladesh',
          address: { country_code: reverseCountryCode },
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
  routeShouldFail = false;
  directRouteCrossesIndia = false;
  osrmFetchCount = 0;
  reverseCountryCode = 'bd';
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

async function createUser({ roles = ['PASSENGER'] } = {}) {
  phoneCounter += 1;
  const phone = `019${String(20000000 + phoneCounter).slice(-8)}`;
  const { rows } = await databaseClient.query(
    `INSERT INTO users (full_name, phone, password_hash, phone_verified_at)
     VALUES ('Rides Test User', $1, 'test-hash', now())
     RETURNING id`,
    [phone],
  );
  const userId = rows[0].id;

  await databaseClient.query(
    `INSERT INTO user_roles (user_id, role_id)
     SELECT $1, id FROM roles WHERE name = ANY($2::varchar[])`,
    [userId, roles],
  );

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

const PICKUP = { lat: 23.7925, lng: 90.4078 };
const DROPOFF = { lat: 23.7461, lng: 90.3742 };

test('GET /geo/geocode and /geo/reverse expose authenticated address lookup', async () => {
  const passenger = await createUser();

  const geocoded = await request('GET', '/geo/geocode?query=Gulshan', { accessToken: passenger.accessToken });
  assert.equal(geocoded.status, 200);
  assert.deepEqual((await geocoded.json()).data, {
    lat: 23.8103,
    lng: 90.4125,
    address: 'Gulshan, Dhaka, Bangladesh',
  });

  const reversed = await request('GET', '/geo/reverse?lat=23.7461&lng=90.3742', { accessToken: passenger.accessToken });
  assert.equal(reversed.status, 200);
  assert.deepEqual((await reversed.json()).data, { address: 'Dhanmondi, Dhaka, Bangladesh' });
});

test('POST /geo/route returns the shortest road geometry to authenticated users', async () => {
  const passenger = await createUser();
  const response = await request('POST', '/geo/route', {
    accessToken: passenger.accessToken,
    body: { pickup: PICKUP, dropoff: DROPOFF },
  });

  assert.equal(response.status, 200);
  const { data } = await response.json();
  assert.equal(data.distanceKm, 9.21);
  assert.equal(data.durationMin, 9);
  assert.deepEqual(data.path, [PICKUP, DROPOFF]);
  assert.deepEqual(data.alternatives, []);
});

test('POST /geo/route discards a direct India shortcut and returns a Bangladesh-only fallback', async () => {
  const passenger = await createUser();
  directRouteCrossesIndia = true;

  const response = await request('POST', '/geo/route', {
    accessToken: passenger.accessToken,
    body: { pickup: PICKUP, dropoff: DROPOFF },
  });

  assert.equal(response.status, 200);
  const { data } = await response.json();
  assert.ok(osrmFetchCount > 1, 'cross-border direct route should trigger inland rerouting');
  assert.equal(data.path.some((point) => point.lat === 23.8315 && point.lng === 91.2868), false);
  assert.ok(data.path.length >= 3);
});

test('reverse geocoding rejects a point Nominatim identifies outside Bangladesh', async () => {
  const passenger = await createUser();
  reverseCountryCode = 'in';

  const response = await request('GET', '/geo/reverse?lat=23.7461&lng=90.3742', {
    accessToken: passenger.accessToken,
  });

  assert.equal(response.status, 422);
  assert.equal((await response.json()).error.code, 'OUTSIDE_SERVICE_AREA');
});

test('GET /geo/geocode protects the provider and validates the search query', async () => {
  const unauthenticated = await request('GET', '/geo/geocode?query=Gulshan');
  assert.equal(unauthenticated.status, 401);

  const passenger = await createUser();
  const malformed = await request('GET', '/geo/geocode?query=x', { accessToken: passenger.accessToken });
  assert.equal(malformed.status, 422);
  assert.equal((await malformed.json()).error.code, 'VALIDATION_FAILED');
});

test('POST /rides/quote requires a bearer token', async () => {
  const response = await request('POST', '/rides/quote', {
    body: { cityId: 1, categoryId: 1, pickup: PICKUP, dropoff: DROPOFF },
  });

  assert.equal(response.status, 401);
  assert.equal((await response.json()).error.code, 'AUTH_REQUIRED');
});

test('POST /rides/quote rejects a caller without the PASSENGER role', async () => {
  const driver = await createUser({ roles: ['DRIVER'] });
  const response = await request('POST', '/rides/quote', {
    accessToken: driver.accessToken,
    body: { cityId: 1, categoryId: 1, pickup: PICKUP, dropoff: DROPOFF },
  });

  assert.equal(response.status, 403);
  assert.equal((await response.json()).error.code, 'FORBIDDEN_ROLE');
});

test('POST /rides/quote returns 422 VALIDATION_FAILED for an out-of-range coordinate', async () => {
  const passenger = await createUser();
  const response = await request('POST', '/rides/quote', {
    accessToken: passenger.accessToken,
    body: { cityId: 1, categoryId: 1, pickup: { lat: 999, lng: 90 }, dropoff: DROPOFF },
  });

  assert.equal(response.status, 422);
  assert.equal((await response.json()).error.code, 'VALIDATION_FAILED');
});

test('POST /rides/quote rejects pickup or dropoff outside Bangladesh', async () => {
  const passenger = await createUser();
  const cityId = await dhakaCityId();
  const categoryId = await carCategoryId();

  const response = await request('POST', '/rides/quote', {
    accessToken: passenger.accessToken,
    body: {
      cityId,
      categoryId,
      pickup: PICKUP,
      dropoff: { lat: 28.6139, lng: 77.209 },
    },
  });

  assert.equal(response.status, 422);
  assert.equal((await response.json()).error.code, 'OUTSIDE_SERVICE_AREA');
});

test('POST /rides/quote returns 422 NO_TARIFF_FOR_MARKET when no pricing_rules row matches', async () => {
  const passenger = await createUser();
  const cityId = await dhakaCityId();

  const response = await request('POST', '/rides/quote', {
    accessToken: passenger.accessToken,
    body: { cityId, categoryId: 32_000, pickup: PICKUP, dropoff: DROPOFF }, // valid smallint, no such category
  });

  assert.equal(response.status, 422);
  assert.equal((await response.json()).error.code, 'NO_TARIFF_FOR_MARKET');
});

test('POST /rides/quote returns a fare breakdown that satisfies the same identity as chk_fare_identity', async () => {
  const passenger = await createUser();
  const cityId = await dhakaCityId();
  const categoryId = await carCategoryId();

  const response = await request('POST', '/rides/quote', {
    accessToken: passenger.accessToken,
    body: { cityId, categoryId, pickup: PICKUP, dropoff: DROPOFF },
  });

  assert.equal(response.status, 200);
  const { data } = await response.json();

  assert.equal(data.distanceKm, 9.21);
  assert.equal(data.durationMin, 9);
  assert.equal(data.currency, 'BDT');
  assert.equal(data.baseFare, 60); // seeded Dhaka/Car tariff, doc 01 §6.1
  assert.equal(data.distanceFare, 202.62); // 9.21 * 22
  assert.equal(data.timeFare, 22.5); // 9 * 2.5
  assert.equal(data.bookingFee, 10);

  const identitySum = data.baseFare + data.distanceFare + data.timeFare
    + data.waitingFare + data.surgeAmount + data.bookingFee - data.discountAmount;
  assert.equal(Math.round(identitySum * 100) / 100, data.totalFare);
});

test('POST /rides/quote surfaces GEO_PROVIDER_UNAVAILABLE when the geo adapter fails', async () => {
  const passenger = await createUser();
  const cityId = await dhakaCityId();
  const categoryId = await carCategoryId();

  routeShouldFail = true;

  const response = await request('POST', '/rides/quote', {
    accessToken: passenger.accessToken,
    body: { cityId, categoryId, pickup: PICKUP, dropoff: DROPOFF },
  });

  assert.equal(response.status, 503);
  assert.equal((await response.json()).error.code, 'GEO_PROVIDER_UNAVAILABLE');
});
