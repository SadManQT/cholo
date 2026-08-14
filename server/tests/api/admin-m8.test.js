import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, mock, test } from 'node:test';

import supertest from 'supertest';

import app from '../../src/app.js';
import { pool } from '../../src/config/db.js';
import { logger } from '../../src/utils/logger.js';
import { signAccessToken } from '../../src/utils/tokens.js';

let client;
let savepointCounter = 0;
let admin;
let passenger;
let target;

function tokenFor(userId, roles) {
  return signAccessToken({ userId, roles, sessionId: userId });
}

async function createUser(phone, fullName, roles) {
  const { rows } = await client.query(
    `INSERT INTO users (full_name, phone, password_hash, phone_verified_at)
     VALUES ($1, $2, 'test-hash', now()) RETURNING id`,
    [fullName, phone],
  );
  const userId = rows[0].id;
  await client.query(
    `INSERT INTO user_roles (user_id, role_id)
     SELECT $1, id FROM roles WHERE name = ANY($2::varchar[])`,
    [userId, roles],
  );
  if (roles.includes('PASSENGER')) {
    await client.query(`INSERT INTO passenger_profiles (user_id) VALUES ($1)`, [userId]);
  }
  return { userId, token: tokenFor(userId, roles) };
}

before(async () => {
  client = await pool.connect();
  await client.query('BEGIN');
  mock.method(pool, 'query', (sql, values) => client.query(sql, values));
  mock.method(pool, 'connect', async () => {
    const savepoint = `m8_nested_${savepointCounter += 1}`;
    return {
      async query(sql, values) {
        const command = typeof sql === 'string' ? sql.trim().toUpperCase() : '';
        if (command === 'BEGIN') return client.query(`SAVEPOINT ${savepoint}`);
        if (command === 'COMMIT') return client.query(`RELEASE SAVEPOINT ${savepoint}`);
        if (command === 'ROLLBACK') return client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
        return client.query(sql, values);
      },
      release() {},
    };
  });
  mock.method(logger, 'warn', () => {});

  admin = await createUser('01388000001', 'M8 Super Admin', ['ADMIN']);
  await client.query(`INSERT INTO admin_profiles (user_id, access_level) VALUES ($1, 'super')`, [admin.userId]);
  passenger = await createUser('01388000002', 'M8 Passenger', ['PASSENGER']);
  target = await createUser('01388000003', 'M8 Target User', ['PASSENGER']);
});

beforeEach(async () => {
  await client.query('SAVEPOINT m8_test');
});

afterEach(async () => {
  await client.query('ROLLBACK TO SAVEPOINT m8_test');
});

after(async () => {
  mock.restoreAll();
  await client.query('ROLLBACK');
  client.release();
  await pool.end();
});

test('admin dashboard and queues require ADMIN and return operational KPIs', async () => {
  const unauthenticated = await supertest(app).get('/api/v1/admin/stats');
  assert.equal(unauthenticated.status, 401);

  const wrongRole = await supertest(app).get('/api/v1/admin/stats').set('Authorization', `Bearer ${passenger.token}`);
  assert.equal(wrongRole.status, 403);

  const response = await supertest(app).get('/api/v1/admin/stats').set('Authorization', `Bearer ${admin.token}`);
  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.equal(typeof response.body.data.tripsToday, 'number');
  assert.equal(response.body.data.trend.length, 6);
});

test('ops user controls revoke sessions and write readable audit records', async () => {
  await client.query(
    `INSERT INTO login_sessions (user_id, device_type, is_active) VALUES ($1, 'web', true)`,
    [target.userId],
  );

  const suspended = await supertest(app)
    .post(`/api/v1/admin/users/${target.userId}/suspend`)
    .set('Authorization', `Bearer ${admin.token}`)
    .send({ reason: 'M8 automated policy test' });
  assert.equal(suspended.status, 200);
  assert.equal(suspended.body.data.status, 'suspended');

  const { rows: sessionRows } = await client.query(
    `SELECT is_active AS "isActive" FROM login_sessions WHERE user_id = $1`, [target.userId],
  );
  assert.equal(sessionRows[0].isActive, false);

  const audit = await supertest(app)
    .get('/api/v1/admin/audit-logs?entityType=users')
    .set('Authorization', `Bearer ${admin.token}`);
  assert.equal(audit.status, 200);
  assert.ok(audit.body.data.some((row) => row.action === 'USER_SUSPENDED'));

  const reinstated = await supertest(app)
    .post(`/api/v1/admin/users/${target.userId}/reinstate`)
    .set('Authorization', `Bearer ${admin.token}`)
    .send({ reason: 'Review complete' });
  assert.equal(reinstated.status, 200);
  assert.equal(reinstated.body.data.status, 'active');
});

