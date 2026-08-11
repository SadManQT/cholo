import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
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
  // auth.service's refresh() checks out its own connection and runs its own
  // BEGIN/COMMIT/ROLLBACK (it needs a real transaction for SELECT ... FOR
  // UPDATE). The whole suite already lives inside one outer, never-committed
  // transaction on `databaseClient`, so a second real connection wouldn't
  // see any of this suite's uncommitted rows. Fake pool.connect() to hand
  // back the same client, translating BEGIN/COMMIT/ROLLBACK into nested
  // SAVEPOINTs instead of running them for real.
  mock.method(pool, 'connect', async () => {
    const savepointName = `refresh_sp_${savepointCounter += 1}`;

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

// A real constraint violation (e.g. the duplicate-phone test) aborts the
// whole Postgres transaction, not just the failed statement — every query
// after it would error with "current transaction is aborted" without a
// savepoint boundary per test to roll back to.
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

function postJson(path, body, extraHeaders = {}) {
  return fetch(`${baseUrl}/api/v1${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...extraHeaders },
    body: JSON.stringify(body),
  });
}

function extractCookie(response, name) {
  return response.headers.getSetCookie().find((entry) => entry.startsWith(`${name}=`))?.split(';')[0];
}

function sha256Hex(value) {
  return createHash('sha256').update(value).digest('hex');
}

function rawTokenFromCookie(cookie) {
  return decodeURIComponent(cookie.split('=')[1]);
}

// The SMS gateway is mocked to logger.info (which prints to the console) —
// pull the code back out of the mocked call so tests can complete the flow
// without a real gateway.
function otpSentTo(phone) {
  const call = infoLog.mock.calls.findLast((entry) => entry.arguments[1]?.phone === phone);
  return call?.arguments[1]?.message.match(/(\d{6})$/)?.[1];
}

async function registerUser(phone, overrides = {}) {
  const response = await postJson('/auth/register', {
    fullName: 'Nusrat Jahan',
    phone,
    password: 'Password123',
    ...overrides,
  });
  const body = await response.json();
  return { response, body, otp: otpSentTo(phone) };
}

async function registerVerifiedUser(phone) {
  const { otp } = await registerUser(phone);
  const response = await postJson('/auth/verify-otp', { phone, otp, purpose: 'signup' });
  const body = await response.json();

  return {
    accessToken: body.data.accessToken,
    refreshCookie: extractCookie(response, 'refreshToken'),
  };
}

test('POST /auth/register creates an unverified user with a bcrypt password hash and PASSENGER role', async () => {
  const phone = '01711000001';
  const { response, body, otp } = await registerUser(phone);

  assert.equal(response.status, 201);
  assert.equal(body.success, true);
  assert.match(body.data.userId, /^[0-9a-f-]{36}$/);
  assert.match(otp, /^\d{6}$/);
  // proves the real route is actually wired with a limiter, not just the
  // standalone factory (see tests/unit/rateLimit.test.js for 429 behavior)
  assert.ok(response.headers.get('ratelimit-limit'));

  const { rows } = await databaseClient.query(
    `SELECT password_hash AS "passwordHash", phone_verified_at AS "phoneVerifiedAt"
     FROM users WHERE phone = $1`,
    [phone],
  );

  assert.equal(rows.length, 1);
  assert.notEqual(rows[0].passwordHash, 'Password123');
  assert.match(rows[0].passwordHash, /^\$2[aby]\$/);
  assert.equal(rows[0].phoneVerifiedAt, null);

  const { rows: roleRows } = await databaseClient.query(
    `SELECT r.name FROM user_roles ur
     JOIN roles r ON r.id = ur.role_id
     JOIN users u ON u.id = ur.user_id
     WHERE u.phone = $1`,
    [phone],
  );
  assert.deepEqual(roleRows, [{ name: 'PASSENGER' }]);

  const { rows: otpRows } = await databaseClient.query(
    `SELECT otp_hash AS "otpHash" FROM otp_verifications WHERE phone = $1`,
    [phone],
  );
  assert.notEqual(otpRows[0].otpHash, otp);
});

test('POST /auth/register rejects a phone already in use with 409 DUPLICATE', async () => {
  const phone = '01711000002';
  await registerUser(phone);

  const response = await postJson('/auth/register', {
    fullName: 'Second User',
    phone,
    password: 'Password123',
  });
  const body = await response.json();

  assert.equal(response.status, 409);
  assert.equal(body.error.code, 'DUPLICATE');
});

test('POST /auth/register rejects an invalid phone with 422 VALIDATION_FAILED', async () => {
  const response = await postJson('/auth/register', {
    fullName: 'Bad Phone',
    phone: '12345',
    password: 'Password123',
  });
  const body = await response.json();

  assert.equal(response.status, 422);
  assert.equal(body.error.code, 'VALIDATION_FAILED');
});

test('POST /auth/verify-otp rejects a wrong code without revealing the right one', async () => {
  const phone = '01711000003';
  await registerUser(phone);

  const response = await postJson('/auth/verify-otp', { phone, otp: '000000', purpose: 'signup' });
  const body = await response.json();

  assert.equal(response.status, 401);
  assert.equal(body.error.code, 'OTP_INVALID');
});

test('POST /auth/verify-otp locks out after 5 wrong attempts with 429 RATE_LIMITED', async () => {
  const phone = '01711000004';
  await registerUser(phone);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await postJson('/auth/verify-otp', { phone, otp: '000000', purpose: 'signup' });
    assert.equal(response.status, 401);
  }

  const response = await postJson('/auth/verify-otp', { phone, otp: '000000', purpose: 'signup' });
  const body = await response.json();

  assert.equal(response.status, 429);
  assert.equal(body.error.code, 'RATE_LIMITED');
});

test('POST /auth/verify-otp rejects an expired code with 410 OTP_EXPIRED', async () => {
  const phone = '01711000005';
  const { otp } = await registerUser(phone);

  await databaseClient.query(
    `UPDATE otp_verifications SET expires_at = now() - interval '1 minute' WHERE phone = $1`,
    [phone],
  );

  const response = await postJson('/auth/verify-otp', { phone, otp, purpose: 'signup' });
  const body = await response.json();

  assert.equal(response.status, 410);
  assert.equal(body.error.code, 'OTP_EXPIRED');
});

test('POST /auth/verify-otp with the right code verifies the phone and mints tokens', async () => {
  const phone = '01711000006';
  const { otp } = await registerUser(phone);

  const response = await postJson('/auth/verify-otp', { phone, otp, purpose: 'signup' });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(typeof body.data.accessToken, 'string');
  assert.equal(body.data.user.phone, phone);
  assert.deepEqual(body.data.user.roles, ['PASSENGER']);
  assert.equal(body.data.user.passwordHash, undefined);

  const setCookie = response.headers.getSetCookie().join(';');
  assert.match(setCookie, /refreshToken=/);
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /SameSite=Strict/i);

  const { rows } = await databaseClient.query(
    `SELECT phone_verified_at AS "phoneVerifiedAt" FROM users WHERE phone = $1`,
    [phone],
  );
  assert.notEqual(rows[0].phoneVerifiedAt, null);

  const { rows: sessionRows } = await databaseClient.query(
    `SELECT ls.id FROM login_sessions ls
     JOIN users u ON u.id = ls.user_id
     WHERE u.phone = $1`,
    [phone],
  );
  assert.equal(sessionRows.length, 1);

  // the same code cannot be replayed
  const replay = await postJson('/auth/verify-otp', { phone, otp, purpose: 'signup' });
  assert.equal(replay.status, 401);
});

test('POST /auth/resend-otp sends a new code that verifies, and supersedes the old one', async () => {
  const phone = '01711000020';
  const { otp: firstOtp } = await registerUser(phone);

  const resend = await postJson('/auth/resend-otp', { phone, purpose: 'signup' });
  assert.equal(resend.status, 204);

  const secondOtp = otpSentTo(phone);
  assert.notEqual(secondOtp, firstOtp);

  // findLatestActive (otp.repository.js) orders by created_at DESC — the
  // new code is what verify-otp now checks against.
  const verifyWithNew = await postJson('/auth/verify-otp', { phone, otp: secondOtp, purpose: 'signup' });
  assert.equal(verifyWithNew.status, 200);
});

test('POST /auth/resend-otp returns 204 for a phone with no pending signup — no enumeration', async () => {
  const response = await postJson('/auth/resend-otp', { phone: '01799999999', purpose: 'signup' });
  assert.equal(response.status, 204);
});

test('POST /auth/resend-otp returns 204 for an already-verified phone without sending anything', async () => {
  const phone = '01711000021';
  const { otp } = await registerUser(phone);
  await postJson('/auth/verify-otp', { phone, otp, purpose: 'signup' });
  infoLog.mock.resetCalls();

  const response = await postJson('/auth/resend-otp', { phone, purpose: 'signup' });
  assert.equal(response.status, 204);
  assert.equal(otpSentTo(phone), undefined);
});

test('POST /auth/login rejects a wrong password and an unknown phone the same way', async () => {
  const phone = '01711000007';
  const { otp } = await registerUser(phone);
  await postJson('/auth/verify-otp', { phone, otp, purpose: 'signup' });

  const wrongPassword = await postJson('/auth/login', { phone, password: 'WrongPassword1' });
  const wrongPasswordBody = await wrongPassword.json();

  const unknownPhone = await postJson('/auth/login', { phone: '01799999999', password: 'WrongPassword1' });
  const unknownPhoneBody = await unknownPhone.json();

  assert.equal(wrongPassword.status, 401);
  assert.equal(unknownPhone.status, 401);
  assert.deepEqual(wrongPasswordBody, unknownPhoneBody);
  assert.equal(wrongPasswordBody.error.code, 'BAD_CREDENTIALS');
});

test('POST /auth/login succeeds with correct credentials and mints a fresh session', async () => {
  const phone = '01711000008';
  const { otp } = await registerUser(phone);
  await postJson('/auth/verify-otp', { phone, otp, purpose: 'signup' });

  const response = await postJson('/auth/login', { phone, password: 'Password123' });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(typeof body.data.accessToken, 'string');
  assert.equal(body.data.user.phone, phone);
  assert.match(response.headers.getSetCookie().join(';'), /refreshToken=/);
});

test('POST /auth/login rejects a suspended account with 403 ACCOUNT_SUSPENDED', async () => {
  const phone = '01711000009';
  const { otp } = await registerUser(phone);
  await postJson('/auth/verify-otp', { phone, otp, purpose: 'signup' });
  await databaseClient.query(`UPDATE users SET status = 'suspended' WHERE phone = $1`, [phone]);

  const response = await postJson('/auth/login', { phone, password: 'Password123' });
  const body = await response.json();

  assert.equal(response.status, 403);
  assert.equal(body.error.code, 'ACCOUNT_SUSPENDED');
});

test('POST /auth/refresh rotates the token: new cookie works, old one is revoked and points at the new row', async () => {
  const phone = '01711000010';
  const { refreshCookie } = await registerVerifiedUser(phone);

  const response = await postJson('/auth/refresh', {}, { cookie: refreshCookie });
  const body = await response.json();
  const rotatedCookie = extractCookie(response, 'refreshToken');

  assert.equal(response.status, 200);
  assert.equal(typeof body.data.accessToken, 'string');
  assert.ok(rotatedCookie);
  assert.notEqual(rotatedCookie, refreshCookie);

  const oldHash = sha256Hex(rawTokenFromCookie(refreshCookie));
  const newHash = sha256Hex(rawTokenFromCookie(rotatedCookie));

  const { rows } = await databaseClient.query(
    `SELECT old_row.revoked_at AS "oldRevokedAt", new_row.id AS "newId", old_row.replaced_by AS "replacedBy"
     FROM refresh_tokens old_row
     JOIN refresh_tokens new_row ON new_row.token_hash = $2
     WHERE old_row.token_hash = $1`,
    [oldHash, newHash],
  );

  assert.equal(rows.length, 1);
  assert.notEqual(rows[0].oldRevokedAt, null);
  assert.equal(rows[0].replacedBy, rows[0].newId);
});

test('POST /auth/refresh replaying a rotated (dead) token kills the whole session', async () => {
  const phone = '01711000011';
  const { refreshCookie } = await registerVerifiedUser(phone);

  const rotated = await postJson('/auth/refresh', {}, { cookie: refreshCookie });
  const rotatedCookie = extractCookie(rotated, 'refreshToken');
  assert.equal(rotated.status, 200);

  // replay the now-dead original token
  const replay = await postJson('/auth/refresh', {}, { cookie: refreshCookie });
  const replayBody = await replay.json();

  assert.equal(replay.status, 401);
  assert.equal(replayBody.error.code, 'REFRESH_REUSED');

  const { rows: sessionRows } = await databaseClient.query(
    `SELECT ls.logged_out_at AS "loggedOutAt", ls.is_active AS "isActive"
     FROM login_sessions ls
     JOIN users u ON u.id = ls.user_id
     WHERE u.phone = $1`,
    [phone],
  );
  assert.equal(sessionRows.length, 1);
  assert.notEqual(sessionRows[0].loggedOutAt, null);
  assert.equal(sessionRows[0].isActive, false);

  // the token minted by the rotation above is also dead now — the whole
  // session was killed, not just the replayed token
  const afterKill = await postJson('/auth/refresh', {}, { cookie: rotatedCookie });
  assert.equal(afterKill.status, 401);
});

test('POST /auth/refresh rejects a missing or unknown cookie with 401 REFRESH_INVALID', async () => {
  const missing = await postJson('/auth/refresh', {});
  const missingBody = await missing.json();

  assert.equal(missing.status, 401);
  assert.equal(missingBody.error.code, 'REFRESH_INVALID');

  const unknown = await postJson('/auth/refresh', {}, { cookie: 'refreshToken=not-a-real-token' });
  const unknownBody = await unknown.json();

  assert.equal(unknown.status, 401);
  assert.equal(unknownBody.error.code, 'REFRESH_INVALID');
});

test('POST /auth/refresh rejects an expired refresh token with 401 REFRESH_INVALID', async () => {
  const phone = '01711000012';
  const { refreshCookie } = await registerVerifiedUser(phone);
  const tokenHash = sha256Hex(rawTokenFromCookie(refreshCookie));

  await databaseClient.query(
    `UPDATE refresh_tokens SET expires_at = now() - interval '1 minute' WHERE token_hash = $1`,
    [tokenHash],
  );

  const response = await postJson('/auth/refresh', {}, { cookie: refreshCookie });
  const body = await response.json();

  assert.equal(response.status, 401);
  assert.equal(body.error.code, 'REFRESH_INVALID');
});

test('POST /auth/logout requires a bearer token', async () => {
  const response = await postJson('/auth/logout', {});
  const body = await response.json();

  assert.equal(response.status, 401);
  assert.equal(body.error.code, 'AUTH_REQUIRED');
});

test('POST /auth/logout ends only that session — its refresh token stops working', async () => {
  const phone = '01711000013';
  const { accessToken, refreshCookie } = await registerVerifiedUser(phone);

  const response = await postJson('/auth/logout', {}, { authorization: `Bearer ${accessToken}` });
  assert.equal(response.status, 204);
  assert.match(response.headers.getSetCookie().join(';'), /refreshToken=;/);

  const { rows: sessionRows } = await databaseClient.query(
    `SELECT ls.is_active AS "isActive" FROM login_sessions ls
     JOIN users u ON u.id = ls.user_id WHERE u.phone = $1`,
    [phone],
  );
  assert.equal(sessionRows[0].isActive, false);

  const refreshAttempt = await postJson('/auth/refresh', {}, { cookie: refreshCookie });
  assert.equal(refreshAttempt.status, 401);
});

test('POST /auth/logout-all ends every session for the user, not just the caller\'s', async () => {
  const phone = '01711000014';
  const first = await registerVerifiedUser(phone);

  const secondLogin = await postJson('/auth/login', { phone, password: 'Password123' });
  const secondBody = await secondLogin.json();
  const secondRefreshCookie = extractCookie(secondLogin, 'refreshToken');

  const response = await postJson('/auth/logout-all', {}, { authorization: `Bearer ${first.accessToken}` });
  assert.equal(response.status, 204);

  const { rows: sessionRows } = await databaseClient.query(
    `SELECT ls.is_active AS "isActive" FROM login_sessions ls
     JOIN users u ON u.id = ls.user_id WHERE u.phone = $1`,
    [phone],
  );
  assert.equal(sessionRows.length, 2);
  assert.ok(sessionRows.every((row) => row.isActive === false));

  const firstRefreshAttempt = await postJson('/auth/refresh', {}, { cookie: first.refreshCookie });
  assert.equal(firstRefreshAttempt.status, 401);

  const secondRefreshAttempt = await postJson('/auth/refresh', {}, { cookie: secondRefreshCookie });
  assert.equal(secondRefreshAttempt.status, 401);

  assert.equal(typeof secondBody.data.accessToken, 'string');
});
