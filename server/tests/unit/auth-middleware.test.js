import assert from 'node:assert/strict';
import { test } from 'node:test';

import jwt from 'jsonwebtoken';

import { env } from '../../src/config/env.js';
import { auth, requireRole } from '../../src/middlewares/auth.js';
import { signAccessToken } from '../../src/utils/tokens.js';

function fakeResponse() {
  return {};
}

test('auth rejects a request with no Authorization header', () => {
  const request = { headers: {} };
  let forwardedError;

  auth(request, fakeResponse(), (error) => {
    forwardedError = error;
  });

  assert.equal(forwardedError.status, 401);
  assert.equal(forwardedError.code, 'AUTH_REQUIRED');
  assert.equal(request.user, undefined);
});

test('auth rejects a malformed or expired token', () => {
  const request = { headers: { authorization: 'Bearer not-a-real-token' } };
  let forwardedError;

  auth(request, fakeResponse(), (error) => {
    forwardedError = error;
  });

  assert.equal(forwardedError.status, 401);
  assert.equal(forwardedError.code, 'TOKEN_EXPIRED');
});

test('auth rejects a token signed with the wrong secret', () => {
  const badToken = jwt.sign({ roles: ['PASSENGER'], sid: 1 }, 'a-completely-different-secret-value', {
    subject: '1',
  });
  const request = { headers: { authorization: `Bearer ${badToken}` } };
  let forwardedError;

  auth(request, fakeResponse(), (error) => {
    forwardedError = error;
  });

  assert.equal(forwardedError.status, 401);
  assert.equal(forwardedError.code, 'TOKEN_EXPIRED');
});

test('auth attaches id, roles and sessionId from a valid token', () => {
  const token = signAccessToken({ userId: 42, roles: ['PASSENGER', 'DRIVER'], sessionId: 7 });
  const request = { headers: { authorization: `Bearer ${token}` } };
  let nextCalledCleanly = false;

  auth(request, fakeResponse(), (error) => {
    nextCalledCleanly = error === undefined;
  });

  assert.equal(nextCalledCleanly, true);
  assert.deepEqual(request.user, { id: 42, roles: ['PASSENGER', 'DRIVER'], sessionId: 7 });
});

test('requireRole allows a user who has one of the allowed roles', () => {
  const request = { user: { id: 1, roles: ['DRIVER'] } };
  let nextCalledCleanly = false;

  requireRole('ADMIN', 'DRIVER')(request, fakeResponse(), (error) => {
    nextCalledCleanly = error === undefined;
  });

  assert.equal(nextCalledCleanly, true);
});

test('requireRole rejects a user without any allowed role with 403 FORBIDDEN_ROLE', () => {
  const request = { user: { id: 1, roles: ['PASSENGER'] } };
  let forwardedError;

  requireRole('ADMIN', 'DRIVER')(request, fakeResponse(), (error) => {
    forwardedError = error;
  });

  assert.equal(forwardedError.status, 403);
  assert.equal(forwardedError.code, 'FORBIDDEN_ROLE');
});

test('signAccessToken produces a token verifiable with the real JWT_SECRET', () => {
  const token = signAccessToken({ userId: 5, roles: ['PASSENGER'], sessionId: 9 });
  const claims = jwt.verify(token, env.JWT_SECRET);

  assert.equal(claims.sub, '5');
  assert.deepEqual(claims.roles, ['PASSENGER']);
  assert.equal(claims.sid, 9);
});
