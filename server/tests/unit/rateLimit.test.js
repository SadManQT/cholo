import assert from 'node:assert/strict';
import { once } from 'node:events';
import { after, before, test } from 'node:test';

import express from 'express';

import { errorHandler } from '../../src/middlewares/errorHandler.js';
import { createAllowlistSkip, createRateLimiter } from '../../src/middlewares/rateLimit.js';

let server;
let baseUrl;

before(async () => {
  const app = express();
  app.use(express.json());
  app.get('/limited', createRateLimiter({ windowMs: 60_000, limit: 2 }), (_request, response) => {
    response.json({ success: true });
  });
  app.get('/allowlisted', createRateLimiter({ windowMs: 60_000, limit: 1, skip: createAllowlistSkip(['127.0.0.1']) }), (_request, response) => {
    response.json({ success: true });
  });
  app.use(errorHandler);

  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  server.close();
  await once(server, 'close');
});

test('createRateLimiter allows requests under the limit, blocks over it, and exposes RateLimit-* headers', async () => {
  const first = await fetch(`${baseUrl}/limited`);
  const second = await fetch(`${baseUrl}/limited`);
  const third = await fetch(`${baseUrl}/limited`);
  const thirdBody = await third.json();

  assert.equal(first.status, 200);
  assert.ok(first.headers.get('ratelimit-limit'));
  assert.equal(second.status, 200);
  assert.equal(third.status, 429);
  assert.deepEqual(thirdBody, {
    success: false,
    error: { code: 'RATE_LIMITED', message: 'Too many attempts. Please try again later.' },
  });
});

test('createAllowlistSkip exempts listed client IPs, including IPv4-mapped IPv6 forms', async () => {
  const skip = createAllowlistSkip(['127.0.0.1', '::1']);
  assert.equal(skip({ ip: '127.0.0.1' }), true);
  assert.equal(skip({ ip: '::ffff:127.0.0.1' }), true);
  assert.equal(skip({ ip: '::1' }), true);
  assert.equal(skip({ ip: '10.0.0.5' }), false);
  assert.equal(createAllowlistSkip([])({ ip: '127.0.0.1' }), false);

  const responses = [];
  for (let attempt = 0; attempt < 3; attempt += 1) {
    responses.push((await fetch(`${baseUrl}/allowlisted`)).status);
  }
  assert.deepEqual(responses, [200, 200, 200]);
});
