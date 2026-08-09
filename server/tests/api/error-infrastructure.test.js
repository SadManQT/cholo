import assert from 'node:assert/strict';
import { once } from 'node:events';
import { after, before, mock, test } from 'node:test';

import express from 'express';
import { z } from 'zod';

import { errorHandler } from '../../src/middlewares/errorHandler.js';
import { validate } from '../../src/middlewares/validate.js';
import { AppError } from '../../src/utils/AppError.js';
import { asyncHandler } from '../../src/utils/asyncHandler.js';
import { logger } from '../../src/utils/logger.js';

const testApp = express();
const requestSchema = z.object({
  pickup: z.object({
    lat: z.number().min(-90).max(90),
  }),
  womenOnly: z.boolean().default(false),
});

testApp.use(express.json());

testApp.post('/validate', validate(requestSchema), (request, response) => {
  response.json({ success: true, data: request.body });
});

testApp.get(
  '/expected-error',
  asyncHandler(async () => {
    await Promise.resolve();
    throw new AppError(409, 'DUPLICATE');
  }),
);

testApp.get(
  '/unexpected-error',
  asyncHandler(async () => {
    await Promise.resolve();
    throw new Error('sensitive implementation detail');
  }),
);

testApp.get(
  '/postgres-duplicate',
  asyncHandler(async () => {
    const error = new Error('duplicate key value violates unique constraint');
    error.code = '23505';
    throw error;
  }),
);

testApp.get(
  '/postgres-check',
  asyncHandler(async () => {
    const error = new Error('new row violates check constraint');
    error.code = '23514';
    throw error;
  }),
);

testApp.use(errorHandler);

let server;
let baseUrl;
let errorLog;

before(async () => {
  errorLog = mock.method(logger, 'error', () => {});
  server = testApp.listen(0, '127.0.0.1');
  await once(server, 'listening');

  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  server.close();
  await once(server, 'close');
  mock.restoreAll();
});

test('validate applies parsed defaults to a valid request', async () => {
  const response = await fetch(`${baseUrl}/validate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ pickup: { lat: 23.81 } }),
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    success: true,
    data: { pickup: { lat: 23.81 }, womenOnly: false },
  });
});

test('validate returns the exact 422 error envelope for invalid input', async () => {
  const response = await fetch(`${baseUrl}/validate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ pickup: { lat: 91 } }),
  });
  const body = await response.json();

  assert.equal(response.status, 422);
  assert.equal(body.success, false);
  assert.equal(body.error.code, 'VALIDATION_FAILED');
  assert.equal(body.error.message, 'The request contains invalid data.');
  assert.deepEqual(body.error.details[0].field, 'pickup.lat');
  assert.equal(typeof body.error.details[0].issue, 'string');
});

test('asyncHandler forwards an expected AppError to the central handler', async () => {
  const response = await fetch(`${baseUrl}/expected-error`);

  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), {
    success: false,
    error: {
      code: 'DUPLICATE',
      message: 'That value already exists.',
    },
  });
});

test('unexpected async errors are logged but hidden from the client', async () => {
  const response = await fetch(`${baseUrl}/unexpected-error`);
  const body = await response.json();

  assert.equal(response.status, 500);
  assert.deepEqual(body, {
    success: false,
    error: {
      code: 'INTERNAL',
      message: 'Something went wrong on our side.',
    },
  });
  assert.doesNotMatch(JSON.stringify(body), /sensitive implementation detail/);
  assert.equal(errorLog.mock.callCount(), 1);
});

test('PostgreSQL unique violations become a 409 DUPLICATE response', async () => {
  const response = await fetch(`${baseUrl}/postgres-duplicate`);

  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), {
    success: false,
    error: {
      code: 'DUPLICATE',
      message: 'That value already exists.',
    },
  });
});

test('PostgreSQL check violations become a 422 validation response', async () => {
  const response = await fetch(`${baseUrl}/postgres-check`);

  assert.equal(response.status, 422);
  assert.deepEqual(await response.json(), {
    success: false,
    error: {
      code: 'VALIDATION_FAILED',
      message: 'The request contains invalid data.',
    },
  });
});
