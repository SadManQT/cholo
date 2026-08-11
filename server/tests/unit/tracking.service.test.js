import assert from 'node:assert/strict';
import { after, mock, test } from 'node:test';

import { pool } from '../../src/config/db.js';
import { recordLocationPing } from '../../src/services/tracking.service.js';

after(async () => {
  await pool.end();
});

test('recordLocationPing writes both the breadcrumb log and the current-position cache', async () => {
  const calls = [];
  mock.method(pool, 'query', async (sql, values) => {
    calls.push({ sql, values });
    return { rows: [] };
  });

  await recordLocationPing(42, 7, { lat: 23.79, lng: 90.40, heading: 90, speedKmh: 30 });

  assert.equal(calls.length, 2);
  assert.match(calls[0].sql, /INSERT INTO trip_location_pings/);
  assert.deepEqual(calls[0].values, [7, 23.79, 90.40, 90, 30]);
  assert.match(calls[1].sql, /UPDATE driver_availability/);
  assert.deepEqual(calls[1].values, [42, 23.79, 90.40, 90]);
});
