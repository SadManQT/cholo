import assert from 'node:assert/strict';
import { once } from 'node:events';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { after, afterEach, before, beforeEach, mock, test } from 'node:test';

import app from '../../src/app.js';
import { pool } from '../../src/config/db.js';
import { env } from '../../src/config/env.js';
import { reinstateExpiredSuspensions } from '../../src/jobs/suspensions.job.js';
import { logger } from '../../src/utils/logger.js';
import { signAccessToken } from '../../src/utils/tokens.js';

let server;
let baseUrl;
let db;
let infoLog;
let savepointCounter = 0;
let phoneCounter = 0;

before(async () => {
  db = await pool.connect();
  await db.query('BEGIN');
  // Each bare query gets its own savepoint so an expected constraint error (a 409) doesn't abort the test transaction.
  mock.method(pool, 'query', async (sql, values) => {
    await db.query('SAVEPOINT launch_query');
    try {
      const result = await db.query(sql, values);
      await db.query('RELEASE SAVEPOINT launch_query');
      return result;
    } catch (error) {
      await db.query('ROLLBACK TO SAVEPOINT launch_query');
      throw error;
    }
  });
  mock.method(pool, 'connect', async () => {
    const savepoint = `launch_sp_${savepointCounter += 1}`;
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
  infoLog = mock.method(logger, 'info', () => {});
  mock.method(logger, 'error', () => {});
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

beforeEach(() => db.query('SAVEPOINT launch_test'));
afterEach(() => db.query('ROLLBACK TO SAVEPOINT launch_test'));

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
  return fetch(`${baseUrl}/api/v1${path}`, {
    method,
    headers,
    body: raw ?? (body === undefined ? undefined : JSON.stringify(body)),
  });
}

function nextPhone() {
  phoneCounter += 1;
  return `0161${String(phoneCounter).padStart(7, '0')}`;
}

async function createUser(roles = ['PASSENGER'], { admin = false } = {}) {
  const phone = nextPhone();
  const { rows } = await db.query(
    `INSERT INTO users (full_name, phone, password_hash, phone_verified_at)
     VALUES ($1, $2, 'test-hash', now()) RETURNING id`,
    [admin ? 'Launch Admin' : 'Launch User', phone],
  );
  const userId = Number(rows[0].id);
  await db.query(
    `INSERT INTO user_roles (user_id, role_id) SELECT $1, id FROM roles WHERE name = ANY($2::varchar[])`,
    [userId, roles],
  );
  if (roles.includes('PASSENGER')) await db.query(`INSERT INTO passenger_profiles (user_id) VALUES ($1)`, [userId]);
  if (admin) {
    await db.query(`INSERT INTO admin_profiles (user_id, designation, access_level) VALUES ($1, 'Ops', 'super')`, [userId]);
  }
  return { userId, phone, token: signAccessToken({ userId, roles, sessionId: userId }) };
}

async function createCompletedTrip(passenger) {
  const driver = await createUser(['DRIVER']);
  await db.query(
    `INSERT INTO driver_profiles (user_id, nid_number, license_number, license_expiry, verification_status)
     VALUES ($1, $2, $3, current_date + 365, 'approved')`,
    [driver.userId, String(driver.userId).padStart(10, '0'), `LF-LIC-${driver.userId}`],
  );
  const { rows: vehicles } = await db.query(
    `INSERT INTO vehicles (driver_id, category_id, registration_no, verification_status)
     SELECT $1, id, $2, 'approved' FROM vehicle_categories WHERE name = 'Car' RETURNING id`,
    [driver.userId, `LF-REG-${driver.userId}`],
  );
  const { rows: requests } = await db.query(
    `INSERT INTO ride_requests (passenger_id, city_id, category_id, pickup_lat, pickup_lng, pickup_address,
       dropoff_lat, dropoff_lng, dropoff_address, est_fare, payment_intent, status)
     SELECT $1, c.id, vc.id, 23.75, 90.38, 'Dhanmondi 27', 23.79, 90.41, 'Gulshan 1', 100, 'cash', 'matched'
     FROM cities c CROSS JOIN vehicle_categories vc WHERE c.name = 'Dhaka' AND vc.name = 'Car' RETURNING id`,
    [passenger.userId],
  );
  const { rows: trips } = await db.query(
    `INSERT INTO trips (request_id, passenger_id, driver_id, vehicle_id, status, arrived_at, started_at, completed_at,
       base_fare, distance_fare, total_fare, payment_status)
     VALUES ($1, $2, $3, $4, 'completed', now(), now(), now(), 20, 80, 100, 'paid')
     RETURNING id, trip_code AS "tripCode"`,
    [requests[0].id, passenger.userId, driver.userId, vehicles[0].id],
  );
  return { ...trips[0], driver };
}

function otpSentTo(phone) {
  const entry = infoLog.mock.calls.findLast((c) => c.arguments[1]?.phone === phone);
  return entry?.arguments[1]?.message.match(/(\d{6})$/)?.[1];
}

test('forgot password: code, single-use reset token, and only the new password works', async () => {
  const phone = nextPhone();
  await call('POST', '/auth/register', { body: { fullName: 'Reset Me', phone, password: 'OldPassword1' } });

  assert.equal((await call('POST', '/auth/forgot-password', { body: { phone: '01999999999' } })).status, 404);
  assert.equal((await call('POST', '/auth/forgot-password', { body: { phone } })).status, 204);
  const code = otpSentTo(phone);
  assert.match(code, /^\d{6}$/);

  const wrong = await call('POST', '/auth/forgot-password/verify', { body: { phone, otp: code === '000000' ? '111111' : '000000' } });
  assert.equal(wrong.status, 401);

  const verified = await call('POST', '/auth/forgot-password/verify', { body: { phone, otp: code } });
  assert.equal(verified.status, 200);
  const { resetToken } = (await verified.json()).data;

  const mismatch = await call('POST', '/auth/reset-password', { body: { resetToken, newPassword: 'NewPassword1', confirmPassword: 'Different1' } });
  assert.equal(mismatch.status, 422);
  assert.equal((await mismatch.json()).error.details[0].field, 'confirmPassword');

  const reset = await call('POST', '/auth/reset-password', { body: { resetToken, newPassword: 'NewPassword1', confirmPassword: 'NewPassword1' } });
  assert.equal(reset.status, 204);
  const reused = await call('POST', '/auth/reset-password', { body: { resetToken, newPassword: 'Another123', confirmPassword: 'Another123' } });
  assert.equal(reused.status, 410);

  assert.equal((await call('POST', '/auth/login', { body: { phone, password: 'OldPassword1' } })).status, 401);
  assert.equal((await call('POST', '/auth/login', { body: { phone, password: 'NewPassword1' } })).status, 200);
});

test('a one-week suspension blocks login with its end date, then lifts itself', async () => {
  const admin = await createUser(['ADMIN'], { admin: true });
  const phone = nextPhone();
  await call('POST', '/auth/register', { body: { fullName: 'Timed', phone, password: 'Password123' } });
  const { rows } = await db.query(`SELECT id FROM users WHERE phone = $1`, [phone]);
  const userId = rows[0].id;

  const suspended = await call('POST', `/admin/users/${userId}/suspend`, {
    token: admin.token, body: { reason: 'Repeated cancellations', duration: '1w' },
  });
  assert.equal(suspended.status, 200);
  const { suspendedUntil } = (await suspended.json()).data;
  const days = (new Date(suspendedUntil) - Date.now()) / 86_400_000;
  assert.ok(days > 6.9 && days < 7.1);

  const blocked = await call('POST', '/auth/login', { body: { phone, password: 'Password123' } });
  assert.equal(blocked.status, 403);
  const blockedBody = await blocked.json();
  assert.equal(blockedBody.error.details.reason, 'Repeated cancellations');
  assert.ok(blockedBody.error.details.until);

  await db.query(`UPDATE users SET suspended_until = now() - interval '1 minute' WHERE id = $1`, [userId]);
  assert.equal((await call('POST', '/auth/login', { body: { phone, password: 'Password123' } })).status, 200);

  const other = await createUser();
  await db.query(
    `UPDATE users SET status = 'suspended', suspended_until = now() - interval '1 minute' WHERE id = $1`,
    [other.userId],
  );
  const reinstated = await reinstateExpiredSuspensions();
  assert.ok(reinstated.map(Number).includes(other.userId));

  const custom = await call('POST', `/admin/users/${other.userId}/suspend`, {
    token: admin.token, body: { reason: 'Review', duration: 'custom', until: '2020-01-01T00:00:00Z' },
  });
  assert.equal(custom.status, 422);
});

test('saved places and emergency contacts: add, reject duplicates, list with recents, remove', async () => {
  const rider = await createUser();
  await createCompletedTrip(rider);

  const home = await call('POST', '/me/places', { token: rider.token, body: { label: 'Home', address: 'House 5, Road 2', lat: 23.75, lng: 90.39 } });
  assert.equal(home.status, 201);
  const duplicate = await call('POST', '/me/places', { token: rider.token, body: { label: 'Home', address: 'Elsewhere', lat: 23.7, lng: 90.4 } });
  assert.equal(duplicate.status, 409);

  const list = await (await call('GET', '/me/places', { token: rider.token })).json();
  assert.equal(list.data.saved.length, 1);
  assert.deepEqual(list.data.recent.map((p) => p.address).sort(), ['Dhanmondi 27', 'Gulshan 1']);

  assert.equal((await call('DELETE', `/me/places/${(await home.json()).data.id}`, { token: rider.token })).status, 204);

  const contact = await call('POST', '/me/emergency-contacts', { token: rider.token, body: { name: 'Ammu', phone: '01711111111', relationship: 'Mother' } });
  assert.equal(contact.status, 201);
  assert.equal((await call('POST', '/me/emergency-contacts', { token: rider.token, body: { name: 'Again', phone: '01711111111' } })).status, 409);
  const contacts = await (await call('GET', '/me/emergency-contacts', { token: rider.token })).json();
  assert.equal(contacts.data[0].priority, 1);
});

test('ratings update the driver average once per rater, and only for completed trips', async () => {
  const rider = await createUser();
  const trip = await createCompletedTrip(rider);

  const rated = await call('POST', `/trips/${trip.tripCode}/rating`, { token: rider.token, body: { score: 4, comment: 'Smooth ride' } });
  assert.equal(rated.status, 201);
  assert.equal((await call('POST', `/trips/${trip.tripCode}/rating`, { token: rider.token, body: { score: 5 } })).status, 409);

  const { rows } = await db.query(`SELECT rating_avg::float8 AS avg, rating_count FROM driver_profiles WHERE user_id = $1`, [trip.driver.userId]);
  assert.deepEqual(rows[0], { avg: 4, rating_count: 1 });

  const detail = await (await call('GET', `/trips/${trip.tripCode}`, { token: rider.token })).json();
  assert.deepEqual(detail.data.myRating, { score: 4, comment: 'Smooth ride' });
});

test('driver decisions store the reason and land in the driver notification inbox', async () => {
  const admin = await createUser(['ADMIN'], { admin: true });
  const driver = await createUser(['PASSENGER', 'DRIVER']);
  await db.query(
    `INSERT INTO driver_profiles (user_id, nid_number, license_number, license_expiry) VALUES ($1, $2, $3, current_date + 365)`,
    [driver.userId, String(driver.userId).padStart(10, '0'), `LF-NOTIFY-${driver.userId}`],
  );

  const rejected = await call('POST', `/admin/drivers/${driver.userId}/reject`, { token: admin.token, body: { reason: 'License photo is blurry' } });
  assert.equal(rejected.status, 200);

  const inbox = await (await call('GET', '/notifications', { token: driver.token })).json();
  assert.equal(inbox.meta.unread, 1);
  assert.equal(inbox.data[0].body, 'License photo is blurry');

  const status = await (await call('GET', '/driver/status', { token: driver.token })).json();
  assert.equal(status.data.rejectionReason, 'License photo is blurry');

  await call('POST', '/notifications/read', { token: driver.token, body: {} });
  assert.equal((await (await call('GET', '/notifications', { token: driver.token })).json()).meta.unread, 0);
});

test('disputes move open → under review → resolved, notifying the rider at each step', async () => {
  const admin = await createUser(['ADMIN'], { admin: true });
  const rider = await createUser();
  const trip = await createCompletedTrip(rider);

  const created = await call('POST', '/disputes', { token: rider.token, body: { tripPublicId: trip.tripCode, disputeType: 'fare_overcharge', description: 'Charged twice for the toll' } });
  assert.equal(created.status, 201);
  const disputeId = (await created.json()).data.id;

  const review = await call('POST', `/admin/disputes/${disputeId}/review`, { token: admin.token });
  assert.equal(review.status, 200);
  assert.equal((await review.json()).data.status, 'under_review');
  assert.equal((await call('POST', `/admin/disputes/${disputeId}/review`, { token: admin.token })).status, 409);

  await call('POST', `/admin/disputes/${disputeId}/resolve`, { token: admin.token, body: { status: 'resolved_no_action', resolutionNote: 'Toll was valid' } });
  const mine = await (await call('GET', '/disputes', { token: rider.token })).json();
  assert.ok(mine.data[0].reviewStartedAt);
  assert.ok(mine.data[0].resolvedAt);

  const inbox = await (await call('GET', '/notifications', { token: rider.token })).json();
  assert.equal(inbox.meta.unread, 2);
});

test('restricted zones block bookings inside them and tag driver positions', async () => {
  const admin = await createUser(['ADMIN'], { admin: true });
  const rider = await createUser();
  const { rows: cities } = await db.query(`SELECT id FROM cities WHERE name = 'Dhaka'`);
  const { rows: categories } = await db.query(`SELECT id FROM vehicle_categories WHERE name = 'Car'`);

  const zone = await call('POST', '/admin/zones', {
    token: admin.token,
    body: {
      cityId: cities[0].id, name: 'Cantonment', zoneType: 'restricted',
      points: [{ lat: 23.80, lng: 90.38 }, { lat: 23.80, lng: 90.42 }, { lat: 23.84, lng: 90.42 }, { lat: 23.84, lng: 90.38 }],
    },
  });
  assert.equal(zone.status, 201);
  const zoneId = (await zone.json()).data.id;

  const quote = await call('POST', '/rides/quote', {
    token: rider.token,
    body: { cityId: cities[0].id, categoryId: categories[0].id, pickup: { lat: 23.82, lng: 90.40 }, dropoff: { lat: 23.75, lng: 90.38 } },
  });
  assert.equal(quote.status, 422);
  const quoteBody = await quote.json();
  assert.equal(quoteBody.error.code, 'RESTRICTED_ZONE');
  assert.equal(quoteBody.error.details[0].field, 'pickup');

  const { rows } = await db.query(`SELECT fn_zone_at(23.82, 90.40) AS inside, fn_zone_at(23.70, 90.40) AS outside`);
  assert.equal(String(rows[0].inside), String(zoneId));
  assert.equal(rows[0].outside, null);

  assert.equal((await call('DELETE', `/admin/zones/${zoneId}`, { token: admin.token })).status, 204);
});

test('uploads accept real images and reject files whose bytes do not match their type', async () => {
  const user = await createUser();
  const png = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000', 'hex');

  const ok = await call('POST', '/uploads', { token: user.token, raw: png, contentType: 'image/png' });
  assert.equal(ok.status, 201);
  const { url } = (await ok.json()).data;
  const name = url.split('/').pop();
  const served = await fetch(`${baseUrl}/uploads/${name}`);
  assert.equal(served.status, 200);
  await rm(join(env.UPLOAD_DIR, name));

  const fake = await call('POST', '/uploads', { token: user.token, raw: Buffer.from('not really a png'), contentType: 'image/png' });
  assert.equal(fake.status, 415);
  assert.equal((await call('POST', '/uploads', { raw: png, contentType: 'image/png' })).status, 401);
});

test('admin approval queues load (the vehicle queue reads vehicle document rejection reasons)', async () => {
  const admin = await createUser(['ADMIN'], { admin: true });
  assert.equal((await call('GET', '/admin/drivers', { token: admin.token })).status, 200);
  assert.equal((await call('GET', '/admin/vehicles', { token: admin.token })).status, 200);
});

test('gateway return: a cancelled payment is marked failed, redirects to the client, and unblocks paying again', async () => {
  const rider = await createUser();
  const trip = await createCompletedTrip(rider);
  await db.query(`UPDATE trips SET payment_status = 'unpaid' WHERE id = $1`, [trip.id]);
  await db.query(`UPDATE wallets SET balance = 1000 WHERE user_id = $1`, [rider.userId]);
  const { rows } = await db.query(
    `INSERT INTO payments (purpose, trip_id, payer_id, method_type, gateway, amount, status)
     VALUES ('trip', $1, $2, 'bkash', 'sslcommerz', 100, 'initiated') RETURNING public_id AS "publicId"`,
    [trip.id, rider.userId],
  );

  const blocked = await call('POST', `/trips/${trip.tripCode}/pay`, { token: rider.token, body: { method: 'wallet' } });
  assert.equal(blocked.status, 409);

  const returned = await fetch(`${baseUrl}/api/v1/payments/${rows[0].publicId}/return?result=cancel`, {
    method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'tran_id=x',
  });
  assert.equal(returned.status, 303);
  assert.equal(returned.headers.get('location'), `${env.CLIENT_ORIGIN[0]}/payments/${rows[0].publicId}?result=cancel`);
  const { rows: after } = await db.query(`SELECT status FROM payments WHERE public_id = $1`, [rows[0].publicId]);
  assert.equal(after[0].status, 'failed');

  const paid = await call('POST', `/trips/${trip.tripCode}/pay`, { token: rider.token, body: { method: 'wallet' } });
  assert.equal(paid.status, 201);

  const detail = await (await call('GET', `/payments/${rows[0].publicId}`, { token: rider.token })).json();
  assert.equal(detail.data.tripCode, trip.tripCode);
});

test('an abandoned gateway attempt older than 30 minutes no longer blocks paying the trip', async () => {
  const rider = await createUser();
  const trip = await createCompletedTrip(rider);
  await db.query(`UPDATE trips SET payment_status = 'unpaid' WHERE id = $1`, [trip.id]);
  await db.query(`UPDATE wallets SET balance = 1000 WHERE user_id = $1`, [rider.userId]);
  await db.query(
    `INSERT INTO payments (purpose, trip_id, payer_id, method_type, gateway, amount, status, initiated_at)
     VALUES ('trip', $1, $2, 'card', 'sslcommerz', 100, 'initiated', now() - interval '40 minutes')`,
    [trip.id, rider.userId],
  );
  assert.equal((await call('POST', `/trips/${trip.tripCode}/pay`, { token: rider.token, body: { method: 'wallet' } })).status, 201);
});
