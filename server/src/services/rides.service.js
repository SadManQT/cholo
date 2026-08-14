import { withTransaction } from '../config/db.js';
import * as offersRepo from '../repositories/offers.repository.js';
import * as pricingRepo from '../repositories/pricing.repository.js';
import * as promosRepo from '../repositories/promos.repository.js';
import * as ridesRepo from '../repositories/rides.repository.js';
import { AppError } from '../utils/AppError.js';
import { quote as computeFare } from '../utils/fareMath.js';
import { computeDiscount } from '../utils/promoMath.js';
import * as dispatchService from './dispatch.service.js';
import * as geoService from './geo.service.js';

// Surge is intentionally NOT looked up here. doc 01 domain 3 scopes
// surge_pricing by zone_id, and resolving pickup{lat,lng} to a zone means a
// point-in-polygon test against zones.boundary_geojson — real GIS work
// (doc 01 §13.14 flags the PostGIS upgrade as a later step) that nothing in
// this codebase does yet. Rather than fake a "nearest zone" guess and quote
// a misleading fare, this defaults to 1.00 (no surge) until zone resolution
// exists; ride_requests.surge_multiplier carries the same default for the
// same reason.
const NO_SURGE = 1.0;

// doc 08-09-10 §10.1 worked example: requestedAt 06:02:11Z, expiresAt
// 06:07:11Z — exactly 5 minutes.
const REQUEST_EXPIRY_MINUTES = 5;

function round2(amount) {
  return Math.round(amount * 100) / 100;
}

// Shared by quote() and createRequest() — booking must snapshot the exact
// same computation a passenger was shown, not a second independent one
// (doc 01 §13.7: rules explain "what would this cost now?").
async function buildQuote({ cityId, categoryId, pickup, dropoff }) {
  const tariff = await pricingRepo.getCurrentTariff(cityId, categoryId);
  if (!tariff) throw new AppError(422, 'NO_TARIFF_FOR_MARKET');

  const { distanceKm, durationMin } = await geoService.route(pickup, dropoff);
  const fare = computeFare({ tariff, distanceKm, durationMin, surgeMultiplier: NO_SURGE });

  return { distanceKm, durationMin, surgeMultiplier: NO_SURGE, ...fare };
}

export async function quote({ cityId, categoryId, pickup, dropoff }) {
  const built = await buildQuote({ cityId, categoryId, pickup, dropoff });
  return { cityId, categoryId, currency: 'BDT', ...built };
}

