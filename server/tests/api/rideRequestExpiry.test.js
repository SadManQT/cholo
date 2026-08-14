import assert from 'node:assert/strict';
import { once } from 'node:events';
import { after, afterEach, before, beforeEach, mock, test } from 'node:test';

import app from '../../src/app.js';
import { pool } from '../../src/config/db.js';
import { env } from '../../src/config/env.js';
import * as ridesService from '../../src/services/rides.service.js';
import { signAccessToken } from '../../src/utils/tokens.js';

// Same savepoint-mocked pool as tests/api/ride-requests.test.js: expiry
// never creates a trip (no append-only trigger in the way), so nothing here
// needs to be left behind in the dev DB — every test rolls itself back.
let server;
let baseUrl;
let databaseClient;
let savepointCounter = 0;
let phoneCounter = 0;

const DEFAULT_ROUTE = { distanceMeters: 9210, durationSeconds: 540 };
let routeResponse = DEFAULT_ROUTE;
const realFetch = globalThis.fetch;

before(async () => {
  databaseClient = await pool.connect();
  await databaseClient.query('BEGIN');

  mock.method(pool, 'query', (sql, values) => databaseClient.query(sql, values));
  mock.method(pool, 'connect', async () => {
    const savepointName = `rre_sp_${savepointCounter += 1}`;

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

async function createPassenger() {
  phoneCounter += 1;
  const phone = `019${String(40000000 + phoneCounter).slice(-8)}`;
  const { rows } = await databaseClient.query(
    `INSERT INTO users (full_name, phone, password_hash, phone_verified_at)
     VALUES ('Expiry Test Passenger', $1, 'test-hash', now())
     RETURNING id`,
    [phone],
  );
  const userId = rows[0].id;
  await databaseClient.query(`INSERT INTO user_roles (user_id, role_id) SELECT $1, id FROM roles WHERE name = 'PASSENGER'`, [userId]);
  await databaseClient.query(`INSERT INTO passenger_profiles (user_id) VALUES ($1)`, [userId]);

  return { userId, accessToken: signAccessToken({ userId, roles: ['PASSENGER'], sessionId: userId }) };
}

async function createOnlineDriver({ lat, lng }) {
  phoneCounter += 1;
  const phone = `018${String(40000000 + phoneCounter).slice(-8)}`;
  const { rows } = await databaseClient.query(
    `INSERT INTO users (full_name, phone, password_hash, phone_verified_at)
     VALUES ('Expiry Test Driver', $1, 'test-hash', now()) RETURNING id`,
    [phone],
  );
  const userId = rows[0].id;
  await databaseClient.query(`INSERT INTO user_roles (user_id, role_id) SELECT $1, id FROM roles WHERE name = 'DRIVER'`, [userId]);
  await databaseClient.query(
    `INSERT INTO driver_profiles (user_id, nid_number, license_number, license_expiry, verification_status)
     VALUES ($1, $2, $3, '2035-12-31', 'approved')`,
    [userId, String(userId).padStart(10, '0'), `DL-EXP-${userId}`],
  );
  const { rows: vehicleRows } = await databaseClient.query(
    `INSERT INTO vehicles (driver_id, category_id, registration_no, verification_status, is_active)
     SELECT $1, id, $2, 'approved', true FROM vehicle_categories WHERE name = 'Car' RETURNING id`,
    [userId, `DHAKA-EXP-${userId}`],
  );
  await databaseClient.query(`UPDATE driver_profiles SET active_vehicle_id = $2 WHERE user_id = $1`, [userId, vehicleRows[0].id]);
  await databaseClient.query(
    `UPDATE driver_availability SET status = 'online', current_lat = $2, current_lng = $3 WHERE driver_id = $1`,
    [userId, lat, lng],
  );

  return { userId };
}

async function dhakaCityId() {
  const { rows } = await databaseClient.query(`SELECT id FROM cities WHERE name = 'Dhaka'`);
  return rows[0].id;
}

async function carCategoryId() {
  const { rows } = await databaseClient.query(`SELECT id FROM vehicle_categories WHERE name = 'Car'`);
  return rows[0].id;
}

const PICKUP = { lat: 23.7925, lng: 90.4078, address: 'Gulshan 2 Circle' };
const DROPOFF = { lat: 23.7461, lng: 90.3742, address: 'House 27, Road 27, Dhanmondi' };

async function bookRide(passenger) {
  const cityId = await dhakaCityId();
  const categoryId = await carCategoryId();

  return request('POST', '/ride-requests', {
    accessToken: passenger.accessToken,
    body: { cityId, categoryId, pickup: PICKUP, dropoff: DROPOFF, paymentIntent: 'cash' },
  });
}

test('expireStaleRequests leaves a request alone while expires_at is still in the future', async () => {
  const passenger = await createPassenger();
  const booked = await bookRide(passenger);
  const { data } = await booked.json();

  const expired = await ridesService.expireStaleRequests();
  assert.ok(!expired.some((row) => row.publicId === data.publicId));

  const { rows } = await databaseClient.query(`SELECT status FROM ride_requests WHERE public_id = $1`, [data.publicId]);
  assert.equal(rows[0].status, 'searching');
});

test('expireStaleRequests flips a stale searching request to expired and times out its pending offers', async () => {
  const passenger = await createPassenger();
  const driver = await createOnlineDriver({ lat: PICKUP.lat, lng: PICKUP.lng });

  const booked = await bookRide(passenger);
  const { data } = await booked.json();

  await databaseClient.query(
    `UPDATE ride_requests SET expires_at = now() - INTERVAL '1 second' WHERE public_id = $1`,
    [data.publicId],
  );

  const expired = await ridesService.expireStaleRequests();
  assert.ok(expired.some((row) => row.publicId === data.publicId));

  const { rows: requestRows } = await databaseClient.query(
    `SELECT status FROM ride_requests WHERE public_id = $1`,
    [data.publicId],
  );
  assert.equal(requestRows[0].status, 'expired');

  const { rows: offerRows } = await databaseClient.query(
    `SELECT response FROM ride_offers ro JOIN ride_requests rr ON rr.id = ro.request_id
     WHERE rr.public_id = $1 AND ro.driver_id = $2`,
    [data.publicId, driver.userId],
  );
  assert.equal(offerRows[0].response, 'timed_out');
});

test('expireStaleRequests never touches a scheduled request (expires_at is NULL, not just far away)', async () => {
  const passenger = await createPassenger();
  const cityId = await dhakaCityId();
  const categoryId = await carCategoryId();
  const scheduledFor = new Date(Date.now() + 60 * 60_000).toISOString();

  const booked = await request('POST', '/ride-requests', {
    accessToken: passenger.accessToken,
    body: {
      cityId, categoryId, pickup: PICKUP, dropoff: DROPOFF, paymentIntent: 'cash', scheduledFor,
    },
  });
  const { data } = await booked.json();

  const expired = await ridesService.expireStaleRequests();
  assert.ok(!expired.some((row) => row.publicId === data.publicId));

  // insertRequest (rides.repository.js) always writes 'searching' regardless
  // of scheduled_for — expires_at IS NULL is what actually makes a
  // scheduled request immune to this sweep, not its status.
  const { rows } = await databaseClient.query(`SELECT status FROM ride_requests WHERE public_id = $1`, [data.publicId]);
  assert.equal(rows[0].status, 'searching');
});
