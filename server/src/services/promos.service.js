import * as promosRepo from '../repositories/promos.repository.js';
import * as tripsRepo from '../repositories/trips.repository.js';
import { AppError } from '../utils/AppError.js';
import { round2 } from '../utils/fareMath.js';
import { computeDiscount, isPromoApplicable, isPromoUsageAvailable } from '../utils/promoMath.js';

// doc 08-09-10 §7: POST /promos/validate — a preview only (nothing is
// written), but a richer check than booking's own findApplicable: it
// differentiates "doesn't exist" (404) from "used up" (409) from "exists
// but doesn't apply right now" (422), which booking's single PROMO_INVALID
// deliberately collapses (doc's own comment on that path: booking doesn't
// enforce usage limits, redemption at completion does).
export async function validatePromo(userId, { code, cityId, categoryId, estFare }) {
  const promo = await promosRepo.findByCode(code);
  if (!promo) throw new AppError(404, 'PROMO_NOT_FOUND');

  const counts = await promosRepo.countRedemptions(promo.id, userId);
  if (!isPromoUsageAvailable(promo, counts)) throw new AppError(409, 'PROMO_LIMIT_REACHED');

  const isFirstRide = promo.firstRideOnly ? !(await tripsRepo.hasCompletedTrip(userId)) : true;
  if (!isPromoApplicable(promo, { cityId, categoryId, fareAmount: estFare, isFirstRide })) {
    throw new AppError(422, 'PROMO_NOT_APPLICABLE');
  }

  const discount = computeDiscount(promo, estFare);
  return { code: promo.code, discount, finalFare: round2(estFare - discount) };
}

export async function listAvailablePromos(cityId) {
  return promosRepo.listActiveForCity(cityId);
}
