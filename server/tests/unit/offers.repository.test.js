import assert from 'node:assert/strict';
import { after, mock, test } from 'node:test';

import { pool } from '../../src/config/db.js';
import * as offersRepo from '../../src/repositories/offers.repository.js';

after(async () => {
  await pool.end();
});

test('findEligibleDrivers filters by category, online status, and gender when women_only', async () => {
  const query = mock.method(pool, 'query', async (sql, values) => {
    assert.match(sql, /da\.status = 'online'/);
    assert.match(sql, /v\.category_id = \$1/);
    assert.match(sql, /u\.gender = 'female'/);
    assert.deepEqual(values, [3, true]);
    return { rows: [] };
  });

  await offersRepo.findEligibleDrivers({ categoryId: 3, womenOnly: true });
  assert.equal(query.mock.callCount(), 1);
});

test('insertOffers inserts one row per offer with ON CONFLICT DO NOTHING and returns the inserted rows', async () => {
  let call = 0;
  const query = mock.method(pool, 'query', async () => {
    call += 1;
    return { rows: [{ id: call, driverId: call === 1 ? 1 : 2 }] };
  });

  const inserted = await offersRepo.insertOffers(38, [
    { driverId: 1, distanceKm: 0.5 },
    { driverId: 2, distanceKm: 1.2 },
  ]);

  assert.equal(query.mock.callCount(), 2);
  assert.match(query.mock.calls[0].arguments[0], /ON CONFLICT \(request_id, driver_id\) DO NOTHING/);
  assert.match(query.mock.calls[0].arguments[0], /RETURNING id, driver_id AS "driverId"/);
  assert.deepEqual(query.mock.calls[0].arguments[1], [38, 1, 0.5]);
  assert.deepEqual(query.mock.calls[1].arguments[1], [38, 2, 1.2]);
  assert.deepEqual(inserted, [{ id: 1, driverId: 1 }, { id: 2, driverId: 2 }]);
});

test('insertOffers skips a driver already offered (ON CONFLICT DO NOTHING returns no row)', async () => {
  mock.method(pool, 'query', async () => ({ rows: [] }));

  const inserted = await offersRepo.insertOffers(38, [{ driverId: 1, distanceKm: 0.5 }]);
  assert.deepEqual(inserted, []);
});

test('findPendingForDriver only selects offers still inside the timeout window', async () => {
  const query = mock.method(pool, 'query', async (sql, values) => {
    assert.match(sql, /response = 'pending'/);
    assert.match(sql, /offered_at \+ \(\$2 \* INTERVAL '1 second'\) > now\(\)/);
    assert.deepEqual(values, [7, 15]);
    return { rows: [] };
  });

  await offersRepo.findPendingForDriver(7, 15);
  assert.equal(query.mock.callCount(), 1);
});

test('withdrawOtherOffersForRequest excludes the winning driver and only touches pending offers', async () => {
  const query = mock.method(pool, 'query', async (sql, values) => {
    assert.match(sql, /response = 'withdrawn'/);
    assert.match(sql, /driver_id != \$2/);
    assert.match(sql, /response = 'pending'/);
    assert.deepEqual(values, [38, 42]);
    return { rows: [] };
  });

  await offersRepo.withdrawOtherOffersForRequest(38, 42, pool);
  assert.equal(query.mock.callCount(), 1);
});

test('withdrawOtherOffersForDriver excludes the just-accepted offer', async () => {
  const query = mock.method(pool, 'query', async (sql, values) => {
    assert.match(sql, /driver_id = \$1/);
    assert.match(sql, /id != \$2/);
    assert.deepEqual(values, [42, 9]);
    return { rows: [] };
  });

  await offersRepo.withdrawOtherOffersForDriver(42, 9, pool);
  assert.equal(query.mock.callCount(), 1);
});

test('withdrawPendingOffersForRequests times out every still-pending offer for the given requests', async () => {
  const query = mock.method(pool, 'query', async (sql, values) => {
    assert.match(sql, /response = 'timed_out'/);
    assert.match(sql, /request_id = ANY\(\$1::bigint\[\]\)/);
    assert.match(sql, /response = 'pending'/);
    assert.deepEqual(values, [[38, 41]]);
    return { rows: [] };
  });

  await offersRepo.withdrawPendingOffersForRequests([38, 41], pool);
  assert.equal(query.mock.callCount(), 1);
});

test('withdrawPendingOffersForRequests is a no-op for an empty list (no query at all)', async () => {
  const query = mock.method(pool, 'query', async () => ({ rows: [] }));

  await offersRepo.withdrawPendingOffersForRequests([], pool);
  assert.equal(query.mock.callCount(), 0);
});
