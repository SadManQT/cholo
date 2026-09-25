import assert from 'node:assert/strict';
import { once } from 'node:events';
import { rm } from 'node:fs/promises';
import { after, afterEach, before, beforeEach, mock, test } from 'node:test';

import app from '../../src/app.js';
import { pool } from '../../src/config/db.js';
import { env } from '../../src/config/env.js';
import * as dispatchService from '../../src/services/dispatch.service.js';
import * as ridesService from '../../src/services/rides.service.js';
import { logger } from '../../src/utils/logger.js';
import { signAccessToken } from '../../src/utils/tokens.js';
import { totpCode } from '../../src/utils/totp.js';

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
    await db.query('SAVEPOINT feature_query');
    try {
      const result = await db.query(sql, values);
      await db.query('RELEASE SAVEPOINT feature_query');
      return result;
    } catch (error) {
      await db.query('ROLLBACK TO SAVEPOINT feature_query');
      throw error;
    }
  });
  mock.method(pool, 'connect', async () => {
    const savepoint = `feature_sp_${savepointCounter += 1}`;
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
      // 9.21 km for a direct trip, plus 3 km per extra stop.
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

beforeEach(() => db.query('SAVEPOINT feature_test'));
afterEach(() => db.query('ROLLBACK TO SAVEPOINT feature_test'));

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

function nextPhone() {
  phoneCounter += 1;
  return `0162${String(phoneCounter).padStart(7, '0')}`;
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
    `UPDATE driver_availability SET status = 'online', current_lat = $2, current_lng = $3 WHERE driver_id = $1`,
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
  await call('POST', `/trips/${tripCode}/start`, { token: driver.token });
  return tripCode;
}

test('re-dispatch: an unanswered offer times out and the ride goes to the next driver, one round wider', async () => {
  const rider = await createUser();
  const first = await createOnlineDriver();
  const { body } = await book(rider);
  assert.equal((await pendingOffersFor(first.userId)).length, 1);

  // A second driver comes online 6 km away: outside round 1's 5 km, inside round 2's 7.5 km.
  const second = await createOnlineDriver({ lat: 23.8465, lng: 90.4078 });
  assert.equal(await dispatchService.redispatchStaleRequests(), 0, 'nothing happens while the first offer is live');

  await ageOffers(body.data.publicId);
  assert.equal(await dispatchService.redispatchStaleRequests(), 1);
  assert.equal((await pendingOffersFor(first.userId)).length, 0, 'first offer timed out, not re-sent');
  const offers = await pendingOffersFor(second.userId);
  assert.equal(offers.length, 1);
  assert.equal(offers[0].round, 2);
});

test('favourite drivers get the first round to themselves; everyone else gets the next one', async () => {
  const rider = await createUser();
  const favourite = await createOnlineDriver({ lat: 23.80, lng: 90.41 });
  const nearer = await createOnlineDriver();

  const firstTrip = await book(rider);
  const firstOffer = (await pendingOffersFor(favourite.userId))[0];
  const tripCode = await acceptAndComplete(favourite, firstOffer.id);
  assert.equal((await call('POST', `/trips/${tripCode}/complete`, { token: favourite.token, body: {} })).status, 200);
  assert.ok(firstTrip.body.data.publicId);

  const stranger = await createUser(['DRIVER']);
  const { rows: strangerRows } = await db.query(`SELECT public_id FROM users WHERE id = $1`, [stranger.userId]);
  const refused = await call('PUT', `/me/favorite-drivers/${strangerRows[0].public_id}`, { token: rider.token });
  assert.equal(refused.status, 422);

  const detail = await (await call('GET', `/trips/${tripCode}`, { token: rider.token })).json();
  assert.equal(detail.data.driverIsFavorite, false);
  assert.equal((await call('PUT', `/me/favorite-drivers/${detail.data.driver.id}`, { token: rider.token })).status, 204);
  const list = await (await call('GET', '/me/favorite-drivers', { token: rider.token })).json();
  assert.equal(list.data.length, 1);

  await db.query(`UPDATE ride_offers SET response = 'withdrawn' WHERE driver_id = $1 AND response = 'pending'`, [nearer.userId]);
  const { body } = await book(rider);
  assert.equal((await pendingOffersFor(favourite.userId)).length, 1);
  assert.equal((await pendingOffersFor(nearer.userId)).length, 0, 'the nearer non-favourite waits');

  await ageOffers(body.data.publicId);
  await dispatchService.redispatchStaleRequests();
  assert.equal((await pendingOffersFor(nearer.userId)).length, 1);

  assert.equal((await call('DELETE', `/me/favorite-drivers/${detail.data.driver.id}`, { token: rider.token })).status, 204);
});

test('scheduled rides wait as pending, remind, then start a normal search 10 minutes ahead', async () => {
  const rider = await createUser();
  const driver = await createOnlineDriver();
  const scheduledFor = new Date(Date.now() + 25 * 60_000).toISOString();
  const { response, body } = await book(rider, { scheduledFor });
  assert.equal(response.status, 201);
  assert.equal(body.data.status, 'pending');
  assert.equal((await pendingOffersFor(driver.userId)).length, 0);

  const active = await (await call('GET', '/ride-requests', { token: rider.token })).json();
  assert.equal(active.data.length, 1);
  assert.equal(active.data[0].scheduledFor, new Date(scheduledFor).toISOString());

  let result = await ridesService.dispatchScheduledRequests();
  assert.deepEqual(result, { reminders: 1, dispatched: 0 });

  await db.query(`UPDATE ride_requests SET scheduled_for = now() + interval '8 minutes' WHERE public_id = $1`, [body.data.publicId]);
  result = await ridesService.dispatchScheduledRequests();
  assert.deepEqual(result, { reminders: 0, dispatched: 1 });
  const { rows } = await db.query(`SELECT status, expires_at > now() + interval '12 minutes' AS "coversPickup" FROM ride_requests WHERE public_id = $1`, [body.data.publicId]);
  assert.equal(rows[0].status, 'searching');
  assert.equal(rows[0].coversPickup, true);
  assert.equal((await pendingOffersFor(driver.userId)).length, 1);

  const { rows: inbox } = await db.query(`SELECT title FROM notifications WHERE user_id = $1 ORDER BY id`, [rider.userId]);
  assert.deepEqual(inbox.map((row) => row.title), ['Your scheduled ride is coming up', 'Finding a driver for your scheduled ride']);

  const tooFar = await book(rider, { scheduledFor: new Date(Date.now() + 8 * 86_400_000).toISOString() });
  assert.equal(tooFar.response.status, 422);
});

test('stops: priced on the longer route, copied to the trip, reached in order', async () => {
  const rider = await createUser();
  const driver = await createOnlineDriver();
  const { cityId, categoryId } = await market();

  const direct = await (await call('POST', '/rides/quote', { token: rider.token, body: { cityId, categoryId, pickup: PICKUP, dropoff: DROPOFF } })).json();
  const withStop = await (await call('POST', '/rides/quote', { token: rider.token, body: { cityId, categoryId, pickup: PICKUP, dropoff: DROPOFF, stops: [STOP] } })).json();
  assert.equal(withStop.data.distanceKm, direct.data.distanceKm + 3);
  assert.ok(withStop.data.totalFare > direct.data.totalFare);
  assert.equal(osrmUrls.at(-1).split('/route/v1/driving/')[1].split('?')[0].split(';').length, 3);

  const threeStops = await call('POST', '/rides/quote', { token: rider.token, body: { cityId, categoryId, pickup: PICKUP, dropoff: DROPOFF, stops: [STOP, STOP, STOP] } });
  assert.equal(threeStops.status, 422);

  await book(rider, { stops: [STOP] });
  const offer = (await pendingOffersFor(driver.userId))[0];
  const tripCode = await acceptAndComplete(driver, offer.id);

  const trip = await (await call('GET', `/trips/${tripCode}`, { token: driver.token })).json();
  assert.equal(trip.data.stops.length, 1);
  assert.equal(trip.data.stops[0].address, STOP.address);

  assert.equal((await call('POST', `/trips/${tripCode}/stops/2/arrived`, { token: driver.token })).status, 404);
  assert.equal((await call('POST', `/trips/${tripCode}/stops/1/arrived`, { token: driver.token })).status, 200);
  assert.equal((await call('POST', `/trips/${tripCode}/stops/1/arrived`, { token: driver.token })).status, 409);

  const completed = await (await call('POST', `/trips/${tripCode}/complete`, { token: driver.token, body: {} })).json();
  assert.equal(Number(completed.data.fare.total), withStop.data.totalFare);
});

test('surge: a live rule for the pickup zone raises the quote, and the booked multiplier is what the trip charges', async () => {
  const admin = await createUser(['ADMIN'], { accessLevel: 'ops' });
  const rider = await createUser();
  const driver = await createOnlineDriver();
  const { cityId, categoryId } = await market();

  const zone = await call('POST', '/admin/zones', {
    token: admin.token,
    body: { cityId, name: 'Gulshan surge test', zoneType: 'regular', points: [{ lat: 23.78, lng: 90.40 }, { lat: 23.78, lng: 90.42 }, { lat: 23.80, lng: 90.42 }, { lat: 23.80, lng: 90.40 }] },
  });
  const zoneId = (await zone.json()).data.id;

  const before = await (await call('POST', '/rides/quote', { token: rider.token, body: { cityId, categoryId, pickup: PICKUP, dropoff: DROPOFF } })).json();
  assert.equal((await call('POST', '/admin/surge', { token: admin.token, body: { zoneId, multiplier: 5, reason: 'demand' } })).status, 422);
  const surge = await call('POST', '/admin/surge', { token: admin.token, body: { zoneId, multiplier: 1.5, reason: 'weather' } });
  assert.equal(surge.status, 201, JSON.stringify(await surge.clone().json()));
  const surgeId = (await surge.json()).data.id;

  const during = await (await call('POST', '/rides/quote', { token: rider.token, body: { cityId, categoryId, pickup: PICKUP, dropoff: DROPOFF } })).json();
  assert.equal(during.data.surgeMultiplier, 1.5);
  assert.ok(during.data.surgeAmount > 0);
  assert.ok(during.data.totalFare > before.data.totalFare);

  await book(rider);
  const listed = await (await call('GET', '/admin/surge', { token: admin.token })).json();
  assert.equal(listed.data.find((row) => row.id === surgeId).isLive, true);
  assert.equal((await call('POST', `/admin/surge/${surgeId}/end`, { token: admin.token })).status, 200);

  const tripCode = await acceptAndComplete(driver, (await pendingOffersFor(driver.userId))[0].id);
  const completed = await (await call('POST', `/trips/${tripCode}/complete`, { token: driver.token, body: {} })).json();
  assert.ok(Number(completed.data.fare.surge) > 0, 'surge ended after booking, but the rider agreed to it');

  const after = await (await call('POST', '/rides/quote', { token: rider.token, body: { cityId, categoryId, pickup: PICKUP, dropoff: DROPOFF } })).json();
  assert.equal(after.data.surgeMultiplier, 1);
});

test('share link: public view with driver first name, car and position, never phones; tokens are not interchangeable', async () => {
  const rider = await createUser();
  const driver = await createOnlineDriver();
  await book(rider);
  const offer = (await pendingOffersFor(driver.userId))[0];
  const accepted = await (await call('POST', `/driver/offers/${offer.id}/respond`, { token: driver.token, body: { response: 'accepted' } })).json();
  const tripCode = accepted.data.trip.publicCode;

  assert.equal((await call('POST', `/trips/${tripCode}/share`, { token: driver.token })).status, 403);
  const shared = await call('POST', `/trips/${tripCode}/share`, { token: rider.token });
  assert.equal(shared.status, 201);
  const { url, token } = (await shared.json()).data;
  assert.ok(url.endsWith(`/share/${token}`));

  const view = await call('GET', `/share/${token}`);
  assert.equal(view.status, 200);
  const text = await view.text();
  assert.doesNotMatch(text, new RegExp(driver.phone));
  assert.doesNotMatch(text, new RegExp(rider.phone));
  const data = JSON.parse(text).data;
  assert.equal(data.driver.firstName, 'Feature');
  assert.equal(data.vehicle.registrationNo, `FP-REG-${driver.userId}`);
  assert.equal(data.location.lat, 23.7925);

  assert.equal((await call('GET', `/share/${rider.token}`)).status, 404, 'an access token is not a share link');
  assert.equal((await call('GET', '/me', { token })).status, 401, 'a share link is not an access token');

  await db.query(`UPDATE trips SET status = 'cancelled' WHERE trip_code = $1`, [tripCode]);
  await db.query(
    `INSERT INTO trip_cancellations (trip_id, cancelled_by_role, reason_code, cancelled_at)
     SELECT id, 'passenger', 'changed_mind', now() - interval '2 hours' FROM trips WHERE trip_code = $1`,
    [tripCode],
  );
  assert.equal((await call('GET', `/share/${token}`)).status, 410);
});

test('reports: once per trip, admins triage them, and the reporter hears back when closed', async () => {
  const rider = await createUser();
  const driver = await createOnlineDriver();
  const support = await createUser(['ADMIN'], { accessLevel: 'support' });
  await book(rider);
  const tripCode = await acceptAndComplete(driver, (await pendingOffersFor(driver.userId))[0].id);

  const filed = await call('POST', `/trips/${tripCode}/report`, { token: rider.token, body: { category: 'harassment', description: 'Rude and threatening' } });
  assert.equal(filed.status, 201);
  assert.equal((await call('POST', `/trips/${tripCode}/report`, { token: rider.token, body: { category: 'other' } })).status, 409);
  const detail = await (await call('GET', `/trips/${tripCode}`, { token: rider.token })).json();
  assert.equal(detail.data.reportedByMe, true);

  const queue = await (await call('GET', '/admin/reports', { token: support.token })).json();
  const report = queue.data.find((row) => row.tripCode === tripCode);
  assert.equal(Number(report.reported.id), driver.userId);
  assert.equal(report.reported.openReports, 1);

  assert.equal((await call('PATCH', `/admin/reports/${report.id}`, { token: support.token, body: { status: 'action_taken' } })).status, 200);
  assert.equal((await call('PATCH', `/admin/reports/${report.id}`, { token: support.token, body: { status: 'dismissed' } })).status, 409);
  const { rows } = await db.query(`SELECT title FROM notifications WHERE user_id = $1`, [rider.userId]);
  assert.ok(rows.some((row) => row.title === 'We reviewed your report'));
});

test('referrals: a code at sign-up pays both people once, after the new rider\'s first completed trip', async () => {
  const referrer = await createUser();
  const { rows: codeRows } = await db.query(
    `UPDATE users SET referral_code = 'FRIEND01' WHERE id = $1 RETURNING referral_code`,
    [referrer.userId],
  );
  assert.equal(codeRows[0].referral_code, 'FRIEND01');

  const badCode = await call('POST', '/auth/register', { body: { fullName: 'New Rider', phone: nextPhone(), password: 'Password123', referralCode: 'NOPE0000' } });
  assert.equal(badCode.status, 422);

  const phone = nextPhone();
  assert.equal((await call('POST', '/auth/register', { body: { fullName: 'New Rider', phone, password: 'Password123', referralCode: 'friend01' } })).status, 201);
  const { rows: users } = await db.query(`SELECT id, referral_code FROM users WHERE phone = $1`, [phone]);
  assert.match(users[0].referral_code, /^[0-9A-F]{8}$/);
  const newRider = { userId: Number(users[0].id), token: signAccessToken({ userId: Number(users[0].id), roles: ['PASSENGER'], sessionId: 1 }) };

  const summary = await (await call('GET', '/me/referral', { token: referrer.token })).json();
  assert.deepEqual({ ...summary.data, code: undefined }, { code: undefined, invited: 1, rewarded: 0, earned: 0, bonus: 50 });

  const driver = await createOnlineDriver();
  for (let ride = 0; ride < 2; ride += 1) {
    await book(newRider);
    const tripCode = await acceptAndComplete(driver, (await pendingOffersFor(driver.userId))[0].id);
    assert.equal((await call('POST', `/trips/${tripCode}/complete`, { token: driver.token, body: {} })).status, 200);
  }

  const { rows: wallets } = await db.query(
    `SELECT user_id::int AS "userId", balance::float8 AS balance FROM wallets WHERE user_id = ANY($1) ORDER BY user_id`,
    [[referrer.userId, newRider.userId]],
  );
  assert.deepEqual(wallets.map((row) => row.balance), [50, 50]);
  const after = await (await call('GET', '/me/referral', { token: referrer.token })).json();
  assert.equal(after.data.rewarded, 1);
  assert.equal(after.data.earned, 50);
});

test('delete account: needs the password, refuses during a trip, anonymises and frees the phone', async () => {
  const phone = nextPhone();
  await call('POST', '/auth/register', { body: { fullName: 'Leaving Soon', phone, password: 'Password123' } });
  await db.query(`UPDATE users SET phone_verified_at = now() WHERE phone = $1`, [phone]);
  const login = await (await call('POST', '/auth/login', { body: { phone, password: 'Password123' } })).json();
  const token = login.data.accessToken;

  assert.equal((await call('DELETE', '/me', { token, body: { password: 'WrongPass1' } })).status, 401);
  assert.equal((await call('DELETE', '/me', { token, body: { password: 'Password123' } })).status, 204);

  const { rows } = await db.query(`SELECT status, full_name, phone FROM users WHERE full_name = 'Deleted user' ORDER BY id DESC LIMIT 1`);
  assert.equal(rows[0].status, 'deleted');
  assert.match(rows[0].phone, /^deleted-\d+$/);
  assert.equal((await call('POST', '/auth/login', { body: { phone, password: 'Password123' } })).status, 401);
  assert.equal((await call('POST', '/auth/register', { body: { fullName: 'Back Again', phone, password: 'Password123' } })).status, 201);

  const rider = await createUser();
  const driver = await createOnlineDriver();
  await book(rider);
  await call('POST', `/driver/offers/${(await pendingOffersFor(driver.userId))[0].id}/respond`, { token: driver.token, body: { response: 'accepted' } });
  await db.query(`UPDATE users SET password_hash = (SELECT password_hash FROM users WHERE phone = $1) WHERE id = $2`, [phone, rider.userId]);
  const busy = await call('DELETE', '/me', { token: rider.token, body: { password: 'Password123' } });
  assert.equal(busy.status, 409);
  assert.equal((await busy.json()).error.code, 'ACTIVE_TRIP_EXISTS');
});

test('admin two-step login: set up with an authenticator code, then password alone is not enough', async () => {
  const phone = nextPhone();
  await call('POST', '/auth/register', { body: { fullName: 'Secure Admin', phone, password: 'Password123' } });
  const { rows } = await db.query(`UPDATE users SET phone_verified_at = now() WHERE phone = $1 RETURNING id`, [phone]);
  const adminId = Number(rows[0].id);
  await db.query(`INSERT INTO user_roles (user_id, role_id) SELECT $1, id FROM roles WHERE name = 'ADMIN'`, [adminId]);
  await db.query(`INSERT INTO admin_profiles (user_id, access_level) VALUES ($1, 'super')`, [adminId]);
  const token = signAccessToken({ userId: adminId, roles: ['PASSENGER', 'ADMIN'], sessionId: adminId });

  const setup = await (await call('POST', '/me/two-factor/setup', { token })).json();
  assert.match(setup.data.qrDataUrl, /^data:image\/png;base64,/);
  assert.match(setup.data.otpauthUrl, /^otpauth:\/\/totp\//);
  assert.equal((await call('POST', '/me/two-factor/enable', { token, body: { code: '000000' } })).status, 422);
  assert.equal((await call('POST', '/me/two-factor/enable', { token, body: { code: totpCode(setup.data.secret) } })).status, 200);

  const first = await (await call('POST', '/auth/login', { body: { phone, password: 'Password123' } })).json();
  assert.equal(first.data.twoFactorRequired, true);
  assert.equal(first.data.accessToken, undefined);
  assert.equal((await call('GET', '/me', { token: first.data.challengeToken })).status, 401);

  assert.equal((await call('POST', '/auth/login/2fa', { body: { challengeToken: first.data.challengeToken, code: '123456' } })).status, 401);
  const second = await call('POST', '/auth/login/2fa', { body: { challengeToken: first.data.challengeToken, code: totpCode(setup.data.secret) } });
  assert.equal(second.status, 200);
  assert.ok((await second.json()).data.accessToken);

  const rider = await createUser();
  assert.equal((await call('POST', '/me/two-factor/setup', { token: rider.token })).status, 403);
});

test('admin promos: ops create and edit codes (duplicates refused), riders can be notified, support cannot', async () => {
  const ops = await createUser(['ADMIN'], { accessLevel: 'ops' });
  const support = await createUser(['ADMIN'], { accessLevel: 'support' });
  const rider = await createUser();
  const promo = { code: 'rain20', promoType: 'percentage', value: 20, maxDiscount: 60, validFrom: new Date().toISOString(), notifyRiders: true };

  assert.equal((await call('POST', '/admin/promos', { token: support.token, body: promo })).status, 403);
  assert.equal((await call('POST', '/admin/promos', { token: ops.token, body: { ...promo, value: 150 } })).status, 422);
  const created = await call('POST', '/admin/promos', { token: ops.token, body: promo });
  assert.equal(created.status, 201);
  const { id, code, redemptions } = (await created.json()).data;
  assert.equal(code, 'RAIN20');
  assert.equal(redemptions, 0);
  assert.equal((await call('POST', '/admin/promos', { token: ops.token, body: promo })).status, 409);

  const { rows } = await db.query(`SELECT title FROM notifications WHERE user_id = $1`, [rider.userId]);
  assert.deepEqual(rows.map((row) => row.title), ['20% off with code RAIN20']);

  const edited = await call('PATCH', `/admin/promos/${id}`, { token: ops.token, body: { isActive: false } });
  assert.equal((await edited.json()).data.isActive, false);
  const list = await call('GET', '/admin/promos?limit=100', { token: support.token });
  assert.equal(list.status, 200);
});

test('admin exports: finance downloads trips as CSV; other access levels cannot', async () => {
  const finance = await createUser(['ADMIN'], { accessLevel: 'finance' });
  const ops = await createUser(['ADMIN'], { accessLevel: 'ops' });
  const rider = await createUser();
  const driver = await createOnlineDriver();
  await book(rider);
  const tripCode = await acceptAndComplete(driver, (await pendingOffersFor(driver.userId))[0].id);
  await call('POST', `/trips/${tripCode}/complete`, { token: driver.token, body: {} });

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' });
  assert.equal((await call('GET', `/admin/exports/trips.csv?from=${today}&to=${today}`, { token: ops.token })).status, 403);
  assert.equal((await call('GET', `/admin/exports/trips.csv?from=${today}&to=2020-01-01`, { token: finance.token })).status, 422);
  const csv = await call('GET', `/admin/exports/trips.csv?from=${today}&to=${today}`, { token: finance.token });
  assert.equal(csv.status, 200);
  assert.match(csv.headers.get('content-type'), /^text\/csv/);
  const text = await csv.text();
  const [header, ...lines] = text.replace(/^﻿/, '').split('\r\n');
  assert.match(header, /^tripCode,status,city,category,/);
  assert.ok(lines.some((line) => line.startsWith(`${tripCode},completed,Dhaka,Car,`)));
});

test('driver statements: monthly totals from the earnings ledger, with a per-trip breakdown', async () => {
  const rider = await createUser();
  const driver = await createOnlineDriver();
  await book(rider);
  const tripCode = await acceptAndComplete(driver, (await pendingOffersFor(driver.userId))[0].id);
  const completed = await (await call('POST', `/trips/${tripCode}/complete`, { token: driver.token, body: {} })).json();

  const month = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' }).slice(0, 7);
  const list = await (await call('GET', '/driver/statements', { token: driver.token })).json();
  assert.equal(list.data[0].month, month);
  assert.equal(list.data[0].tripsCount, 1);
  assert.equal(list.data[0].grossTotal, Number(completed.data.fare.total));

  const statement = await (await call('GET', `/driver/statements/${month}`, { token: driver.token })).json();
  assert.equal(statement.data.trips[0].tripCode, tripCode);
  assert.equal(statement.data.totals.netTotal + statement.data.totals.commissionTotal, statement.data.totals.grossTotal);
  assert.equal((await call('GET', '/driver/statements/2026-13', { token: driver.token })).status, 422);
});

test('private documents: stored outside the public folder, shown only through expiring signed links', async () => {
  const driver = await createOnlineDriver();
  const png = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000', 'hex');
  const uploaded = await call('POST', '/uploads?private=true', { token: driver.token, raw: png, contentType: 'image/png' });
  const ref = (await uploaded.json()).data.url;
  assert.match(ref, /^private:\/\/documents\/[0-9a-f]{32}\.png$/);
  const name = ref.split('/').pop();
  assert.equal((await realFetch(`${baseUrl}/uploads/${name}`)).status, 404, 'not in the public folder');

  const outside = await call('POST', '/driver/documents', { token: driver.token, body: { docType: 'nid', fileUrl: 'https://evil.example/nid.png' } });
  assert.equal(outside.status, 422);
  assert.equal((await call('POST', '/driver/documents', { token: driver.token, body: { docType: 'nid', fileUrl: ref } })).status, 201);
  const documents = await (await call('GET', '/driver/documents', { token: driver.token })).json();
  const listed = documents.data.find((document) => document.docType === 'nid').fileUrl;
  assert.match(listed, /\/api\/v1\/uploads\/private\/[0-9a-f]{32}\.png\?expires=\d+&signature=/);

  const { signPrivateUrl } = await import('../../src/services/storage.service.js');
  const signed = signPrivateUrl(ref).replace(env.PUBLIC_API_ORIGIN, baseUrl);
  const served = await realFetch(signed);
  assert.equal(served.status, 200);
  assert.equal(served.headers.get('content-type'), 'image/png');
  assert.deepEqual(Buffer.from(await served.arrayBuffer()), png);
  assert.equal((await realFetch(signed.replace(/signature=./, 'signature=X'))).status, 403);
  assert.equal((await realFetch(signed.replace(/expires=\d+/, 'expires=1000'))).status, 403);

  await rm(`${env.UPLOAD_DIR}-private/${name}`);
});

test('errors come back in Bangla when the app asks for it, English otherwise', async () => {
  const body = JSON.stringify({ phone: '01799999999', password: 'WrongPassword1' });
  const english = await realFetch(`${baseUrl}/api/v1/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body });
  assert.equal((await english.json()).error.message, 'Phone or password is incorrect.');
  const bangla = await realFetch(`${baseUrl}/api/v1/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json', 'accept-language': 'bn' }, body });
  const error = (await bangla.json()).error;
  assert.equal(error.code, 'BAD_CREDENTIALS');
  assert.equal(error.message, 'ফোন নম্বর বা পাসওয়ার্ড সঠিক নয়।');
});
