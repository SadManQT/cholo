import assert from 'node:assert/strict';
import { after, mock, test } from 'node:test';

import { pool } from '../../src/config/db.js';
import { expireStaleRequests, insertRequest, markCancelled } from '../../src/repositories/rides.repository.js';

after(async () => {
  await pool.end();
});

test('insertRequest writes every snapshot field with a parameterized query, computing expires_at from the same now() as requested_at', async () => {
  let capturedSql;
  let capturedValues;

  mock.method(pool, 'query', async (sql, values) => {
    capturedSql = sql;
    capturedValues = values;

    return {
      rows: [{
        id: 1,
        publicId: 'e87f7ee3-9101-4a7e-9210-487829682f56',
        status: 'searching',
        requestedAt: new Date(),
        expiresAt: new Date(Date.now() + 5 * 60_000),
      }],
    };
  });

  const result = await insertRequest({
    passengerId: 42,
    cityId: 1,
    categoryId: 3,
    pickup: { lat: 23.7925, lng: 90.4078, address: 'Gulshan 2 Circle' },
    dropoff: { lat: 23.7461, lng: 90.3742 },
    estDistanceKm: 9.21,
    estDurationMin: 9,
    estFare: 295.12,
    surgeMultiplier: 1,
    paymentIntent: 'bkash',
    promoCodeId: 7,
    womenOnly: false,
    scheduledFor: undefined,
    expiryMinutes: 5,
  });

  assert.match(capturedSql, /INSERT INTO ride_requests/);
  assert.match(capturedSql, /'searching'/); // status is hardcoded in the SQL, not a bound param
  assert.match(capturedSql, /now\(\) \+ \(\$18 \* INTERVAL '1 minute'\)/);
  assert.deepEqual(capturedValues, [
    42, 1, 3,
    23.7925, 90.4078, 'Gulshan 2 Circle',
    23.7461, 90.3742, null, // dropoff.address omitted -> null, not undefined
    9.21, 9, 295.12, 1,
    'bkash', 7, false, null, // scheduledFor omitted -> null
    5,
  ]);
  assert.equal(result.status, 'searching');
});

test('markCancelled sets status=cancelled and stamps cancelled_at', async () => {
  const query = mock.method(pool, 'query', async (sql, values) => {
    assert.match(sql, /status = 'cancelled', cancelled_at = now\(\)/);
    assert.deepEqual(values, [38]);
    return { rows: [] };
  });

  await markCancelled(38, pool);
  assert.equal(query.mock.callCount(), 1);
});

test('expireStaleRequests only touches pending/searching requests past their own expires_at', async () => {
  const query = mock.method(pool, 'query', async (sql, values) => {
    assert.match(sql, /status IN \('pending', 'searching'\)/);
    assert.match(sql, /expires_at IS NOT NULL/);
    assert.match(sql, /expires_at <= now\(\)/);
    assert.equal(values, undefined);
    return { rows: [{ id: 1, publicId: 'e87f7ee3-9101-4a7e-9210-487829682f56' }] };
  });

  const expired = await expireStaleRequests(pool);
  assert.equal(query.mock.callCount(), 1);
  assert.equal(expired.length, 1);
});
