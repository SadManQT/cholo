import assert from 'node:assert/strict';
import { after, mock, test } from 'node:test';

import { pool } from '../../src/config/db.js';
import { recordLocationPing } from '../../src/services/tracking.service.js';

after(async () => {
  await pool.end();
});

test('recordLocationPing writes the breadcrumb log and the current-position cache in one transaction', async () => {
  const calls = [];
  const query = async (sql, values) => {
    calls.push({ sql, values });
    return { rows: [] };
  };
  mock.method(pool, 'connect', async () => ({ query, release() {} }));

  await recordLocationPing(42, 7, { lat: 23.79, lng: 90.40, heading: 90, speedKmh: 30 });

  assert.deepEqual(calls.map((call) => call.sql.split(/\s/)[0]), ['BEGIN', 'INSERT', 'UPDATE', 'COMMIT']);
  assert.match(calls[1].sql, /INSERT INTO trip_location_pings/);
  assert.deepEqual(calls[1].values, [7, 23.79, 90.40, 90, 30]);
  assert.match(calls[2].sql, /UPDATE driver_availability/);
  assert.deepEqual(calls[2].values, [42, 23.79, 90.40, 90]);
});
