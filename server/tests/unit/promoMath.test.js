import assert from 'node:assert/strict';
import { test } from 'node:test';

import { computeDiscount, isPromoApplicable, isPromoUsageAvailable } from '../../src/utils/promoMath.js';

test('computeDiscount: percentage applies value% of the fare', () => {
  assert.equal(computeDiscount({ promoType: 'percentage', value: 10, maxDiscount: null }, 500), 50);
});

test('computeDiscount: fixed_amount ignores the fare, uses value directly', () => {
  assert.equal(computeDiscount({ promoType: 'fixed_amount', value: 50, maxDiscount: null }, 500), 50);
});

test('computeDiscount: maxDiscount caps a percentage discount', () => {
  assert.equal(computeDiscount({ promoType: 'percentage', value: 50, maxDiscount: 30 }, 500), 30);
});

test('computeDiscount: never exceeds the fare itself, even with no maxDiscount', () => {
  assert.equal(computeDiscount({ promoType: 'fixed_amount', value: 1000, maxDiscount: null }, 200), 200);
});

test('computeDiscount: rounds to 2dp', () => {
  assert.equal(computeDiscount({ promoType: 'percentage', value: 33.333, maxDiscount: null }, 100), 33.33);
});

function basePromo(overrides = {}) {
  return {
    isActive: true,
    validFrom: new Date(Date.now() - 60_000).toISOString(),
    validUntil: null,
    cityId: null,
    categoryId: null,
    minFare: null,
    firstRideOnly: false,
    ...overrides,
  };
}

test('isPromoApplicable: false when inactive', () => {
  assert.equal(isPromoApplicable(basePromo({ isActive: false }), { cityId: 1, categoryId: 3, fareAmount: 500, isFirstRide: true }), false);
});

test('isPromoApplicable: false before validFrom', () => {
  const promo = basePromo({ validFrom: new Date(Date.now() + 60_000).toISOString() });
  assert.equal(isPromoApplicable(promo, { cityId: 1, categoryId: 3, fareAmount: 500, isFirstRide: true }), false);
});

test('isPromoApplicable: false after validUntil', () => {
  const promo = basePromo({ validUntil: new Date(Date.now() - 60_000).toISOString() });
  assert.equal(isPromoApplicable(promo, { cityId: 1, categoryId: 3, fareAmount: 500, isFirstRide: true }), false);
});

test('isPromoApplicable: NULL city/category scope means "any" — true when the promo has neither set', () => {
  assert.equal(isPromoApplicable(basePromo(), { cityId: 7, categoryId: 9, fareAmount: 500, isFirstRide: true }), true);
});

test('isPromoApplicable: false when city_id is set and does not match', () => {
  const promo = basePromo({ cityId: 1 });
  assert.equal(isPromoApplicable(promo, { cityId: 2, categoryId: 3, fareAmount: 500, isFirstRide: true }), false);
});

test('isPromoApplicable: false when the fare is below min_fare', () => {
  const promo = basePromo({ minFare: 1000 });
  assert.equal(isPromoApplicable(promo, { cityId: 1, categoryId: 3, fareAmount: 500, isFirstRide: true }), false);
});

test('isPromoApplicable: first_ride_only false unless isFirstRide is true', () => {
  const promo = basePromo({ firstRideOnly: true });
  assert.equal(isPromoApplicable(promo, { cityId: 1, categoryId: 3, fareAmount: 500, isFirstRide: false }), false);
  assert.equal(isPromoApplicable(promo, { cityId: 1, categoryId: 3, fareAmount: 500, isFirstRide: true }), true);
});

test('isPromoUsageAvailable: true when both limits are NULL (uncapped)', () => {
  const promo = { usageLimitTotal: null, usageLimitPerUser: null };
  assert.equal(isPromoUsageAvailable(promo, { totalCount: 999, userCount: 999 }), true);
});

test('isPromoUsageAvailable: false once totalCount reaches usageLimitTotal', () => {
  const promo = { usageLimitTotal: 5, usageLimitPerUser: null };
  assert.equal(isPromoUsageAvailable(promo, { totalCount: 4, userCount: 0 }), true);
  assert.equal(isPromoUsageAvailable(promo, { totalCount: 5, userCount: 0 }), false);
});

test('isPromoUsageAvailable: false once userCount reaches usageLimitPerUser, independent of totalCount', () => {
  const promo = { usageLimitTotal: null, usageLimitPerUser: 1 };
  assert.equal(isPromoUsageAvailable(promo, { totalCount: 50, userCount: 0 }), true);
  assert.equal(isPromoUsageAvailable(promo, { totalCount: 50, userCount: 1 }), false);
});
