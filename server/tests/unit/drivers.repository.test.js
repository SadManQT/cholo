import assert from 'node:assert/strict';
import { after, mock, test } from 'node:test';

import { pool } from '../../src/config/db.js';
import { updateLocation } from '../../src/repositories/drivers.repository.js';

after(async () => {
  await pool.end();
});

test('updateLocation writes lat/lng/heading and stamps last_ping_at without touching status', async () => {
  const query = mock.method(pool, 'query', async (sql, values) => {
    assert.match(sql, /SET current_lat = \$2, current_lng = \$3, heading = \$4, last_ping_at = now\(\)/);
    assert.doesNotMatch(sql, /status/);
    assert.deepEqual(values, [42, 23.79, 90.40, 180]);
    return { rows: [] };
  });

  await updateLocation(42, { lat: 23.79, lng: 90.40, heading: 180 }, pool);
  assert.equal(query.mock.callCount(), 1);
});

test('updateLocation defaults a missing heading to null', async () => {
  const query = mock.method(pool, 'query', async (sql, values) => {
    assert.deepEqual(values, [42, 23.79, 90.40, null]);
    return { rows: [] };
  });

  await updateLocation(42, { lat: 23.79, lng: 90.40 }, pool);
  assert.equal(query.mock.callCount(), 1);
});
