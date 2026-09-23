import { round2 } from './fareMath.js';

export function computeDiscount(promo, fareAmount) {
  let discount = promo.promoType === 'percentage'
    ? fareAmount * (promo.value / 100)
    : promo.value;

  if (promo.maxDiscount != null) discount = Math.min(discount, promo.maxDiscount);
  discount = Math.min(discount, fareAmount);

  return round2(discount);
}

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

export function isPromoUsageAvailable(promo, counts) {
  if (promo.usageLimitTotal != null && counts.totalCount >= promo.usageLimitTotal) return false;
  if (promo.usageLimitPerUser != null && counts.userCount >= promo.usageLimitPerUser) return false;
  return true;
}
