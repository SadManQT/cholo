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
import * as zonesService from './zones.service.js';

const NO_SURGE = 1.0;

const REQUEST_EXPIRY_MINUTES = 5;

function round2(amount) {
  return Math.round(amount * 100) / 100;
}

async function buildQuote({ cityId, categoryId, pickup, dropoff }) {
  geoService.assertWithinServiceArea(pickup, dropoff);
  await zonesService.assertBookable(cityId, pickup, dropoff);
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

  const estDiscount = promo ? computeDiscount(promo, estFare) : 0;
  const estPayable = round2(estFare - estDiscount);

  let request;
  let newOffers = [];
  try {
    request = await withTransaction(async (client) => {
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
        expiryMinutes: scheduledFor ? null : REQUEST_EXPIRY_MINUTES,
      }, client);

      if (!scheduledFor) {
        newOffers = await dispatchService.fanOutOffers({
          requestId: inserted.id,
          categoryId,
          pickupLat: pickup.lat,
          pickupLng: pickup.lng,
          womenOnly,
        }, client);
      }

      return inserted;
    });
  } catch (error) {
    if (error.code === '23505' && error.constraint === 'ux_one_active_request_per_passenger') {
      throw new AppError(409, 'ACTIVE_REQUEST_EXISTS');
    }
    throw error;
  }

  dispatchService.broadcastNewOffers(newOffers, request.publicId);

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

export async function expireStaleRequests() {
  return withTransaction(async (client) => {
    const expired = await ridesRepo.expireStaleRequests(client);
    if (expired.length > 0) {
      await offersRepo.withdrawPendingOffersForRequests(expired.map((request) => request.id), client);
    }
    return expired;
  });
}
