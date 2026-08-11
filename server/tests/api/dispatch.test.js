import assert from 'node:assert/strict';
import { once } from 'node:events';
import { after, before, test } from 'node:test';

import app from '../../src/app.js';
import { pool } from '../../src/config/db.js';
import { signAccessToken } from '../../src/utils/tokens.js';

// Deliberately NOT the savepoint-mocked-single-connection pattern the other
// API test files use (see tests/api/ride-requests.test.js). That pattern
// routes every "connection" through one real underlying client, which would
// make two "concurrent" transactions actually run sequentially — exactly
// wrong for this file, whose entire point is proving a FOR UPDATE lock
// blocks a second REAL concurrent connection. This uses the real pool and
// cleans up afterwards instead of rolling back a wrapping transaction.
let server;
let baseUrl;
const createdUserIds = [];
let phoneCounter = 0;
// The RACE test's fixtures are intentionally never cleaned up (a trip
// anchors them permanently — see skipCleanup below), so their phone numbers
// must stay unique ACROSS runs too, not just within one process. Seeding
// from wall-clock time instead of starting phoneCounter at 1 every run
// avoids colliding with a previous run's still-present rows.
const RUN_SEED = Date.now() % 90_000_000;

before(async () => {
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  server.close();
  await once(server, 'close');

  if (createdUserIds.length > 0) {
    // Dependency order: RESTRICT fks (trips/ride_requests/vehicles) must go
    // before the users row, or the CASCADE from users would be blocked.
    await pool.query(`DELETE FROM trips WHERE driver_id = ANY($1) OR passenger_id = ANY($1)`, [createdUserIds]);
    await pool.query(`DELETE FROM ride_offers WHERE driver_id = ANY($1)`, [createdUserIds]);
    await pool.query(`DELETE FROM ride_requests WHERE passenger_id = ANY($1)`, [createdUserIds]);
    await pool.query(`DELETE FROM vehicles WHERE driver_id = ANY($1)`, [createdUserIds]);
    await pool.query(`DELETE FROM users WHERE id = ANY($1)`, [createdUserIds]); // cascades the rest
  }
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

// skipCleanup: a trip anchors its passenger/driver/vehicle/request rows
// permanently — trip_status_history's fn_block_mutation trigger blocks even
// the CASCADE delete a `DELETE FROM trips` would trigger, by design (doc03:
// "financial truth is append-only"). The one test that actually accepts an
// offer (creating a trip) opts its fixtures out of cleanup instead of
// fighting that guarantee; every other test cleans up normally.
async function createPassenger({ skipCleanup = false } = {}) {
  phoneCounter += 1;
  const phone = `017${String(RUN_SEED + phoneCounter).padStart(8, '0').slice(-8)}`;
  const { rows } = await pool.query(
    `INSERT INTO users (full_name, phone, password_hash, phone_verified_at)
     VALUES ('Dispatch Test Passenger', $1, 'test-hash', now())
     RETURNING id`,
    [phone],
  );
  const userId = rows[0].id;
  if (!skipCleanup) createdUserIds.push(userId);

  await pool.query(
    `INSERT INTO user_roles (user_id, role_id) SELECT $1, id FROM roles WHERE name = 'PASSENGER'`,
    [userId],
  );
  await pool.query(`INSERT INTO passenger_profiles (user_id) VALUES ($1)`, [userId]);

  return { userId, accessToken: signAccessToken({ userId, roles: ['PASSENGER'], sessionId: userId }) };
}

// Fully-approved, online, with an active Car — built directly, the same way
// tests/api/driver-onboarding.test.js builds admin fixtures. The onboarding
// flow itself (apply -> documents -> admin review) is that file's job, not
// this one's.
//
// t (node:test's TestContext) is required, not optional: every test in
// this file dispatches to drivers at overlapping coordinates, so a driver
// left 'online' after ITS test would still look "nearby and eligible" to
// every later test's booking in the same run — even skipCleanup fixtures,
// whose PROFILE rows must stay (trip-anchored) but whose STATUS doesn't
// need to. t.after() runs right after this specific test, not at the end
// of the file, and driver_availability isn't append-only, so resetting it
// is always safe.
async function createOnlineDriver(t, { lat, lng, categoryName = 'Car', gender, skipCleanup = false } = {}) {
  phoneCounter += 1;
  const phone = `018${String(RUN_SEED + phoneCounter).padStart(8, '0').slice(-8)}`;
  const { rows } = await pool.query(
    `INSERT INTO users (full_name, phone, password_hash, phone_verified_at, gender)
     VALUES ('Dispatch Test Driver', $1, 'test-hash', now(), $2)
     RETURNING id`,
    [phone, gender ?? null],
  );
  const userId = rows[0].id;
  if (!skipCleanup) createdUserIds.push(userId);

  await pool.query(
    `INSERT INTO user_roles (user_id, role_id) SELECT $1, id FROM roles WHERE name = 'DRIVER'`,
    [userId],
  );
  await pool.query(
    `INSERT INTO driver_profiles (user_id, nid_number, license_number, license_expiry, verification_status)
     VALUES ($1, $2, $3, '2035-12-31', 'approved')`,
    // userId comes back from pg as a STRING (bigint columns aren't
    // auto-converted, to avoid precision loss) — `1_000_000_000 + userId`
    // would string-concatenate, not add, producing a variable-length
    // result. padStart keeps this a clean, always-valid 10-digit NID
    // (chk_driver_nid_format: 10, 13, or 17 digits) regardless of id width.
    [userId, String(userId).padStart(10, '0'), `DL-DISPATCH-${userId}`],
  );
  const { rows: vehicleRows } = await pool.query(
    `INSERT INTO vehicles (driver_id, category_id, registration_no, verification_status, is_active)
     SELECT $1, id, $2, 'approved', true FROM vehicle_categories WHERE name = $3
     RETURNING id`,
    [userId, `DHAKA-DISPATCH-${userId}`, categoryName],
  );
  const vehicleId = vehicleRows[0].id;
  await pool.query(`UPDATE driver_profiles SET active_vehicle_id = $2 WHERE user_id = $1`, [userId, vehicleId]);
  await pool.query(
    `UPDATE driver_availability SET status = 'online', current_lat = $2, current_lng = $3 WHERE driver_id = $1`,
    [userId, lat, lng],
  );
  t.after(async () => {
    await pool.query(`UPDATE driver_availability SET status = 'offline' WHERE driver_id = $1`, [userId]);
  });

  return { userId, vehicleId, accessToken: signAccessToken({ userId, roles: ['DRIVER'], sessionId: userId }) };
}

const PICKUP = { lat: 23.7925, lng: 90.4078 };
const DROPOFF = { lat: 23.7461, lng: 90.3742 };

async function bookRide(passenger, overrides = {}) {
  return request('POST', '/ride-requests', {
    accessToken: passenger.accessToken,
    body: { cityId: 1, categoryId: 3, pickup: PICKUP, dropoff: DROPOFF, paymentIntent: 'cash', ...overrides },
  });
}

test('booking a ride fans out an offer to every eligible online driver, and only those drivers', async (t) => {
  const passenger = await createPassenger();
  const nearby = await createOnlineDriver(t, { lat: 23.7925, lng: 90.4078 }); // right at pickup
  const farAway = await createOnlineDriver(t, { lat: 23.9, lng: 90.5 }); // ~15km+ away, outside the dispatch radius
  const offlineDriver = await createOnlineDriver(t, { lat: 23.7925, lng: 90.4078 });
  await pool.query(`UPDATE driver_availability SET status = 'offline' WHERE driver_id = $1`, [offlineDriver.userId]);

  const response = await bookRide(passenger);
  assert.equal(response.status, 201);

  const nearbyOffers = await request('GET', '/driver/offers', { accessToken: nearby.accessToken });
  const farOffers = await request('GET', '/driver/offers', { accessToken: farAway.accessToken });
  const offlineOffers = await request('GET', '/driver/offers', { accessToken: offlineDriver.accessToken });

  assert.equal((await nearbyOffers.json()).data.length, 1);
  assert.equal((await farOffers.json()).data.length, 0);
  assert.equal((await offlineOffers.json()).data.length, 0);
});

test('GET /driver/offers shape carries what the OfferSheet needs (doc 11-12 §6.1)', async (t) => {
  const passenger = await createPassenger();
  const driver = await createOnlineDriver(t, { lat: 23.7925, lng: 90.4078 });
  await bookRide(passenger);

  const response = await request('GET', '/driver/offers', { accessToken: driver.accessToken });
  const [offer] = (await response.json()).data;

  assert.equal(offer.categoryName, 'Car');
  assert.equal(offer.estFare, 295.12);
  assert.equal(offer.estDistanceKm, 9.21);
  assert.equal(offer.driverDistanceKm, 0);
  assert.equal(offer.passengerRating, '5.00');
  assert.ok(offer.expiresAt);
});

test('a women_only request only offers to female drivers', async (t) => {
  const passenger = await createPassenger();
  const femaleDriver = await createOnlineDriver(t, { lat: 23.7925, lng: 90.4078, gender: 'female' });
  const maleDriver = await createOnlineDriver(t, { lat: 23.7925, lng: 90.4078, gender: 'male' });

  await bookRide(passenger, { womenOnly: true });

  const femaleOffers = await request('GET', '/driver/offers', { accessToken: femaleDriver.accessToken });
  const maleOffers = await request('GET', '/driver/offers', { accessToken: maleDriver.accessToken });

  assert.equal((await femaleOffers.json()).data.length, 1);
  assert.equal((await maleOffers.json()).data.length, 0);
});

test('rejecting an offer leaves the request searching and the offer cannot be responded to again', async (t) => {
  const passenger = await createPassenger();
  const driver = await createOnlineDriver(t, { lat: 23.7925, lng: 90.4078 });
  await bookRide(passenger);

  const { data: [offer] } = await (await request('GET', '/driver/offers', { accessToken: driver.accessToken })).json();

  const reject = await request('POST', `/driver/offers/${offer.id}/respond`, {
    accessToken: driver.accessToken,
    body: { response: 'rejected' },
  });
  assert.equal(reject.status, 200);
  assert.equal((await reject.json()).data.response, 'rejected');

  const { rows } = await pool.query(`SELECT status FROM ride_requests WHERE public_id = $1`, [offer.requestPublicId]);
  assert.equal(rows[0].status, 'searching');

  const second = await request('POST', `/driver/offers/${offer.id}/respond`, {
    accessToken: driver.accessToken,
    body: { response: 'accepted' },
  });
  assert.equal(second.status, 409);
  assert.equal((await second.json()).error.code, 'ALREADY_TAKEN');
});

test('THE RACE: two drivers accept the same request within the same instant — exactly one 200, one 409, one trip', async (t) => {
  // skipCleanup: this is the one test that actually creates a trip.
  const passenger = await createPassenger({ skipCleanup: true });
  const driverA = await createOnlineDriver(t, { lat: 23.7925, lng: 90.4078, skipCleanup: true });
  const driverB = await createOnlineDriver(t, { lat: 23.7930, lng: 90.4085, skipCleanup: true });

  const booked = await bookRide(passenger);
  const { data: bookedData } = await booked.json();

  const offersA = (await (await request('GET', '/driver/offers', { accessToken: driverA.accessToken })).json()).data;
  const offersB = (await (await request('GET', '/driver/offers', { accessToken: driverB.accessToken })).json()).data;
  assert.equal(offersA.length, 1);
  assert.equal(offersB.length, 1);

  const respond = (driver, offerId) => request('POST', `/driver/offers/${offerId}/respond`, {
    accessToken: driver.accessToken,
    body: { response: 'accepted' },
  });

  // Real concurrent HTTP requests against the real pool — Promise.all, not
  // sequential awaits, so both accept attempts genuinely overlap.
  const [responseA, responseB] = await Promise.all([
    respond(driverA, offersA[0].id),
    respond(driverB, offersB[0].id),
  ]);
  const [bodyA, bodyB] = await Promise.all([responseA.json(), responseB.json()]);

  const statuses = [responseA.status, responseB.status].sort();
  assert.deepEqual(statuses, [200, 409]);

  const winnerBody = responseA.status === 200 ? bodyA : bodyB;
  const loserBody = responseA.status === 409 ? bodyA : bodyB;
  assert.equal(loserBody.error.code, 'ALREADY_TAKEN');
  assert.equal(winnerBody.data.trip.status, 'assigned');
  assert.match(winnerBody.data.trip.publicCode, /^JT-\d{4}-\d{6}$/);
  assert.equal(winnerBody.data.trip.passenger.rating, '5.00');

  const { rows: tripRows } = await pool.query(
    `SELECT driver_id FROM trips WHERE request_id = (SELECT id FROM ride_requests WHERE public_id = $1)`,
    [bookedData.publicId],
  );
  assert.equal(tripRows.length, 1, 'exactly one trip must exist, no matter which driver won');

  const winnerId = responseA.status === 200 ? driverA.userId : driverB.userId;
  const loserId = responseA.status === 200 ? driverB.userId : driverA.userId;
  assert.equal(tripRows[0].driver_id, winnerId);

  const { rows: availabilityRows } = await pool.query(
    `SELECT driver_id, status FROM driver_availability WHERE driver_id = ANY($1) ORDER BY driver_id`,
    [[winnerId, loserId]],
  );
  const winnerAvailability = availabilityRows.find((r) => r.driver_id === winnerId);
  const loserAvailability = availabilityRows.find((r) => r.driver_id === loserId);
  assert.equal(winnerAvailability.status, 'on_trip');
  assert.equal(loserAvailability.status, 'online'); // untouched — they never actually took the ride

  const { rows: requestRows } = await pool.query(`SELECT status FROM ride_requests WHERE public_id = $1`, [bookedData.publicId]);
  assert.equal(requestRows[0].status, 'matched');
});

test('an expired offer cannot be accepted and is lazily marked timed_out', { timeout: 20_000 }, async (t) => {
  const passenger = await createPassenger();
  const driver = await createOnlineDriver(t, { lat: 23.7925, lng: 90.4078 });
  await bookRide(passenger);

  const { data: [offer] } = await (await request('GET', '/driver/offers', { accessToken: driver.accessToken })).json();

  await new Promise((resolve) => setTimeout(resolve, 16_000)); // doc 11-12 §6.1: 15s window

  const afterExpiry = await request('GET', '/driver/offers', { accessToken: driver.accessToken });
  assert.deepEqual((await afterExpiry.json()).data, []);

  const respond = await request('POST', `/driver/offers/${offer.id}/respond`, {
    accessToken: driver.accessToken,
    body: { response: 'accepted' },
  });
  assert.equal(respond.status, 410);
  assert.equal((await respond.json()).error.code, 'OFFER_EXPIRED');

  const { rows } = await pool.query(`SELECT response FROM ride_offers WHERE id = $1`, [offer.id]);
  assert.equal(rows[0].response, 'timed_out');
});
