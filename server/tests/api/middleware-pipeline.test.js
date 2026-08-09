import assert from 'node:assert/strict';
import { once } from 'node:events';
import { after, before, mock, test } from 'node:test';

import app from '../../src/app.js';
import { pool } from '../../src/config/db.js';
import { logger } from '../../src/utils/logger.js';

let server;
let baseUrl;
let infoLog;

before(async () => {
  infoLog = mock.method(logger, 'info', () => {});
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');

  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  server.close();
  await once(server, 'close');
  mock.restoreAll();
  await pool.end();
});

test('CORS allows the configured frontend origin and credentials', async () => {
  const response = await fetch(`${baseUrl}/health`, {
    headers: { origin: 'http://localhost:5173' },
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('access-control-allow-origin'), 'http://localhost:5173');
  assert.equal(response.headers.get('access-control-allow-credentials'), 'true');
});

test('CORS handles browser preflight requests', async () => {
  const response = await fetch(`${baseUrl}/api/v1/cities`, {
    method: 'OPTIONS',
    headers: {
      origin: 'http://localhost:5173',
      'access-control-request-method': 'GET',
    },
  });

  assert.equal(response.status, 204);
  assert.equal(response.headers.get('access-control-allow-origin'), 'http://localhost:5173');
  assert.match(response.headers.get('access-control-allow-methods'), /GET/);
});

test('unknown routes use the standard 404 error envelope', async () => {
  const response = await fetch(`${baseUrl}/api/v1/does-not-exist`);

  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), {
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'The requested resource was not found.',
    },
  });
});

test('malformed JSON becomes a 422 validation envelope instead of a 500', async () => {
  const response = await fetch(`${baseUrl}/api/v1/does-not-exist`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{"broken":',
  });

  assert.equal(response.status, 422);
  assert.deepEqual(await response.json(), {
    success: false,
    error: {
      code: 'VALIDATION_FAILED',
      message: 'The request contains invalid data.',
      details: [
        { field: 'body', issue: 'Request body must contain valid JSON.' },
      ],
    },
  });
});

test('request logger records method, path, status, and duration', async () => {
  await fetch(`${baseUrl}/api/v1/does-not-exist`);
  await new Promise((resolve) => setImmediate(resolve));

  const matchingCall = infoLog.mock.calls.find(
    ({ arguments: args }) =>
      args[0] === 'Request completed' && args[1]?.path === '/api/v1/does-not-exist',
  );

  assert.ok(matchingCall);
  assert.equal(matchingCall.arguments[1].method, 'GET');
  assert.equal(matchingCall.arguments[1].status, 404);
  assert.equal(typeof matchingCall.arguments[1].durationMs, 'number');
});
