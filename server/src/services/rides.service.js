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
import * as notificationsService from './notifications.service.js';
import * as zonesService from './zones.service.js';

const REQUEST_EXPIRY_MINUTES = 5;
const MAX_UPCOMING_SCHEDULED = 3;
// Scheduled rides start looking for a driver this long before pickup time.
const SCHEDULE_DISPATCH_LEAD_MINUTES = 10;
const SCHEDULE_REMINDER_LEAD_MINUTES = 30;

function round2(amount) {
  return Math.round(amount * 100) / 100;
}

async function buildQuote({ cityId, categoryId, pickup, dropoff, stops = [] }) {
  geoService.assertWithinServiceArea(pickup, dropoff, ...stops);
  await zonesService.assertBookable(cityId, pickup, dropoff);
  for (const stop of stops) await zonesService.assertBookable(cityId, stop, stop);
  const tariff = await pricingRepo.getCurrentTariff(cityId, categoryId);
  if (!tariff) throw new AppError(422, 'NO_TARIFF_FOR_MARKET');

  const surgeMultiplier = await pricingRepo.getActiveSurgeMultiplier(cityId, categoryId, pickup);
  const { distanceKm, durationMin } = await geoService.route(pickup, dropoff, stops);
  const fare = computeFare({ tariff, distanceKm, durationMin, surgeMultiplier });

  return { distanceKm, durationMin, surgeMultiplier, ...fare };
}

export async function quote({ cityId, categoryId, pickup, dropoff, stops }) {
  const built = await buildQuote({ cityId, categoryId, pickup, dropoff, stops });
  return { cityId, categoryId, currency: 'BDT', ...built };
}

export async function createRequest(passengerId, dto) {
  const {
    cityId, categoryId, pickup, dropoff, stops = [],
    paymentIntent, promoCode, womenOnly, scheduledFor,
  } = dto;

  const built = await buildQuote({ cityId, categoryId, pickup, dropoff, stops });
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
      if (scheduledFor) {
        if (await ridesRepo.countUpcomingScheduled(passengerId, client) >= MAX_UPCOMING_SCHEDULED) {
          throw new AppError(409, 'TOO_MANY_SCHEDULED_RIDES');
        }
      } else if (await ridesRepo.hasActiveTrip(passengerId, client)
        || await ridesRepo.hasSearchingRequest(passengerId, client)) {
        throw new AppError(409, 'ACTIVE_REQUEST_EXISTS');
      }

      const inserted = await ridesRepo.insertRequest({
        passengerId,
        cityId,
        categoryId,
        pickup,
        dropoff,
        stops,
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
          passengerId,
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
    scheduledFor: request.scheduledFor ?? null,
    stops,
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
    stops: request.stops ?? [],
    paymentIntent: request.paymentIntent,
    categoryName: request.categoryName,
    scheduledFor: request.scheduledFor ?? null,
    requestedAt: request.requestedAt,
    expiresAt: request.expiresAt,
    cancelledAt: request.cancelledAt,
    tripCode: request.tripCode ?? null,
  };
}

/** The rider's live search (if any) and upcoming scheduled rides, soonest first. */
export async function listActiveRequests(passengerId) {
  const rows = await ridesRepo.listActiveForPassenger(passengerId);
  return rows.map(toRequestStatus);
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

/**
 * Scheduled rides: remind the rider 30 minutes ahead, and start the normal search 10 minutes ahead.
 * A rider already on another trip keeps the booking pending; it expires 15 minutes after pickup time.
 */
export async function dispatchScheduledRequests() {
  const reminders = await withTransaction(async (client) => {
    const due = await ridesRepo.claimScheduledReminders(SCHEDULE_REMINDER_LEAD_MINUTES, client);
    for (const request of due) {
      await notificationsService.notify(request.passengerId, {
        category: 'ride',
        title: 'Your scheduled ride is coming up',
        body: `Pickup at ${request.pickupAddress ?? 'your pickup point'}. We start looking for a driver ${SCHEDULE_DISPATCH_LEAD_MINUTES} minutes before.`,
        payload: { requestPublicId: request.publicId },
      }, client);
    }
    return due.length;
  });

  const due = await ridesRepo.findScheduledDue(SCHEDULE_DISPATCH_LEAD_MINUTES);
  let dispatched = 0;
  for (const candidate of due) {
    const result = await withTransaction(async (client) => {
      await ridesRepo.lockPassengerBooking(candidate.passengerId, client);
      const request = await ridesRepo.findScheduledForUpdate(candidate.id, client);
      if (request?.status !== 'pending') return null;
      if (await ridesRepo.hasActiveTrip(request.passengerId, client)
        || await ridesRepo.hasSearchingRequest(request.passengerId, client)) return null;

      await ridesRepo.startScheduledSearch(request.id, REQUEST_EXPIRY_MINUTES, client);
      const offers = await dispatchService.fanOutOffers({
        requestId: request.id,
        passengerId: request.passengerId,
        categoryId: request.categoryId,
        pickupLat: request.pickupLat,
        pickupLng: request.pickupLng,
        womenOnly: request.womenOnly,
      }, client);
      await notificationsService.notify(request.passengerId, {
        category: 'ride',
        title: 'Finding a driver for your scheduled ride',
        body: 'Open Cholo to follow the search.',
        payload: { requestPublicId: request.publicId },
      }, client);
      return { offers, publicId: request.publicId };
    });
    if (result) {
      dispatchService.broadcastNewOffers(result.offers, result.publicId);
      dispatched += 1;
    }
  }

  return { reminders, dispatched };
}
