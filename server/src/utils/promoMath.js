import { round2 } from './fareMath.js';

// Pure arithmetic, no I/O — shared by three call sites that must never
// disagree on "how big is this discount": rides.service.js's booking-time
// ESTIMATE, promos.service.js's /promos/validate preview, and
// trips.service.js's actual redemption at completion. A duplicated copy of
// this formula drifting between preview and redemption would show a
// passenger one discount and charge them another.
export function computeDiscount(promo, fareAmount) {
  let discount = promo.promoType === 'percentage'
    ? fareAmount * (promo.value / 100)
    : promo.value;

  if (promo.maxDiscount != null) discount = Math.min(discount, promo.maxDiscount);
  discount = Math.min(discount, fareAmount);

  return round2(discount);
}

// The "reserved on" check (doc 01 relationship #37): does this code apply
// to THIS ride at all, independent of how many times it's been used?
// Shared by promos.service.js's /promos/validate (throws 422 on false) and
// trips.service.js's redemption at completion (silently skips the discount
// on false instead — see completeTrip's own comment for why) — one
// implementation so those two call sites can never disagree about what
// "applicable" means.
export function isPromoApplicable(promo, { cityId, categoryId, fareAmount, isFirstRide }) {
  if (!promo.isActive) return false;
  const now = Date.now();
  if (new Date(promo.validFrom).getTime() > now) return false;
  if (promo.validUntil && new Date(promo.validUntil).getTime() <= now) return false;
  if (promo.cityId != null && promo.cityId !== cityId) return false;
  if (promo.categoryId != null && promo.categoryId !== categoryId) return false;
  if (promo.minFare != null && fareAmount < promo.minFare) return false;
  if (promo.firstRideOnly && !isFirstRide) return false;
  return true;
}

// The "redeemed as" check: independent of applicability, has this code
// simply been used up — either in total or by this specific user? A NULL
// limit means "no cap", same nullable-scope convention promo_codes uses
// throughout (schema.sql).
export function isPromoUsageAvailable(promo, counts) {
  if (promo.usageLimitTotal != null && counts.totalCount >= promo.usageLimitTotal) return false;
  if (promo.usageLimitPerUser != null && counts.userCount >= promo.usageLimitPerUser) return false;
  return true;
}
