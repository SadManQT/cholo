import assert from 'node:assert/strict';
import { after, mock, test } from 'node:test';

import { pool } from '../../src/config/db.js';
import { getCurrentTariff } from '../../src/repositories/pricing.repository.js';

after(async () => {
  await pool.end();
});

test('getCurrentTariff calls fn_current_pricing with city and category and maps the row to camelCase numbers', async () => {
  const query = mock.method(pool, 'query', async (sql, values) => {
    assert.match(sql, /FROM fn_current_pricing\(\$1, \$2\)/);
    assert.deepEqual(values, [1, 3]);

    return {
      rows: [{
        id: 3,
        cityId: 1,
        categoryId: 3,
        baseFare: 60,
        perKmRate: 22,
        perMinRate: 2.5,
        minimumFare: 120,
        bookingFee: 10,
        waitingPerMin: 0,
        freeWaitMinutes: 0,
        cancellationFee: 0,
      }],
    };
  });

  const tariff = await getCurrentTariff(1, 3);

  assert.equal(tariff.baseFare, 60);
  assert.equal(typeof tariff.baseFare, 'number');
  assert.equal(query.mock.callCount(), 1);
});

test('getCurrentTariff returns undefined when fn_current_pricing has no matching row (SETOF, zero rows)', async () => {
  mock.method(pool, 'query', async () => ({ rows: [] }));

  const tariff = await getCurrentTariff(1, 999);

  assert.equal(tariff, undefined);
});
