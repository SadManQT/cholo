import assert from 'node:assert/strict';
import { once } from 'node:events';
import { after, before, mock, test } from 'node:test';

import app from '../../src/app.js';
import { pool } from '../../src/config/db.js';
import { logger } from '../../src/utils/logger.js';

let server;
let baseUrl;
let databaseClient;
let activeCityId;
let inactiveCityId;
let databaseShouldFail = false;
let errorLog;

before(async () => {
  databaseClient = await pool.connect();
  await databaseClient.query('BEGIN');

  const { rows } = await databaseClient.query(
    `INSERT INTO cities (name, is_active, launched_at)
     VALUES ($1, $2, $3), ($4, $5, $6)
     RETURNING id, is_active AS "isActive"`,
    [
      'M1 Active Test City',
      true,
      '2026-08-09',
      'M1 Inactive Test City',
      false,
      '2026-08-09',
    ],
  );

  activeCityId = rows.find((city) => city.isActive).id;
  inactiveCityId = rows.find((city) => !city.isActive).id;

  mock.method(pool, 'query', (sql, values) => {
    if (databaseShouldFail) {
      throw new Error('database unavailable');
    }

    return databaseClient.query(sql, values);
  });
  errorLog = mock.method(logger, 'error', () => {});

  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');

  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  server.close();
  await once(server, 'close');

  mock.restoreAll();
  await databaseClient.query('ROLLBACK');
  databaseClient.release();
  await pool.end();
});

test('GET /api/v1/cities returns active cities in the standard success envelope', async () => {
  const response = await fetch(`${baseUrl}/api/v1/cities`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.ok(Array.isArray(body.data));

  const activeCity = body.data.find((city) => city.id === activeCityId);

  assert.deepEqual(activeCity, {
    id: activeCityId,
    name: 'M1 Active Test City',
    country: 'Bangladesh',
    timezone: 'Asia/Dhaka',
    currency: 'BDT',
    launchedAt: '2026-08-09',
  });
  assert.equal(body.data.some((city) => city.id === inactiveCityId), false);

  for (const city of body.data) {
    assert.deepEqual(Object.keys(city), [
      'id',
      'name',
      'country',
      'timezone',
      'currency',
      'launchedAt',
    ]);
  }
});

test('GET /api/v1/cities sends async database failures through the central handler', async () => {
  databaseShouldFail = true;

  try {
    const response = await fetch(`${baseUrl}/api/v1/cities`);
    const body = await response.json();

    assert.equal(response.status, 500);
    assert.deepEqual(body, {
      success: false,
      error: {
        code: 'INTERNAL',
        message: 'Something went wrong on our side.',
      },
    });
    assert.doesNotMatch(JSON.stringify(body), /database unavailable/);
    assert.equal(errorLog.mock.callCount(), 1);
  } finally {
    databaseShouldFail = false;
  }
});
