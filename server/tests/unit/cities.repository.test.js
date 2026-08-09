import assert from 'node:assert/strict';
import { after, mock, test } from 'node:test';

import { pool } from '../../src/config/db.js';
import { findAll } from '../../src/repositories/cities.repository.js';

after(async () => {
  await pool.end();
});

test('findAll uses a parameterized query and returns the selected city rows', async () => {
  const expectedCities = [
    {
      id: 1,
      name: 'Dhaka',
      country: 'Bangladesh',
      timezone: 'Asia/Dhaka',
      currency: 'BDT',
      launchedAt: '2026-01-01',
    },
  ];

  const query = mock.method(pool, 'query', async (sql, values) => {
    assert.match(sql, /WHERE is_active = \$1/);
    assert.doesNotMatch(sql, /SELECT\s+\*/i);
    assert.deepEqual(values, [true]);

    return { rows: expectedCities };
  });

  const cities = await findAll();

  assert.deepEqual(cities, expectedCities);
  assert.equal(query.mock.callCount(), 1);
});
