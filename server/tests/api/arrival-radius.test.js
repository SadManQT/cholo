import assert from 'node:assert/strict';
import { once } from 'node:events';
import { rm } from 'node:fs/promises';
import { after, afterEach, before, beforeEach, mock, test } from 'node:test';

process.env.ARRIVAL_RADIUS_METERS = '300';

const { default: app } = await import('../../src/app.js');
const { pool } = await import('../../src/config/db.js');
const { env } = await import('../../src/config/env.js');
const { logger } = await import('../../src/utils/logger.js');
const { signAccessToken } = await import('../../src/utils/tokens.js');
const { haversineDistanceKm, pathDistanceKm } = await import('../../src/utils/haversine.js');

let server;
let baseUrl;
let db;
let savepointCounter = 0;
let phoneCounter = 0;
const osrmUrls = [];
const realFetch = globalThis.fetch;

before(async () => {
  db = await pool.connect();
  await db.query('BEGIN');
  mock.method(pool, 'query', async (sql, values) => {
    await db.query('SAVEPOINT radius_query');
    try {
      const result = await db.query(sql, values);
      await db.query('RELEASE SAVEPOINT radius_query');
      return result;
    } catch (error) {
      await db.query('ROLLBACK TO SAVEPOINT radius_query');
      throw error;
    }
  });
  mock.method(pool, 'connect', async () => {
    const savepoint = `radius_sp_${savepointCounter += 1}`;
    return {
      async query(sql, values) {
        const command = typeof sql === 'string' ? sql.trim().toUpperCase() : '';
        if (command === 'BEGIN') return db.query(`SAVEPOINT ${savepoint}`);
        if (command === 'COMMIT') return db.query(`RELEASE SAVEPOINT ${savepoint}`);
        if (command === 'ROLLBACK') return db.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
        return db.query(sql, values);
      },
      release() {},
    };
  });
  mock.method(globalThis, 'fetch', async (url, options) => {
    if (typeof url === 'string' && url.startsWith(env.OSRM_BASE_URL)) {
      osrmUrls.push(url);
      const coordinates = url.split('/route/v1/driving/')[1].split('?')[0].split(';');
      const distance = 9210 + (coordinates.length - 2) * 3000;
      return {
        ok: true,
        json: async () => ({
          code: 'Ok',
          routes: [{ distance, duration: 540, geometry: { coordinates: [[90.3742, 23.7461], [90.4078, 23.7925]] } }],
        }),
      };
    }
    return realFetch(url, options);
  });
  mock.method(logger, 'info', () => {});
  mock.method(logger, 'error', () => {});
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

beforeEach(() => db.query('SAVEPOINT radius_test'));
afterEach(() => db.query('ROLLBACK TO SAVEPOINT radius_test'));

after(async () => {
  server.close();
  await once(server, 'close');
  mock.restoreAll();
  await db.query('ROLLBACK');
  db.release();
  await pool.end();
});

function call(method, path, { body, token, raw, contentType } = {}) {
  const headers = {};
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (raw !== undefined) headers['content-type'] = contentType;
  if (token) headers.authorization = `Bearer ${token}`;
  return realFetch(`${baseUrl}/api/v1${path}`, {
    method,
    headers,
    body: raw ?? (body === undefined ? undefined : JSON.stringify(body)),
  });
}

async function riderConfirmsPickup(tripCode) {
  const { rows } = await pool.query(`SELECT passenger_id FROM trips WHERE trip_code = $1`, [tripCode]);
  const userId = Number(rows[0].passenger_id);
  const response = await call('POST', `/trips/${tripCode}/pickup/confirm`, {
    token: signAccessToken({ userId, roles: ['PASSENGER'], sessionId: userId }),
  });
  assert.equal(response.status, 200);
  return response;
}

function nextPhone() {
  phoneCounter += 1;
  return `0163${String(phoneCounter).padStart(7, '0')}`;
}

async function createUser(roles = ['PASSENGER'], { accessLevel } = {}) {
  const phone = nextPhone();
  const { rows } = await db.query(
    `INSERT INTO users (full_name, phone, password_hash, phone_verified_at, gender)
     VALUES ('Feature User', $1, 'test-hash', now(), 'female') RETURNING id`,
    [phone],
  );
  const userId = Number(rows[0].id);
  await db.query(
    `INSERT INTO user_roles (user_id, role_id) SELECT $1, id FROM roles WHERE name = ANY($2::varchar[])`,
    [userId, roles],
  );
  if (roles.includes('PASSENGER')) await db.query(`INSERT INTO passenger_profiles (user_id) VALUES ($1)`, [userId]);
  if (accessLevel) {
    await db.query(`INSERT INTO admin_profiles (user_id, access_level) VALUES ($1, $2)`, [userId, accessLevel]);
  }
  return { userId, phone, token: signAccessToken({ userId, roles, sessionId: userId }) };
}

async function createOnlineDriver({ lat = 23.7925, lng = 90.4078 } = {}) {
  const driver = await createUser(['DRIVER']);
  await db.query(
    `INSERT INTO driver_profiles (user_id, nid_number, license_number, license_expiry, verification_status)
     VALUES ($1, $2, $3, current_date + 365, 'approved')`,
    [driver.userId, String(driver.userId).padStart(10, '0'), `FP-LIC-${driver.userId}`],
  );
  const { rows } = await db.query(
    `INSERT INTO vehicles (driver_id, category_id, registration_no, verification_status, is_active)
     SELECT $1, id, $2, 'approved', true FROM vehicle_categories WHERE name = 'Car' RETURNING id`,
    [driver.userId, `FP-REG-${driver.userId}`],
  );
  await db.query(`UPDATE driver_profiles SET active_vehicle_id = $2 WHERE user_id = $1`, [driver.userId, rows[0].id]);
  await db.query(
    `UPDATE driver_availability SET status = 'online', current_lat = $2, current_lng = $3, last_ping_at = now() WHERE driver_id = $1`,
    [driver.userId, lat, lng],
  );
  return driver;
}

async function market() {
  const { rows } = await db.query(
    `SELECT c.id AS "cityId", vc.id AS "categoryId" FROM cities c CROSS JOIN vehicle_categories vc
     WHERE c.name = 'Dhaka' AND vc.name = 'Car'`,
  );
  return rows[0];
}

const PICKUP = { lat: 23.7925, lng: 90.4078, address: 'Gulshan 2 Circle' };
const DROPOFF = { lat: 23.7461, lng: 90.3742, address: 'Dhanmondi 27' };
const STOP = { lat: 23.7806, lng: 90.4193, address: 'Badda Link Road' };

async function book(passenger, extra = {}) {
  const response = await call('POST', '/ride-requests', {
    token: passenger.token,
    body: { ...(await market()), pickup: PICKUP, dropoff: DROPOFF, paymentIntent: 'cash', ...extra },
  });
  return { response, body: await response.json() };
}

async function pendingOffersFor(driverId) {
  const { rows } = await db.query(
    `SELECT id, request_id AS "requestId", round FROM ride_offers WHERE driver_id = $1 AND response = 'pending'`,
    [driverId],
  );
  return rows;
}

async function ageOffers(requestPublicId) {
  await db.query(
    `UPDATE ride_offers SET offered_at = now() - interval '20 seconds'
     WHERE request_id = (SELECT id FROM ride_requests WHERE public_id = $1)`,
    [requestPublicId],
  );
}

async function acceptAndComplete(driver, offerId) {
  const accepted = await call('POST', `/driver/offers/${offerId}/respond`, { token: driver.token, body: { response: 'accepted' } });
  assert.equal(accepted.status, 200);
  const tripCode = (await accepted.json()).data.trip.publicCode;
  await call('POST', `/trips/${tripCode}/arrived`, { token: driver.token });
  await riderConfirmsPickup(tripCode);
  await call('POST', `/trips/${tripCode}/start`, { token: driver.token });
  return tripCode;
}

test('drivers can only mark arrival, reach a stop and complete within 300 m of the place', async () => {
  const rider = await createUser();
  const driver = await createOnlineDriver({ lat: 23.80, lng: 90.41 });
  await book(rider, { stops: [STOP] });
  const offer = (await pendingOffersFor(driver.userId))[0];
  const accepted = await (await call('POST', `/driver/offers/${offer.id}/respond`, { token: driver.token, body: { response: 'accepted' } })).json();
  const code = accepted.data.trip.publicCode;

  const far = await call('POST', `/trips/${code}/arrived`, { token: driver.token });
  assert.equal(far.status, 422);
  const farBody = (await far.json()).error;
  assert.equal(farBody.code, 'TOO_FAR_FROM_PICKUP');
  assert.ok(farBody.details.distanceMeters > 800);
  assert.equal(farBody.details.radiusMeters, 300);

  await db.query(`UPDATE driver_availability SET last_ping_at = now() - interval '10 minutes' WHERE driver_id = $1`, [driver.userId]);
  assert.equal((await (await call('POST', `/trips/${code}/arrived`, { token: driver.token })).json()).error.code, 'LOCATION_NEEDED_TO_ARRIVE');

  assert.equal((await call('POST', `/trips/${code}/arrived`, { token: driver.token, body: { lat: PICKUP.lat + 0.0009, lng: PICKUP.lng } })).status, 200);
  await riderConfirmsPickup(code);
  assert.equal((await call('POST', `/trips/${code}/start`, { token: driver.token })).status, 200);

  assert.equal((await (await call('POST', `/trips/${code}/stops/1/arrived`, { token: driver.token, body: PICKUP })).json()).error.code, 'TOO_FAR_FROM_STOP');
  assert.equal((await call('POST', `/trips/${code}/stops/1/arrived`, { token: driver.token, body: { lat: STOP.lat, lng: STOP.lng } })).status, 200);

  assert.equal((await (await call('POST', `/trips/${code}/complete`, { token: driver.token, body: { lat: STOP.lat, lng: STOP.lng } })).json()).error.code, 'TOO_FAR_FROM_DROPOFF');
  const done = await call('POST', `/trips/${code}/complete`, { token: driver.token, body: { lat: DROPOFF.lat, lng: DROPOFF.lng - 0.002 } });
  assert.equal(done.status, 200);

  const detail = await (await call('GET', `/trips/${code}`, { token: driver.token })).json();
  assert.equal(detail.data.arrivalRadiusMeters, 300);
});

test('"Stop here": only the rider can ask, only during the ride, and the driver is told', async () => {
  const rider = await createUser();
  const driver = await createOnlineDriver({ lat: PICKUP.lat, lng: PICKUP.lng });
  await book(rider);
  const offer = (await pendingOffersFor(driver.userId))[0];
  const accepted = await (await call('POST', `/driver/offers/${offer.id}/respond`, { token: driver.token, body: { response: 'accepted' } })).json();
  const code = accepted.data.trip.publicCode;

  assert.equal((await (await call('POST', `/trips/${code}/stop-request`, { token: rider.token })).json()).error.code, 'BAD_TRANSITION');
  await call('POST', `/trips/${code}/arrived`, { token: driver.token, body: PICKUP });
  await riderConfirmsPickup(code);
  await call('POST', `/trips/${code}/start`, { token: driver.token });

  assert.equal((await call('POST', `/trips/${code}/stop-request`, { token: driver.token })).status, 403);
  const stranger = await createUser();
  assert.equal((await call('POST', `/trips/${code}/stop-request`, { token: stranger.token })).status, 404);

  const asked = await call('POST', `/trips/${code}/stop-request`, { token: rider.token });
  assert.equal(asked.status, 200);
  const askedAt = (await asked.json()).data.earlyStopRequestedAt;
  assert.ok(askedAt);
  assert.equal((await (await call('POST', `/trips/${code}/stop-request`, { token: rider.token })).json()).data.earlyStopRequestedAt, askedAt);
  const { rows: inbox } = await db.query(
    `SELECT title FROM notifications WHERE user_id = $1 AND title = 'Your rider wants to get out here'`,
    [driver.userId],
  );
  assert.equal(inbox.length, 1);
  const detail = (await (await call('GET', `/trips/${code}`, { token: driver.token })).json()).data;
  assert.equal(detail.earlyStopRequestedAt, askedAt);
});

test('"End trip here": refused until the rider asks, then charges the route actually driven and tells the rider', async () => {
  const rider = await createUser();
  const driver = await createOnlineDriver({ lat: PICKUP.lat, lng: PICKUP.lng });
  const { body: booked } = await book(rider);
  const planned = booked.data.quote.estFare;
  const offer = (await pendingOffersFor(driver.userId))[0];
  const accepted = await (await call('POST', `/driver/offers/${offer.id}/respond`, { token: driver.token, body: { response: 'accepted' } })).json();
  const code = accepted.data.trip.publicCode;
  await call('POST', `/trips/${code}/arrived`, { token: driver.token, body: PICKUP });
  await riderConfirmsPickup(code);
  await call('POST', `/trips/${code}/start`, { token: driver.token });

  const midway = { lat: 23.7700, lng: 90.3900 };
  const refused = await call('POST', `/trips/${code}/complete`, { token: driver.token, body: { endEarly: true, ...midway } });
  assert.equal(refused.status, 409);
  assert.equal((await refused.json()).error.code, 'EARLY_STOP_NOT_REQUESTED');

  assert.equal((await call('POST', `/trips/${code}/stop-request`, { token: rider.token })).status, 200);
  osrmUrls.length = 0;
  const ended = await call('POST', `/trips/${code}/complete`, { token: driver.token, body: { endEarly: true, ...midway } });
  assert.equal(ended.status, 200);
  const endedBody = (await ended.json()).data;
  assert.equal(endedBody.endedEarly, true);
  assert.ok(osrmUrls[0].includes(`${midway.lng},${midway.lat}`), 'priced to where the rider got out');

  const detail = (await (await call('GET', `/trips/${code}`, { token: rider.token })).json()).data;
  assert.equal(detail.endedEarly.lat, midway.lat);
  assert.ok(Number(detail.fare.total) <= planned);
  const { rows: inbox } = await db.query(`SELECT title FROM notifications WHERE user_id = $1`, [rider.userId]);
  assert.ok(inbox.some((row) => row.title === 'Your trip ended before the planned drop-off'));
  const { rows: audit } = await db.query(`SELECT action FROM audit_logs WHERE action = 'TRIP_ENDED_EARLY' AND actor_id = $1`, [driver.userId]);
  assert.equal(audit.length, 1);
});

async function startedTripWithStopRequest() {
  const rider = await createUser();
  const driver = await createOnlineDriver({ lat: PICKUP.lat, lng: PICKUP.lng });
  await book(rider);
  const offer = (await pendingOffersFor(driver.userId))[0];
  const accepted = await (await call('POST', `/driver/offers/${offer.id}/respond`, { token: driver.token, body: { response: 'accepted' } })).json();
  const code = accepted.data.trip.publicCode;
  await call('POST', `/trips/${code}/arrived`, { token: driver.token, body: PICKUP });
  await call('POST', `/trips/${code}/start`, { token: driver.token });
  await riderConfirmsPickup(code);
  await call('POST', `/trips/${code}/stop-request`, { token: rider.token });
  const { rows } = await db.query(`SELECT id FROM trips WHERE trip_code = $1`, [code]);
  return { driver, code, tripId: rows[0].id };
}

async function drive(tripId, points) {
  for (const [index, point] of points.entries()) {
    await db.query(
      `INSERT INTO trip_location_pings (trip_id, lat, lng, recorded_at) VALUES ($1, $2, $3, now() + make_interval(secs => $4))`,
      [tripId, point.lat, point.lng, index + 1],
    );
  }
}

const line = (from, to, steps) => Array.from({ length: steps + 1 }, (_, i) => ({
  lat: from.lat + ((to.lat - from.lat) * i) / steps, lng: from.lng + ((to.lng - from.lng) * i) / steps,
}));

test('"End trip here" charges the GPS distance actually driven, not the planned route', async () => {
  const { driver, code, tripId } = await startedTripWithStopRequest();
  const midway = { lat: 23.7700, lng: 90.3900 };
  await drive(tripId, line(PICKUP, midway, 10));
  const ended = await call('POST', `/trips/${code}/complete`, { token: driver.token, body: { endEarly: true, ...midway } });
  assert.equal(ended.status, 200);

  const straightKm = haversineDistanceKm(PICKUP.lat, PICKUP.lng, midway.lat, midway.lng);
  const { rows } = await db.query(`SELECT actual_distance_km::float8 AS km FROM trips WHERE id = $1`, [tripId]);
  assert.ok(Math.abs(rows[0].km - straightKm) < 0.05, `charged ${rows[0].km} km for ~${straightKm.toFixed(2)} km driven (route says 9.21)`);
});

test('"End trip here": a long detour is capped at the route plus 25%', async () => {
  const { driver, code, tripId } = await startedTripWithStopRequest();
  const midway = { lat: 23.7700, lng: 90.3900 };
  const faraway = { lat: 23.9500, lng: 90.5500 };
  await drive(tripId, [...line(PICKUP, faraway, 5), ...line(faraway, midway, 5)]);
  await call('POST', `/trips/${code}/complete`, { token: driver.token, body: { endEarly: true, ...midway } });
  const { rows } = await db.query(`SELECT actual_distance_km::float8 AS km FROM trips WHERE id = $1`, [tripId]);
  assert.equal(rows[0].km, 11.51);
});

test('pathDistanceKm ignores GPS jitter while standing still', () => {
  const parked = Array.from({ length: 50 }, (_, i) => ({ lat: PICKUP.lat + (i % 2) * 0.00005, lng: PICKUP.lng }));
  assert.equal(pathDistanceKm(parked), 0);
});

test('"End trip here" at the drop-off is just a normal completion', async () => {
  const rider = await createUser();
  const driver = await createOnlineDriver({ lat: PICKUP.lat, lng: PICKUP.lng });
  await book(rider);
  const offer = (await pendingOffersFor(driver.userId))[0];
  const accepted = await (await call('POST', `/driver/offers/${offer.id}/respond`, { token: driver.token, body: { response: 'accepted' } })).json();
  const code = accepted.data.trip.publicCode;
  await call('POST', `/trips/${code}/arrived`, { token: driver.token, body: PICKUP });
  await riderConfirmsPickup(code);
  await call('POST', `/trips/${code}/start`, { token: driver.token });
  const ended = await (await call('POST', `/trips/${code}/complete`, { token: driver.token, body: { endEarly: true, lat: DROPOFF.lat, lng: DROPOFF.lng } })).json();
  assert.equal(ended.data.endedEarly, false);
});

test('after the rider asks to stop, a plain "Complete trip" away from the drop-off is billed as ended early', async () => {
  const { driver, code, tripId } = await startedTripWithStopRequest();
  const midway = { lat: 23.7700, lng: 90.3900 };
  await drive(tripId, line(PICKUP, midway, 10));
  const completed = await call('POST', `/trips/${code}/complete`, { token: driver.token, body: { ...midway } });
  assert.equal(completed.status, 200);
  const { data } = await completed.json();
  assert.equal(data.endedEarly, true);

  const straightKm = haversineDistanceKm(PICKUP.lat, PICKUP.lng, midway.lat, midway.lng);
  const { rows } = await db.query(`SELECT actual_distance_km::float8 AS km, ended_early_at FROM trips WHERE id = $1`, [tripId]);
  assert.ok(Math.abs(rows[0].km - straightKm) < 0.05, `charged ${rows[0].km} km for ~${straightKm.toFixed(2)} km driven`);
  assert.ok(rows[0].ended_early_at);
});

test('after the rider asks to stop, a driver with no live GPS is billed from the last point of the ride', async () => {
  const { driver, code, tripId } = await startedTripWithStopRequest();
  const midway = { lat: 23.7700, lng: 90.3900 };
  await drive(tripId, line(PICKUP, midway, 10));
  await db.query(`UPDATE driver_availability SET last_ping_at = now() - interval '1 hour' WHERE driver_id = $1`, [driver.userId]);

  const completed = await call('POST', `/trips/${code}/complete`, { token: driver.token, body: {} });
  assert.equal(completed.status, 200);
  assert.equal((await completed.json()).data.endedEarly, true);
  const { rows } = await db.query(`SELECT end_lat::float8 AS lat, end_lng::float8 AS lng FROM trips WHERE id = $1`, [tripId]);
  assert.deepEqual({ ...rows[0] }, midway);
});

test('without a stop request, "Complete trip" away from the drop-off is still refused', async () => {
  const rider = await createUser();
  const driver = await createOnlineDriver({ lat: PICKUP.lat, lng: PICKUP.lng });
  await book(rider);
  const offer = (await pendingOffersFor(driver.userId))[0];
  const accepted = await (await call('POST', `/driver/offers/${offer.id}/respond`, { token: driver.token, body: { response: 'accepted' } })).json();
  const code = accepted.data.trip.publicCode;
  await call('POST', `/trips/${code}/arrived`, { token: driver.token, body: PICKUP });
  await riderConfirmsPickup(code);
  await call('POST', `/trips/${code}/start`, { token: driver.token });
  const refused = await call('POST', `/trips/${code}/complete`, { token: driver.token, body: { lat: 23.7700, lng: 90.3900 } });
  assert.equal(refused.status, 422);
  assert.equal((await refused.json()).error.code, 'TOO_FAR_FROM_DROPOFF');
});
