import assert from 'node:assert/strict';
import { once } from 'node:events';
import { after, afterEach, before, beforeEach, mock, test } from 'node:test';

import app from '../../src/app.js';
import { pool } from '../../src/config/db.js';
import { signAccessToken } from '../../src/utils/tokens.js';
import { logger } from '../../src/utils/logger.js';

let server;
let baseUrl;
let databaseClient;
let savepointCounter = 0;
let phoneCounter = 0;

before(async () => {
  databaseClient = await pool.connect();
  await databaseClient.query('BEGIN');

  mock.method(pool, 'query', (sql, values) => databaseClient.query(sql, values));
  mock.method(pool, 'connect', async () => {
    const savepointName = `m3_sp_${savepointCounter += 1}`;

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
  mock.method(logger, 'info', () => {});
  mock.method(logger, 'error', () => {});

  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

beforeEach(async () => {
  await databaseClient.query('SAVEPOINT test_savepoint');
});

afterEach(async () => {
  await databaseClient.query('ROLLBACK TO SAVEPOINT test_savepoint');
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

async function createUser({ verified = true, roles = ['PASSENGER'], admin = false } = {}) {
  phoneCounter += 1;
  const phone = `019${String(10000000 + phoneCounter).slice(-8)}`;
  const { rows } = await databaseClient.query(
    `INSERT INTO users (full_name, phone, password_hash, phone_verified_at)
     VALUES ($1, $2, 'test-hash', CASE WHEN $3 THEN now() ELSE NULL END)
     RETURNING id`,
    [admin ? 'M3 Admin' : 'M3 Driver', phone, verified],
  );
  const userId = rows[0].id;

  await databaseClient.query(
    `INSERT INTO user_roles (user_id, role_id)
     SELECT $1, id FROM roles WHERE name = ANY($2::varchar[])`,
    [userId, roles],
  );

  if (admin) {
    await databaseClient.query(
      `INSERT INTO admin_profiles (user_id, designation, access_level)
       VALUES ($1, 'KYC reviewer', 'super')`,
      [userId],
    );
  }

  return {
    userId,
    accessToken: signAccessToken({ userId, roles, sessionId: userId }),
  };
}

async function applyAsDriver(user = null) {
  const account = user ?? await createUser();
  const response = await request('POST', '/driver/apply', {
    accessToken: account.accessToken,
    body: {
      nidNumber: `${String(account.userId).padStart(9, '0')}1`,
      licenseNumber: `DL-M3-${account.userId}`,
      licenseExpiry: '2035-12-31',
    },
  });
  const body = await response.json();
  const driverToken = signAccessToken({
    userId: account.userId,
    roles: ['PASSENGER', 'DRIVER'],
    sessionId: account.userId,
  });

  return { ...account, response, body, driverToken };
}

async function bikeCategoryId() {
  const { rows } = await databaseClient.query(`SELECT id FROM vehicle_categories WHERE name = 'Bike'`);
  return rows[0].id;
}

const DRIVER_DOC_TYPES = ['license', 'nid', 'photo', 'police_clearance'];
const VEHICLE_DOC_TYPES = ['registration', 'fitness', 'insurance', 'tax_token'];

async function uploadDriverDocuments(driverToken) {
  const documents = [];
  for (const docType of DRIVER_DOC_TYPES) {
    const response = await request('POST', '/driver/documents', {
      accessToken: driverToken,
      body: {
        docType,
        fileUrl: `https://example.com/${docType}.jpg`,
        issueDate: '2025-01-01',
        expiryDate: '2035-01-01',
      },
    });
    assert.equal(response.status, 201);
    documents.push((await response.json()).data);
  }
  return documents;
}

async function createVehicle(driverToken, suffix = '01') {
  const response = await request('POST', '/driver/vehicles', {
    accessToken: driverToken,
    body: {
      categoryId: await bikeCategoryId(),
      registrationNo: `DHAKA METRO LA 11-${suffix}`,
      brand: 'Honda',
      model: 'CB Shine',
      modelYear: 2025,
      color: 'Red',
    },
  });
  return { response, body: await response.json() };
}

async function uploadVehicleDocuments(driverToken, vehicleId) {
  const documents = [];
  for (const docType of VEHICLE_DOC_TYPES) {
    const response = await request('POST', `/driver/vehicles/${vehicleId}/documents`, {
      accessToken: driverToken,
      body: {
        docType,
        fileUrl: `https://example.com/vehicle-${docType}.jpg`,
        issueDate: '2025-01-01',
        expiryDate: '2035-01-01',
      },
    });
    assert.equal(response.status, 201);
    documents.push((await response.json()).data);
  }
  return documents;
}

test('POST /driver/apply creates a pending profile, DRIVER role, and trigger-owned availability row', async () => {
  const result = await applyAsDriver();

  assert.equal(result.response.status, 201);
  assert.equal(result.body.data.verificationStatus, 'pending');

  const { rows } = await databaseClient.query(
    `SELECT dp.verification_status AS "verificationStatus", da.status,
            array_agg(r.name ORDER BY r.name) AS roles
     FROM driver_profiles dp
     JOIN driver_availability da ON da.driver_id = dp.user_id
     JOIN user_roles ur ON ur.user_id = dp.user_id
     JOIN roles r ON r.id = ur.role_id
     WHERE dp.user_id = $1
     GROUP BY dp.verification_status, da.status`,
    [result.userId],
  );

  assert.equal(rows[0].verificationStatus, 'pending');
  assert.equal(rows[0].status, 'offline');
  assert.deepEqual(rows[0].roles, ['DRIVER', 'PASSENGER']);

  const duplicate = await request('POST', '/driver/apply', {
    accessToken: result.accessToken,
    body: {
      nidNumber: '1234567890',
      licenseNumber: 'OTHER-LICENSE',
      licenseExpiry: '2035-12-31',
    },
  });
  assert.equal(duplicate.status, 409);
  assert.equal((await duplicate.json()).error.code, 'ALREADY_DRIVER');
});

test('driver application requires a verified phone and driver routes require the DRIVER role', async () => {
  const unverified = await createUser({ verified: false });
  const applyResponse = await request('POST', '/driver/apply', {
    accessToken: unverified.accessToken,
    body: {
      nidNumber: '1234567890',
      licenseNumber: 'DL-UNVERIFIED',
      licenseExpiry: '2035-12-31',
    },
  });
  assert.equal(applyResponse.status, 409);
  assert.equal((await applyResponse.json()).error.code, 'PHONE_NOT_VERIFIED');

  const passenger = await createUser();
  const statusResponse = await request('GET', '/driver/status', { accessToken: passenger.accessToken });
  assert.equal(statusResponse.status, 403);
  assert.equal((await statusResponse.json()).error.code, 'FORBIDDEN_ROLE');
});

test('driver document uploads preserve history and reject invalid date ranges', async () => {
  const driver = await applyAsDriver();
  const first = await request('POST', '/driver/documents', {
    accessToken: driver.driverToken,
    body: {
      docType: 'license',
      fileUrl: 'https://example.com/license-v1.jpg',
      issueDate: '2025-01-01',
      expiryDate: '2035-01-01',
    },
  });
  const second = await request('POST', '/driver/documents', {
    accessToken: driver.driverToken,
    body: {
      docType: 'license',
      fileUrl: 'https://example.com/license-v2.jpg',
      issueDate: '2026-01-01',
      expiryDate: '2036-01-01',
    },
  });
  assert.equal(first.status, 201);
  assert.equal(second.status, 201);

  const list = await request('GET', '/driver/documents', { accessToken: driver.driverToken });
  const listBody = await list.json();
  assert.equal(listBody.data.length, 2);
  assert.notEqual(listBody.data[0].id, listBody.data[1].id);

  const invalid = await request('POST', '/driver/documents', {
    accessToken: driver.driverToken,
    body: {
      docType: 'nid',
      fileUrl: 'https://example.com/nid.jpg',
      issueDate: '2035-01-01',
      expiryDate: '2030-01-01',
    },
  });
  assert.equal(invalid.status, 422);
});

test('vehicle endpoints enforce owner scoping and block pending vehicle activation', async () => {
  const owner = await applyAsDriver();
  const other = await applyAsDriver();
  const vehicle = await createVehicle(owner.driverToken, '1001');

  assert.equal(vehicle.response.status, 201);
  assert.equal(vehicle.body.data.verificationStatus, 'pending');

  const update = await request('PATCH', `/driver/vehicles/${vehicle.body.data.id}`, {
    accessToken: owner.driverToken,
    body: { color: 'Blue' },
  });
  assert.equal(update.status, 200);
  assert.equal((await update.json()).data.color, 'Blue');

  const idor = await request('PATCH', `/driver/vehicles/${vehicle.body.data.id}`, {
    accessToken: other.driverToken,
    body: { color: 'Black' },
  });
  assert.equal(idor.status, 404);

  const activate = await request('PUT', `/driver/vehicles/${vehicle.body.data.id}/activate`, {
    accessToken: owner.driverToken,
  });
  assert.equal(activate.status, 409);
  assert.equal((await activate.json()).error.code, 'VEHICLE_NOT_APPROVED');
});

test('an unapproved driver gets 409 DOCS_NOT_APPROVED when trying to go online', async () => {
  const driver = await applyAsDriver();
  const response = await request('PUT', '/driver/availability', {
    accessToken: driver.driverToken,
    body: { status: 'online', currentLat: 23.7801, currentLng: 90.4162 },
  });

  assert.equal(response.status, 409);
  assert.equal((await response.json()).error.code, 'DOCS_NOT_APPROVED');
});

test('admin routes reject non-admin roles and approval fails while documents are incomplete', async () => {
  const driver = await applyAsDriver();

  const forbidden = await request('GET', '/admin/drivers', { accessToken: driver.driverToken });
  assert.equal(forbidden.status, 403);

  const admin = await createUser({ roles: ['ADMIN'], admin: true });
  const incomplete = await request('POST', `/admin/drivers/${driver.userId}/approve`, {
    accessToken: admin.accessToken,
  });
  assert.equal(incomplete.status, 409);
  assert.equal((await incomplete.json()).error.code, 'DOCS_NOT_APPROVED');
});

test('admin rejection requires a reason, writes an audit row, and a re-upload reopens review', async () => {
  const driver = await applyAsDriver();
  const admin = await createUser({ roles: ['ADMIN'], admin: true });

  const missingReason = await request('POST', `/admin/drivers/${driver.userId}/reject`, {
    accessToken: admin.accessToken,
    body: {},
  });
  assert.equal(missingReason.status, 422);

  const reject = await request('POST', `/admin/drivers/${driver.userId}/reject`, {
    accessToken: admin.accessToken,
    body: { reason: 'NID details need correction' },
  });
  assert.equal(reject.status, 200);
  assert.equal((await reject.json()).data.verificationStatus, 'rejected');

  const { rows: auditRows } = await databaseClient.query(
    `SELECT action, new_value AS "newValue" FROM audit_logs
     WHERE actor_id = $1 AND entity_type = 'driver_profiles'`,
    [admin.userId],
  );
  assert.equal(auditRows[0].action, 'DRIVER_REJECTED');
  assert.equal(auditRows[0].newValue.reason, 'NID details need correction');

  const upload = await request('POST', '/driver/documents', {
    accessToken: driver.driverToken,
    body: { docType: 'nid', fileUrl: 'https://example.com/corrected-nid.jpg' },
  });
  assert.equal(upload.status, 201);

  const { rows: profileRows } = await databaseClient.query(
    `SELECT verification_status AS "verificationStatus"
     FROM driver_profiles WHERE user_id = $1`,
    [driver.userId],
  );
  assert.equal(profileRows[0].verificationStatus, 'pending');
});

test('DELETE /driver/vehicles/:id shelves the vehicle, clears on-duty selection, and goes offline', async () => {
  const driver = await applyAsDriver();
  const vehicleResult = await createVehicle(driver.driverToken, '3003');
  const vehicle = vehicleResult.body.data;

  await databaseClient.query(
    `UPDATE driver_profiles SET verification_status = 'approved' WHERE user_id = $1`,
    [driver.userId],
  );
  await databaseClient.query(
    `UPDATE vehicles SET verification_status = 'approved' WHERE id = $1`,
    [vehicle.id],
  );

  const activate = await request('PUT', `/driver/vehicles/${vehicle.id}/activate`, {
    accessToken: driver.driverToken,
  });
  assert.equal(activate.status, 200);
  const online = await request('PUT', '/driver/availability', {
    accessToken: driver.driverToken,
    body: { status: 'online', currentLat: 23.78, currentLng: 90.41 },
  });
  assert.equal(online.status, 200);

  const remove = await request('DELETE', `/driver/vehicles/${vehicle.id}`, {
    accessToken: driver.driverToken,
  });
  assert.equal(remove.status, 204);

  const { rows } = await databaseClient.query(
    `SELECT v.is_active AS "isActive", dp.active_vehicle_id AS "activeVehicleId",
            da.status
     FROM vehicles v
     JOIN driver_profiles dp ON dp.user_id = v.driver_id
     JOIN driver_availability da ON da.driver_id = v.driver_id
     WHERE v.id = $1`,
    [vehicle.id],
  );
  assert.equal(rows[0].isActive, false);
  assert.equal(rows[0].activeVehicleId, null);
  assert.equal(rows[0].status, 'offline');
});

test('complete M3 story: audited reviews and approvals produce an active dispatchable driver', async () => {
  const driver = await applyAsDriver();
  const admin = await createUser({ roles: ['ADMIN'], admin: true });
  const driverDocuments = await uploadDriverDocuments(driver.driverToken);
  const vehicleResult = await createVehicle(driver.driverToken, '2002');
  assert.equal(vehicleResult.response.status, 201);
  const vehicle = vehicleResult.body.data;
  const vehicleDocuments = await uploadVehicleDocuments(driver.driverToken, vehicle.id);

  const queue = await request('GET', '/admin/drivers?status=pending&page=1&limit=10', {
    accessToken: admin.accessToken,
  });
  const queueBody = await queue.json();
  assert.equal(queue.status, 200);
  assert.equal(queueBody.meta.total, 1);
  assert.equal(queueBody.data[0].id, driver.userId);
  assert.equal(queueBody.data[0].documents.length, 4);

  for (const document of driverDocuments) {
    const review = await request('POST', `/admin/documents/${document.id}/review`, {
      accessToken: admin.accessToken,
      body: { status: 'approved' },
    });
    assert.equal(review.status, 200);
  }
  for (const document of vehicleDocuments) {
    const review = await request('POST', `/admin/vehicle-documents/${document.id}/review`, {
      accessToken: admin.accessToken,
      body: { status: 'approved' },
    });
    assert.equal(review.status, 200);
  }

  const approveDriver = await request('POST', `/admin/drivers/${driver.userId}/approve`, {
    accessToken: admin.accessToken,
  });
  assert.equal(approveDriver.status, 200);
  assert.equal((await approveDriver.json()).data.verificationStatus, 'approved');

  const approveVehicle = await request('POST', `/admin/vehicles/${vehicle.id}/approve`, {
    accessToken: admin.accessToken,
  });
  assert.equal(approveVehicle.status, 200);
  assert.equal((await approveVehicle.json()).data.verificationStatus, 'approved');

  const activate = await request('PUT', `/driver/vehicles/${vehicle.id}/activate`, {
    accessToken: driver.driverToken,
  });
  assert.equal(activate.status, 200);
  assert.equal((await activate.json()).data.isOnDuty, true);

  const online = await request('PUT', '/driver/availability', {
    accessToken: driver.driverToken,
    body: {
      status: 'online',
      currentLat: 23.7801,
      currentLng: 90.4162,
      heading: 45,
    },
  });
  assert.equal(online.status, 200);
  assert.equal((await online.json()).data.status, 'online');

  const { rows: activeRows } = await databaseClient.query(
    `SELECT driver_id AS "driverId", vehicle_id AS "vehicleId"
     FROM v_active_drivers WHERE driver_id = $1`,
    [driver.userId],
  );
  assert.deepEqual(activeRows, [{ driverId: driver.userId, vehicleId: vehicle.id }]);

  const { rows: auditRows } = await databaseClient.query(
    `SELECT action, actor_id AS "actorId", actor_role AS "actorRole"
     FROM audit_logs WHERE actor_id = $1 ORDER BY id`,
    [admin.userId],
  );
  assert.equal(auditRows.length, 10);
  assert.ok(auditRows.every((row) => row.actorId === admin.userId && row.actorRole === 'ADMIN'));
  assert.ok(auditRows.some((row) => row.action === 'DRIVER_APPROVED'));
  assert.ok(auditRows.some((row) => row.action === 'VEHICLE_APPROVED'));
});
