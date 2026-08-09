import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { dirname, resolve } from 'node:path';
import { after, before, mock, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import app from '../../src/app.js';
import { pool } from '../../src/config/db.js';
import { logger } from '../../src/utils/logger.js';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const serverDirectory = resolve(currentDirectory, '../..');

let server;
let baseUrl;

before(async () => {
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

test('GET /health confirms the API can connect to PostgreSQL', async () => {
  const response = await fetch(`${baseUrl}/health`);

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { db: true });
});

test('GET /health returns 503 when PostgreSQL is unavailable', async () => {
  const databaseError = new Error('database unavailable');
  const errorLog = mock.method(logger, 'error', () => {});

  mock.method(pool, 'connect', async () => {
    throw databaseError;
  });

  const response = await fetch(`${baseUrl}/health`);

  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { db: false });
  assert.equal(errorLog.mock.callCount(), 1);
  assert.equal(errorLog.mock.calls[0].arguments[1], databaseError);
});

test('server fails before listening when DATABASE_URL is empty', () => {
  const result = spawnSync(process.execPath, ['src/server.js'], {
    cwd: serverDirectory,
    encoding: 'utf8',
    env: { ...process.env, DATABASE_URL: '' },
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Invalid environment configuration/);
  assert.match(result.stderr, /DATABASE_URL is required/);
  assert.doesNotMatch(result.stdout, /Cholo API listening/);
});

test('server fails before listening when CLIENT_ORIGIN is invalid', () => {
  const result = spawnSync(process.execPath, ['src/server.js'], {
    cwd: serverDirectory,
    encoding: 'utf8',
    env: { ...process.env, CLIENT_ORIGIN: 'not-a-url' },
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Invalid environment configuration/);
  assert.match(result.stderr, /CLIENT_ORIGIN must be a valid URL/);
  assert.doesNotMatch(result.stdout, /Cholo API listening/);
});
