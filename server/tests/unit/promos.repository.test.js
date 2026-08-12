import assert from 'node:assert/strict';
import { after, mock, test } from 'node:test';

import { pool } from '../../src/config/db.js';
import {
  countRedemptions, findApplicable, findByCode, findByIdForUpdate,
  insertRedemption, listActiveForCity,
} from '../../src/repositories/promos.repository.js';

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

test('findByCode queries by code only — no active/date/scope filtering', async () => {
  const query = mock.method(pool, 'query', async (sql, values) => {
    // The WHERE clause is just the code lookup — no is_active/valid_from/
    // valid_until/city_id/category_id filtering (those columns are still
    // legitimately SELECTed so the caller can inspect them, just not
    // filtered on).
    assert.match(sql, /FROM promo_codes WHERE code = \$1\s*$/);
    assert.deepEqual(values, ['WELCOME50']);
    return { rows: [{ id: 7, code: 'WELCOME50', isActive: false }] };
  });

  const promo = await findByCode('WELCOME50');

  assert.equal(promo.isActive, false); // returned even though inactive
  assert.equal(query.mock.callCount(), 1);
});

test('findByIdForUpdate locks the promo row', async () => {
  const client = { query: mock.fn(async (sql, values) => {
    assert.match(sql, /FROM promo_codes WHERE id = \$1 FOR UPDATE/);
    assert.deepEqual(values, [7]);
    return { rows: [{ id: 7, code: 'WELCOME50' }] };
  }) };

  const promo = await findByIdForUpdate(7, client);

  assert.equal(promo.id, 7);
  assert.equal(client.query.mock.callCount(), 1);
});

test('countRedemptions returns total and per-user counts from one query', async () => {
  const query = mock.method(pool, 'query', async (sql, values) => {
    assert.match(sql, /FROM promo_redemptions/);
    assert.match(sql, /FILTER \(WHERE user_id = \$2\)/);
    assert.deepEqual(values, [7, 42]);
    return { rows: [{ totalCount: 3, userCount: 1 }] };
  });

  const counts = await countRedemptions(7, 42);

  assert.deepEqual(counts, { totalCount: 3, userCount: 1 });
  assert.equal(query.mock.callCount(), 1);
});

test('listActiveForCity scopes by is_active, date window, and nullable city_id', async () => {
  const query = mock.method(pool, 'query', async (sql, values) => {
    assert.match(sql, /is_active = true/);
    assert.match(sql, /city_id IS NULL OR city_id = \$1/);
    assert.deepEqual(values, [1]);
    return { rows: [{ code: 'WELCOME50' }] };
  });

  const rows = await listActiveForCity(1);

  assert.equal(rows.length, 1);
  assert.equal(query.mock.callCount(), 1);
});

test('insertRedemption writes promo_code_id/user_id/trip_id/discount_amount', async () => {
  const client = { query: mock.fn(async (sql, values) => {
    assert.match(sql, /INSERT INTO promo_redemptions/);
    assert.deepEqual(values, [7, 42, 99, 50]);
    return { rows: [{ id: 1, redeemedAt: '2026-01-01T00:00:00Z' }] };
  }) };

  const redemption = await insertRedemption(
    { promoCodeId: 7, userId: 42, tripId: 99, discountAmount: 50 },
    client,
  );

  assert.equal(redemption.id, 1);
  assert.equal(client.query.mock.callCount(), 1);
});