test('pricing publisher appends a new card and rejects an overlapping replay', async () => {
  const { rows: marketRows } = await client.query(
    `SELECT c.id AS "cityId", vc.id AS "categoryId" FROM cities c CROSS JOIN vehicle_categories vc
     WHERE c.name = 'Dhaka' AND vc.name = 'Bike'`,
  );
  const input = {
    ...marketRows[0], baseFare: 30, perKmRate: 13, perMinRate: 1.2, minimumFare: 45,
    bookingFee: 5, waitingPerMin: 2, freeWaitMinutes: 2, cancellationFee: 20,
    effectiveFrom: new Date(Date.now() + 86_400_000).toISOString(),
  };
  const created = await supertest(app)
    .post('/api/v1/admin/pricing-rules')
    .set('Authorization', `Bearer ${admin.token}`).send(input);
  assert.equal(created.status, 201);
  assert.equal(created.body.data.baseFare, '30.00');

  const replay = await supertest(app)
    .post('/api/v1/admin/pricing-rules')
    .set('Authorization', `Bearer ${admin.token}`).send(input);
  assert.equal(replay.status, 409);
  assert.equal(replay.body.error.code, 'PRICING_WINDOW_OVERLAP');
});

test('support ticket flows from customer creation to an admin reply and resolution', async () => {
  const created = await supertest(app)
    .post('/api/v1/support/tickets')
    .set('Authorization', `Bearer ${passenger.token}`)
    .send({ category: 'app_issue', subject: 'Map did not refresh', description: 'The driver marker stopped moving.' });
  assert.equal(created.status, 201);
  const ticketId = created.body.data.id;

  const queue = await supertest(app)
    .get('/api/v1/admin/support/tickets')
    .set('Authorization', `Bearer ${admin.token}`);
  assert.ok(queue.body.data.some((row) => row.id === ticketId));

  const reply = await supertest(app)
    .post(`/api/v1/admin/support/tickets/${ticketId}/messages`)
    .set('Authorization', `Bearer ${admin.token}`)
    .send({ body: 'We are checking the tracking logs.', isInternalNote: false });
  assert.equal(reply.status, 201);

  const customerView = await supertest(app)
    .get(`/api/v1/support/tickets/${ticketId}`)
    .set('Authorization', `Bearer ${passenger.token}`);
  assert.equal(customerView.status, 200);
  assert.equal(customerView.body.data.messages.length, 2);

  const customerReply = await supertest(app)
    .post(`/api/v1/support/tickets/${ticketId}/messages`)
    .set('Authorization', `Bearer ${passenger.token}`)
    .send({ body: 'Thank you. It happened near Dhanmondi.' });
  assert.equal(customerReply.status, 201);

  const resolved = await supertest(app)
    .patch(`/api/v1/admin/support/tickets/${ticketId}`)
    .set('Authorization', `Bearer ${admin.token}`)
    .send({ status: 'resolved', assignedToMe: true });
  assert.equal(resolved.status, 200);
  assert.equal(resolved.body.data.status, 'resolved');
});

async function createTrip(status) {
  const driver = await createUser(`01389${String(savepointCounter).padStart(6, '0').slice(-6)}`, 'M8 Driver', ['DRIVER']);
  await client.query(
    `INSERT INTO driver_profiles (user_id, nid_number, license_number, license_expiry, verification_status)
     VALUES ($1, $2, $3, current_date + 365, 'approved')`,
    [driver.userId, String(driver.userId).padStart(10, '0'), `M8-LIC-${driver.userId}`],
  );
  const { rows: vehicleRows } = await client.query(
    `INSERT INTO vehicles (driver_id, category_id, registration_no, verification_status)
     SELECT $1, id, $2, 'approved' FROM vehicle_categories WHERE name = 'Car' RETURNING id`,
    [driver.userId, `M8-REG-${driver.userId}`],
  );
  const { rows: requestRows } = await client.query(
    `INSERT INTO ride_requests
      (passenger_id, city_id, category_id, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng,
       est_fare, payment_intent, status)
     SELECT $1, c.id, vc.id, 23.75, 90.38, 23.79, 90.41, 100, 'cash', 'matched'
     FROM cities c CROSS JOIN vehicle_categories vc WHERE c.name = 'Dhaka' AND vc.name = 'Car'
     RETURNING id`,
    [passenger.userId],
  );
  const completed = status === 'completed';
  const { rows: tripRows } = await client.query(
    `INSERT INTO trips
      (request_id, passenger_id, driver_id, vehicle_id, status, arrived_at, started_at, completed_at,
       base_fare, distance_fare, total_fare, payment_status)
     VALUES ($1,$2,$3,$4,$5,
       CASE WHEN $6 THEN now() ELSE NULL END, CASE WHEN $6 THEN now() ELSE NULL END,
       CASE WHEN $6 THEN now() ELSE NULL END, CASE WHEN $6 THEN 20 ELSE 0 END,
       CASE WHEN $6 THEN 80 ELSE 0 END, CASE WHEN $6 THEN 100 ELSE 0 END,
       CASE WHEN $6 THEN 'paid'::trip_payment_status ELSE 'unpaid'::trip_payment_status END)
     RETURNING id, trip_code AS "tripCode"`,
    [requestRows[0].id, passenger.userId, driver.userId, vehicleRows[0].id, status, completed],
  );
  return tripRows[0];
}

