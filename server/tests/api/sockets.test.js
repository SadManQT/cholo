import assert from 'node:assert/strict';
import { randomInt } from 'node:crypto';
import { once } from 'node:events';
import http from 'node:http';
import { after, before, mock, test } from 'node:test';

import { io as ioClient } from 'socket.io-client';

import app from '../../src/app.js';
import { pool } from '../../src/config/db.js';
import { env } from '../../src/config/env.js';
import { attachSocketServer } from '../../src/sockets/index.js';
import { signAccessToken } from '../../src/utils/tokens.js';

// Real pool + real OSRM, no cleanup of trip-anchored fixtures — same
// reasoning as tests/api/dispatch.test.js and tests/api/trips.test.js:
// trip_status_history's append-only trigger makes a created trip
// permanently undeletable, so these fixtures are meant to be left in the
// disposable dev DB.
let server;
let baseUrl;
let wsUrl;
let seed = randomInt(10_000_000, 100_000_000);
const realFetch = globalThis.fetch;

before(async () => {
  mock.method(globalThis, 'fetch', async (url, options) => {
    if (typeof url === 'string' && url.startsWith(env.OSRM_BASE_URL)) {
      return { ok: true, json: async () => ({ code: 'Ok', routes: [{ distance: 1500, duration: 300, geometry: { coordinates: [[90.3742, 23.7461], [90.4078, 23.7925]] } }] }) };
    }
    return realFetch(url, options);
  });
  server = http.createServer(app);
  attachSocketServer(server); // same wiring as server.js, minus the cron job and process signal handlers
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  wsUrl = baseUrl;
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

function connectSocket(t, token) {
  const socket = ioClient(wsUrl, {
    auth: token === undefined ? {} : { token },
    reconnection: false,
    forceNew: true,
  });
  t.after(() => socket.close());
  return socket;
}

function waitForConnect(socket) {
  return new Promise((resolve, reject) => {
    socket.once('connect', () => resolve());
    socket.once('connect_error', (error) => reject(error));
  });
}

function waitForEvent(socket, event, timeoutMs = 4000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timed out waiting for "${event}"`)), timeoutMs);
    socket.once(event, (payload) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

// Never resolves with a payload — used to assert an event does NOT arrive.
function assertNoEvent(socket, event, withinMs = 1500) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, withinMs);
    socket.once(event, (payload) => {
      clearTimeout(timer);
      reject(new Error(`unexpectedly received "${event}": ${JSON.stringify(payload)}`));
    });
  });
}

async function createPassenger() {
  seed += 1;
  const phone = `015${String(seed).padStart(8, '0').slice(-8)}`;
  const { rows } = await pool.query(
    `INSERT INTO users (full_name, phone, password_hash, phone_verified_at)
     VALUES ('Socket Test Passenger', $1, 'test-hash', now()) RETURNING id`,
    [phone],
  );
  const userId = rows[0].id;
  await pool.query(`INSERT INTO user_roles (user_id, role_id) SELECT $1, id FROM roles WHERE name = 'PASSENGER'`, [userId]);
  await pool.query(`INSERT INTO passenger_profiles (user_id) VALUES ($1)`, [userId]);

  return { userId, accessToken: signAccessToken({ userId, roles: ['PASSENGER'], sessionId: userId }) };
}

async function createOnlineDriver(t, { lat, lng }) {
  seed += 1;
  const phone = `016${String(seed).padStart(8, '0').slice(-8)}`;
  const { rows } = await pool.query(
    `INSERT INTO users (full_name, phone, password_hash, phone_verified_at)
     VALUES ('Socket Test Driver', $1, 'test-hash', now()) RETURNING id`,
    [phone],
  );
  const userId = rows[0].id;
  await pool.query(`INSERT INTO user_roles (user_id, role_id) SELECT $1, id FROM roles WHERE name = 'DRIVER'`, [userId]);
  await pool.query(
    `INSERT INTO driver_profiles (user_id, nid_number, license_number, license_expiry, verification_status)
     VALUES ($1, $2, $3, '2035-12-31', 'approved')`,
    [userId, String(userId).padStart(10, '0'), `DL-SOCK-${userId}`],
  );
  const { rows: vehicleRows } = await pool.query(
    `INSERT INTO vehicles (driver_id, category_id, registration_no, verification_status, is_active)
     SELECT $1, id, $2, 'approved', true FROM vehicle_categories WHERE name = 'Car' RETURNING id`,
    [userId, `DHAKA-SOCK-${userId}`],
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

// Jatrabari — a third, distinct area of Dhaka from dispatch.test.js's
// Gulshan (23.7925, 90.4078) and trips.test.js's Uttara points, verified via
// haversineDistanceKm to be >8km from every one of them (an earlier Mirpur
// candidate looked "obviously far" by neighborhood name but was actually
// only 4.19km from dispatch.test.js's pickup — well inside its 5km radius —
// and caused real cross-file offer pollution; same class of bug fixed for
// trips.test.js earlier this session, this time caught before merging by
// actually computing the distance instead of eyeballing it).
const PICKUP = { lat: 23.7104, lng: 90.4335 }; // Jatrabari
const DROPOFF = { lat: 23.7180, lng: 90.4270 }; // Sayedabad

async function bookRide(passenger) {
  const { rows } = await pool.query(`SELECT id FROM cities WHERE name = 'Dhaka'`);
  return request('POST', '/ride-requests', {
    accessToken: passenger.accessToken,
    body: { cityId: rows[0].id, categoryId: 3, pickup: PICKUP, dropoff: DROPOFF, paymentIntent: 'cash' },
  });
}

test('handshake: connecting without a token is rejected before the connection is accepted', async (t) => {
  const socket = connectSocket(t, undefined);
  await assert.rejects(() => waitForConnect(socket));
});

test('handshake: connecting with a garbage token is rejected', async (t) => {
  const socket = connectSocket(t, 'not-a-real-jwt');
  await assert.rejects(() => waitForConnect(socket));
});

test('handshake: a valid access token connects successfully', async (t) => {
  const passenger = await createPassenger();
  const socket = connectSocket(t, passenger.accessToken);
  await assert.doesNotReject(() => waitForConnect(socket));
});

test('rooms: a driver who connects while online receives offer:new the moment a nearby request is dispatched (driver:{id} auto-join)', async (t) => {
  const driver = await createOnlineDriver(t, PICKUP);
  const driverSocket = connectSocket(t, driver.accessToken);
  await waitForConnect(driverSocket);

  const passenger = await createPassenger();
  const offerPromise = waitForEvent(driverSocket, 'offer:new');
  const booked = await bookRide(passenger);
  assert.equal(booked.status, 201);
  const { data: bookedData } = await booked.json();

  const offer = await offerPromise;
  assert.equal(offer.requestPublicId, bookedData.publicId);
  assert.ok(offer.offerId);
  assert.ok(offer.expiresAt);
});

test('rooms: a passenger who connects AFTER being matched auto-joins trip:{id} at connect time and receives trip:status', async (t) => {
  const passenger = await createPassenger();
  const driver = await createOnlineDriver(t, PICKUP);

  const booked = await bookRide(passenger);
  assert.equal(booked.status, 201);
  const offersResponse = await request('GET', '/driver/offers', { accessToken: driver.accessToken });
  const [offer] = (await offersResponse.json()).data;
  const accepted = await request('POST', `/driver/offers/${offer.id}/respond`, {
    accessToken: driver.accessToken,
    body: { response: 'accepted' },
  });
  assert.equal(accepted.status, 200);
  const tripCode = (await accepted.json()).data.trip.publicCode;

  // Connects only NOW, well after the trip already exists — proves
  // joinIdentityRooms' connect-time DB membership check, not a room joined
  // in response to the accept itself.
  const passengerSocket = connectSocket(t, passenger.accessToken);
  await waitForConnect(passengerSocket);

  const driverSocket = connectSocket(t, driver.accessToken);
  await waitForConnect(driverSocket);

  const statusPromise = waitForEvent(passengerSocket, 'trip:status');
  const arrived = await request('POST', `/trips/${tripCode}/arrived`, { accessToken: driver.accessToken });
  assert.equal(arrived.status, 200);

  const status = await statusPromise;
  assert.equal(status.status, 'arrived');
});

test('rooms: a driver connected BEFORE a trip exists still gets pulled into trip:{id} once accept creates one (retroactive join)', async (t) => {
  const driver = await createOnlineDriver(t, PICKUP);
  // Connects while merely "online" — no trip exists yet at connect time,
  // so joinIdentityRooms' connect-time lookup finds nothing to join.
  const driverSocket = connectSocket(t, driver.accessToken);
  await waitForConnect(driverSocket);

  const passenger = await createPassenger();
  const booked = await bookRide(passenger);
  assert.equal(booked.status, 201);
  const offersResponse = await request('GET', '/driver/offers', { accessToken: driver.accessToken });
  const [offer] = (await offersResponse.json()).data;

  const statusPromise = waitForEvent(driverSocket, 'trip:status');
  const accepted = await request('POST', `/driver/offers/${offer.id}/respond`, {
    accessToken: driver.accessToken,
    body: { response: 'accepted' },
  });
  assert.equal(accepted.status, 200);

  const status = await statusPromise;
  assert.equal(status.status, 'assigned');
});

test('rooms: an unrelated passenger never receives trip:status for a trip they are not on', async (t) => {
  const { tripCode, driver } = await (async () => {
    const passenger = await createPassenger();
    const driver = await createOnlineDriver(t, PICKUP);
    const booked = await bookRide(passenger);
    const offersResponse = await request('GET', '/driver/offers', { accessToken: driver.accessToken });
    const [offer] = (await offersResponse.json()).data;
    const accepted = await request('POST', `/driver/offers/${offer.id}/respond`, {
      accessToken: driver.accessToken,
      body: { response: 'accepted' },
    });
    return { tripCode: (await accepted.json()).data.trip.publicCode, driver };
  })();

  const stranger = await createPassenger();
  const strangerSocket = connectSocket(t, stranger.accessToken);
  await waitForConnect(strangerSocket);

  const noEvent = assertNoEvent(strangerSocket, 'trip:status');
  const arrived = await request('POST', `/trips/${tripCode}/arrived`, { accessToken: driver.accessToken });
  assert.equal(arrived.status, 200);

  await noEvent; // resolves only if trip:status never arrived within the window
});

test('location:update: a driver\'s GPS ping is stored and broadcast to the passenger, but never echoed back to the driver itself', async (t) => {
  const passenger = await createPassenger();
  const driver = await createOnlineDriver(t, PICKUP);

  const booked = await bookRide(passenger);
  const offersResponse = await request('GET', '/driver/offers', { accessToken: driver.accessToken });
  const [offer] = (await offersResponse.json()).data;
  const accepted = await request('POST', `/driver/offers/${offer.id}/respond`, {
    accessToken: driver.accessToken,
    body: { response: 'accepted' },
  });
  const tripCode = (await accepted.json()).data.trip.publicCode;

  const driverSocket = connectSocket(t, driver.accessToken);
  await waitForConnect(driverSocket);
  const passengerSocket = connectSocket(t, passenger.accessToken);
  await waitForConnect(passengerSocket);

  const passengerHeard = waitForEvent(passengerSocket, 'location:update');
  const driverEchoed = assertNoEvent(driverSocket, 'location:update', 1500);

  driverSocket.emit('location:update', { lat: 23.805, lng: 90.369, heading: 120 });

  const payload = await passengerHeard;
  await driverEchoed;

  assert.equal(payload.lat, 23.805);
  assert.equal(payload.lng, 90.369);
  assert.equal(payload.heading, 120);

  const { rows } = await pool.query(
    `SELECT current_lat::float8 AS "currentLat", current_lng::float8 AS "currentLng"
     FROM driver_availability WHERE driver_id = $1`,
    [driver.userId],
  );
  assert.equal(rows[0].currentLat, 23.805);
  assert.equal(rows[0].currentLng, 90.369);

  const { rows: pingRows } = await pool.query(
    `SELECT count(*)::int AS count FROM trip_location_pings tlp
     JOIN trips t ON t.id = tlp.trip_id WHERE t.trip_code = $1`,
    [tripCode],
  );
  assert.equal(pingRows[0].count, 1);
});

test('location:update: a passenger emitting it is silently ignored (not a supported operation)', async (t) => {
  const passenger = await createPassenger();
  const passengerSocket = connectSocket(t, passenger.accessToken);
  await waitForConnect(passengerSocket);

  const noBroadcast = assertNoEvent(passengerSocket, 'location:update', 1000);
  passengerSocket.emit('location:update', { lat: 23.8, lng: 90.4 });
  await noBroadcast;
});
