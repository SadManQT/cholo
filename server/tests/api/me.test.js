import assert from 'node:assert/strict';
import { once } from 'node:events';
import { after, afterEach, before, beforeEach, mock, test } from 'node:test';

import app from '../../src/app.js';
import { pool } from '../../src/config/db.js';
import { logger } from '../../src/utils/logger.js';

let server;
let baseUrl;
let databaseClient;
let infoLog;
let savepointCounter = 0;

before(async () => {
  databaseClient = await pool.connect();
  await databaseClient.query('BEGIN');

  mock.method(pool, 'query', (sql, values) => databaseClient.query(sql, values));
  // /auth/refresh (exercised by the change-password test below) manages its
  // own real transaction via pool.connect() — see tests/api/auth.test.js
  // for why this needs translating into nested SAVEPOINTs here too.
  mock.method(pool, 'connect', async () => {
    const savepointName = `me_refresh_sp_${savepointCounter += 1}`;

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
  infoLog = mock.method(logger, 'info', () => {});

  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');

  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
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

function request(method, path, { body, accessToken, cookie } = {}) {
  const headers = {};
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (accessToken) headers.authorization = `Bearer ${accessToken}`;
  if (cookie) headers.cookie = cookie;

  return fetch(`${baseUrl}/api/v1${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function extractCookie(response, name) {
  return response.headers.getSetCookie().find((entry) => entry.startsWith(`${name}=`))?.split(';')[0];
}

function otpSentTo(phone) {
  const call = infoLog.mock.calls.findLast((entry) => entry.arguments[1]?.phone === phone);
  return call?.arguments[1]?.message.match(/(\d{6})$/)?.[1];
}

const PASSWORD = 'Password123';

async function registerVerifiedUser(phone) {
  await request('POST', '/auth/register', { body: { fullName: 'Nusrat Jahan', phone, password: PASSWORD } });
  const otp = otpSentTo(phone);
  const response = await request('POST', '/auth/verify-otp', { body: { phone, otp, purpose: 'signup' } });
  const body = await response.json();

  return {
    accessToken: body.data.accessToken,
    refreshCookie: extractCookie(response, 'refreshToken'),
  };
}

test('GET /me requires a bearer token', async () => {
  const response = await request('GET', '/me');
  const body = await response.json();

  assert.equal(response.status, 401);
  assert.equal(body.error.code, 'AUTH_REQUIRED');
});

test('GET /me returns the caller\'s own profile, roles, and wallet', async () => {
  const phone = '01722000001';
  const { accessToken } = await registerVerifiedUser(phone);

  const response = await request('GET', '/me', { accessToken });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.match(body.data.id, /^[0-9a-f-]{36}$/);
  assert.equal(body.data.fullName, 'Nusrat Jahan');
  assert.equal(body.data.phone, phone);
  assert.equal(body.data.email, null);
  assert.deepEqual(body.data.roles, ['PASSENGER']);
  assert.notEqual(body.data.phoneVerifiedAt, null);
  assert.equal(body.data.wallet.balance, '0.00');
  assert.equal(body.data.wallet.currency, 'BDT');
  assert.equal(body.data.passwordHash, undefined);
});

test('PATCH /me updates only the provided fields', async () => {
  const phone = '01722000002';
  const { accessToken } = await registerVerifiedUser(phone);

  const response = await request('PATCH', '/me', {
    accessToken,
    body: { fullName: 'Nusrat J. Rahman', preferredLanguage: 'bn' },
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.data.fullName, 'Nusrat J. Rahman');
  assert.equal(body.data.preferredLanguage, 'bn');
  assert.equal(body.data.phone, phone);

  const { rows } = await databaseClient.query(
    `SELECT full_name AS "fullName", preferred_language AS "preferredLanguage" FROM users WHERE phone = $1`,
    [phone],
  );
  assert.equal(rows[0].fullName, 'Nusrat J. Rahman');
  assert.equal(rows[0].preferredLanguage, 'bn');
});

test('PATCH /me rejects an empty body with 422 VALIDATION_FAILED', async () => {
  const phone = '01722000003';
  const { accessToken } = await registerVerifiedUser(phone);

  const response = await request('PATCH', '/me', { accessToken, body: {} });
  const body = await response.json();

  assert.equal(response.status, 422);
  assert.equal(body.error.code, 'VALIDATION_FAILED');
});

test('PATCH /me rejects an email already used by another account with 409 DUPLICATE', async () => {
  const takenEmail = 'nusrat@example.com';
  const first = await registerVerifiedUser('01722000004');
  const second = await registerVerifiedUser('01722000005');

  const claimEmail = await request('PATCH', '/me', { accessToken: first.accessToken, body: { email: takenEmail } });
  assert.equal(claimEmail.status, 200);

  const conflict = await request('PATCH', '/me', { accessToken: second.accessToken, body: { email: takenEmail } });
  const conflictBody = await conflict.json();

  assert.equal(conflict.status, 409);
  assert.equal(conflictBody.error.code, 'DUPLICATE');
});

test('PATCH /me/password rejects the wrong current password with 401 CURRENT_PASSWORD_INVALID', async () => {
  const phone = '01722000007';
  const { accessToken } = await registerVerifiedUser(phone);

  const response = await request('PATCH', '/me/password', {
    accessToken,
    body: { currentPassword: 'WrongPassword1', newPassword: 'NewPassword123' },
  });
  const body = await response.json();

  assert.equal(response.status, 401);
  assert.equal(body.error.code, 'CURRENT_PASSWORD_INVALID');
});

test('PATCH /me/password changes the password and revokes every other session, keeping the caller\'s own alive', async () => {
  const phone = '01722000008';
  const first = await registerVerifiedUser(phone);

  const secondLogin = await request('POST', '/auth/login', { body: { phone, password: PASSWORD } });
  const secondRefreshCookie = extractCookie(secondLogin, 'refreshToken');
  assert.equal(secondLogin.status, 200);

  const response = await request('PATCH', '/me/password', {
    accessToken: first.accessToken,
    body: { currentPassword: PASSWORD, newPassword: 'NewPassword123' },
  });
  assert.equal(response.status, 204);

  // the session that changed the password keeps working, for both its
  // access token and its refresh token
  const stillWorks = await request('GET', '/me', { accessToken: first.accessToken });
  assert.equal(stillWorks.status, 200);

  const ownRefreshStillWorks = await request('POST', '/auth/refresh', { cookie: first.refreshCookie });
  assert.equal(ownRefreshStillWorks.status, 200);

  // the OTHER session was killed
  const otherRefreshDead = await request('POST', '/auth/refresh', { cookie: secondRefreshCookie });
  assert.equal(otherRefreshDead.status, 401);

  // old password no longer works, new one does
  const loginWithOldPassword = await request('POST', '/auth/login', { body: { phone, password: PASSWORD } });
  assert.equal(loginWithOldPassword.status, 401);

  const loginWithNewPassword = await request('POST', '/auth/login', {
    body: { phone, password: 'NewPassword123' },
  });
  assert.equal(loginWithNewPassword.status, 200);
});