test('finance dispute resolution refunds once through the immutable wallet ledger', async () => {
  const trip = await createTrip('completed');
  const { rows: paymentRows } = await client.query(
    `INSERT INTO payments (purpose, trip_id, payer_id, method_type, amount, status, completed_at)
     VALUES ('trip', $1, $2, 'cash', 100, 'succeeded', now()) RETURNING id`,
    [trip.id, passenger.userId],
  );
  const before = await client.query(`SELECT balance FROM wallets WHERE user_id = $1`, [passenger.userId]);
  const created = await supertest(app)
    .post('/api/v1/disputes').set('Authorization', `Bearer ${passenger.token}`)
    .send({ tripPublicId: trip.tripCode, disputeType: 'fare_overcharge', description: 'The final fare is too high.', disputedAmount: 40 });
  assert.equal(created.status, 201);

  const resolved = await supertest(app)
    .post(`/api/v1/admin/disputes/${created.body.data.id}/resolve`)
    .set('Authorization', `Bearer ${admin.token}`)
    .send({ status: 'resolved_refunded', resolutionNote: 'Verified fare issue.', refundAmount: 40 });
  assert.equal(resolved.status, 200);
  assert.equal(resolved.body.data.status, 'resolved_refunded');

  const after = await client.query(`SELECT balance FROM wallets WHERE user_id = $1`, [passenger.userId]);
  assert.equal(Number(after.rows[0].balance) - Number(before.rows[0].balance), 40);
  const payment = await client.query(`SELECT status, refund_amount AS "refundAmount" FROM payments WHERE id = $1`, [paymentRows[0].id]);
  assert.deepEqual(payment.rows[0], { status: 'refunded', refundAmount: '40.00' });

  const replay = await supertest(app)
    .post(`/api/v1/admin/disputes/${created.body.data.id}/resolve`)
    .set('Authorization', `Bearer ${admin.token}`)
    .send({ status: 'resolved_refunded', resolutionNote: 'Replay must not credit twice.', refundAmount: 40 });
  assert.equal(replay.status, 409);
  const afterReplay = await client.query(`SELECT balance FROM wallets WHERE user_id = $1`, [passenger.userId]);
  assert.equal(afterReplay.rows[0].balance, after.rows[0].balance);
});

test('SOS is accepted without a limiter and follows acknowledge then resolve lifecycle', async () => {
  const trip = await createTrip('assigned');
  const triggered = await supertest(app)
    .post(`/api/v1/trips/${trip.tripCode}/sos`)
    .set('Authorization', `Bearer ${passenger.token}`)
    .send({ lat: 23.75, lng: 90.38 });
  assert.equal(triggered.status, 201);
  assert.equal(triggered.headers['ratelimit-limit'], undefined);
  const alertId = triggered.body.data.id;

  const acknowledged = await supertest(app)
    .post(`/api/v1/admin/sos/${alertId}/acknowledge`)
    .set('Authorization', `Bearer ${admin.token}`);
  assert.equal(acknowledged.status, 200);
  assert.equal(acknowledged.body.data.status, 'acknowledged');

  const resolved = await supertest(app)
    .post(`/api/v1/admin/sos/${alertId}/resolve`)
    .set('Authorization', `Bearer ${admin.token}`)
    .send({ status: 'resolved', resolutionNote: 'Passenger reached and confirmed safe.' });
  assert.equal(resolved.status, 200);
  assert.equal(resolved.body.data.status, 'resolved');
});