export async function createRequest(passengerId, dto) {
  const {
    cityId, categoryId, pickup, dropoff,
    paymentIntent, promoCode, womenOnly, scheduledFor,
  } = dto;

  const built = await buildQuote({ cityId, categoryId, pickup, dropoff });
  const estFare = built.totalFare;

  let promo;
  if (promoCode) {
    promo = await promosRepo.findApplicable(promoCode, cityId, categoryId);
    if (!promo || (promo.minFare != null && estFare < promo.minFare)) {
      throw new AppError(422, 'PROMO_INVALID');
    }
  }

  // A percentage/fixed-amount ESTIMATE only, shown to the passenger before
  // booking. This does NOT create a promo_redemptions row and does NOT count
  // against usage_limit_total/usage_limit_per_user/first_ride_only — that
  // enforcement is redemption, which happens at trip completion (doc 01
  // relationship #37 "reserved on" vs #58 "redeemed as").
  const estDiscount = promo ? computeDiscount(promo, estFare) : 0;
  const estPayable = round2(estFare - estDiscount);

  let request;
  try {
    request = await withTransaction(async (client) => {
      // This lock is also taken by offer acceptance before it moves the
      // passenger from a searching request into an active trip. The
      // cross-table handoff is therefore atomic from a new booking's view.
      await ridesRepo.lockPassengerBooking(passengerId, client);
      if (await ridesRepo.hasActiveTrip(passengerId, client)) {
        throw new AppError(409, 'ACTIVE_REQUEST_EXISTS');
      }

      const inserted = await ridesRepo.insertRequest({
        passengerId,
        cityId,
        categoryId,
        pickup,
        dropoff,
        estDistanceKm: built.distanceKm,
        estDurationMin: built.durationMin,
        estFare,
        surgeMultiplier: built.surgeMultiplier,
        paymentIntent,
        promoCodeId: promo?.id,
        womenOnly,
        scheduledFor,
        // The 5-minute search window is for an immediate ride. A scheduled
        // ride has no dispatch/expiry semantics yet (that's real design work
        // for whoever builds scheduled dispatch, doc 13 §11 lists it COULD/
        // cut-first) — NULL is "not applicable yet", not a guess.
        expiryMinutes: scheduledFor ? null : REQUEST_EXPIRY_MINUTES,
      }, client);

      // Scheduled rides don't dispatch now — same reasoning as the NULL
      // expiry above, there's no "who's nearby" question worth asking for
      // a ride that's days away.
      if (!scheduledFor) {
        await dispatchService.fanOutOffers({
          requestId: inserted.id,
          requestPublicId: inserted.publicId,
          categoryId,
          pickupLat: pickup.lat,
          pickupLng: pickup.lng,
          womenOnly,
        }, client);
      }

      return inserted;
    });
  } catch (error) {
    // ux_one_active_request_per_passenger (schema.sql) is the real backstop;
    // this just translates its violation into the documented error code.
    if (error.code === '23505' && error.constraint === 'ux_one_active_request_per_passenger') {
      throw new AppError(409, 'ACTIVE_REQUEST_EXISTS');
    }
    throw error;
  }

  return {
    publicId: request.publicId,
    status: request.status,
    quote: {
      estFare,
      estDiscount,
      estPayable,
      currency: 'BDT',
      estDistanceKm: built.distanceKm,
      estDurationMin: built.durationMin,
      surgeMultiplier: built.surgeMultiplier,
    },
    requestedAt: request.requestedAt,
    expiresAt: request.expiresAt,
  };
}

function toRequestStatus(request) {
  return {
    publicId: request.publicId,
    status: request.status,
    pickup: {
      lat: request.pickupLat,
      lng: request.pickupLng,
      address: request.pickupAddress,
    },
    dropoff: {
      lat: request.dropoffLat,
      lng: request.dropoffLng,
      address: request.dropoffAddress,
    },
    quote: {
      estFare: request.estFare,
      currency: 'BDT',
      estDistanceKm: request.estDistanceKm,
      estDurationMin: request.estDurationMin,
      surgeMultiplier: request.surgeMultiplier,
    },
    paymentIntent: request.paymentIntent,
    requestedAt: request.requestedAt,
    expiresAt: request.expiresAt,
    cancelledAt: request.cancelledAt,
    tripCode: request.tripCode ?? null,
  };
}

export async function getRequest(passengerId, publicId) {
  const request = await ridesRepo.findByPublicIdForPassenger(publicId, passengerId);
  if (!request) throw new AppError(404, 'RIDE_REQUEST_NOT_FOUND');
  return toRequestStatus(request);
}

export async function cancelRequest(passengerId, publicId) {
  return withTransaction(async (client) => {
    const request = await ridesRepo.findByPublicIdForUpdate(publicId, passengerId, client);
    if (!request) throw new AppError(404, 'RIDE_REQUEST_NOT_FOUND');
    if (request.status === 'matched') throw new AppError(409, 'ALREADY_MATCHED');
    if (!['pending', 'searching'].includes(request.status)) {
      throw new AppError(409, 'BAD_TRANSITION');
    }

    const cancelled = await ridesRepo.cancelSearching(request.id, client);
    await offersRepo.withdrawPendingOffersForRequests([request.id], client);
    return cancelled;
  });
}

// jobs/expireRequests.job.js's cron entry point. Scheduled requests are
// never touched — ridesRepo.expireStaleRequests only matches rows with a
// non-NULL expires_at, and createRequest never sets one for scheduled_for
// requests (they have no dispatch/expiry semantics yet, see above).
export async function expireStaleRequests() {
  return withTransaction(async (client) => {
    const expired = await ridesRepo.expireStaleRequests(client);
    if (expired.length > 0) {
      await offersRepo.withdrawPendingOffersForRequests(expired.map((request) => request.id), client);
    }
    return expired;
  });
}
