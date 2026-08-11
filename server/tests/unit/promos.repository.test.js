import assert from 'node:assert/strict';
import { after, mock, test } from 'node:test';

import { pool } from '../../src/config/db.js';
import { findApplicable } from '../../src/repositories/promos.repository.js';

after(async () => {
  await pool.end();
});

test('findApplicable queries by code, city/category scope, and active date window', async () => {
  const query = mock.method(pool, 'query', async (sql, values) => {
    assert.match(sql, /FROM promo_codes/);
    assert.match(sql, /WHERE code = \$1/);
    assert.match(sql, /valid_from <= now\(\)/);
    assert.deepEqual(values, ['WELCOME50', 1, 3]);

    return {
      rows: [{
        id: 7,
        code: 'WELCOME50',
        promoType: 'fixed_amount',
        value: 50,
        maxDiscount: null,
        minFare: 100,
      }],
    };
  });

  const promo = await findApplicable('WELCOME50', 1, 3);

  assert.equal(promo.promoType, 'fixed_amount');
  assert.equal(typeof promo.value, 'number');
  assert.equal(query.mock.callCount(), 1);
});

test('findApplicable returns undefined when no row matches (inactive, expired, or wrong scope)', async () => {
  mock.method(pool, 'query', async () => ({ rows: [] }));

  const promo = await findApplicable('EXPIRED', 1, 3);

  assert.equal(promo, undefined);
});
