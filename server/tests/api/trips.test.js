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
// assigned trip's code, ready for arrived/start/complete.
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
  assert.equal(data.payment.status, 'unpaid'); // nothing processes payment yet (M7)

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
