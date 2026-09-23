import * as promosRepo from '../repositories/promos.repository.js';
import * as tripsRepo from '../repositories/trips.repository.js';
import { AppError } from '../utils/AppError.js';
import { round2 } from '../utils/fareMath.js';
import { computeDiscount, isPromoApplicable, isPromoUsageAvailable } from '../utils/promoMath.js';

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
