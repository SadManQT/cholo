import { withTransaction } from '../config/db.js';
import * as driversRepo from '../repositories/drivers.repository.js';
import * as offersRepo from '../repositories/offers.repository.js';
import * as passengersRepo from '../repositories/passengers.repository.js';
import * as ridesRepo from '../repositories/rides.repository.js';
import * as tripsRepo from '../repositories/trips.repository.js';
import { getIO } from '../sockets/index.js';
import { broadcastTripStatus, driverRoom } from '../sockets/rooms.js';
import { AppError } from '../utils/AppError.js';
import { formatShortName } from '../utils/formatName.js';
import { haversineDistanceKm } from '../utils/haversine.js';

const DISPATCH_RADIUS_KM = 5;

const OFFER_TIMEOUT_SECONDS = 15;

export async function fanOutOffers({ requestId, categoryId, pickupLat, pickupLng, womenOnly }, client) {
  const candidates = await offersRepo.findEligibleDrivers({ categoryId, womenOnly }, client);

  const offers = candidates
    .map((driver) => ({
      driverId: driver.driverId,
      distanceKm: Math.round(
        haversineDistanceKm(pickupLat, pickupLng, driver.currentLat, driver.currentLng) * 100,
      ) / 100,
    }))
    .filter((offer) => offer.distanceKm <= DISPATCH_RADIUS_KM)
    .sort((a, b) => a.distanceKm - b.distanceKm);

  if (offers.length === 0) return [];

  const inserted = await offersRepo.insertOffers(requestId, offers, client);

  return inserted.map((row) => ({
    offerId: row.id,
    driverId: row.driverId,
    distanceKm: offers.find((offer) => String(offer.driverId) === String(row.driverId))?.distanceKm,
  }));
}

export function broadcastNewOffers(offers, requestPublicId) {
  if (offers.length === 0) return;
  const io = getIO();
  if (!io) return;

  const expiresAt = new Date(Date.now() + OFFER_TIMEOUT_SECONDS * 1000).toISOString();
  for (const offer of offers) {
    io.to(driverRoom(offer.driverId)).emit('offer:new', {
      offerId: offer.offerId,
      requestPublicId,
      distanceKm: offer.distanceKm,
      expiresAt,
    });
  }
}

export async function listOffersForDriver(driverId) {
  return offersRepo.findPendingForDriver(driverId, OFFER_TIMEOUT_SECONDS);
}

function isExpired(offeredAt) {
  return Date.now() - new Date(offeredAt).getTime() > OFFER_TIMEOUT_SECONDS * 1000;
}

export async function respondToOffer(driverId, offerId, response) {
  const offer = await offersRepo.findByIdForDriver(offerId, driverId);
  if (!offer) throw new AppError(404, 'OFFER_NOT_FOUND');

  if (offer.response !== 'pending') {
    throw new AppError(409, 'ALREADY_TAKEN');
  }
  if (isExpired(offer.offeredAt)) {
    await offersRepo.markResponse(offerId, 'timed_out');
    throw new AppError(410, 'OFFER_EXPIRED');
  }

  if (response === 'rejected') {
    const applied = await offersRepo.markResponse(offerId, 'rejected');
    if (!applied) throw new AppError(409, 'ALREADY_TAKEN');
    return { id: offerId, response: 'rejected' };
  }

  return acceptOffer(driverId, offer.requestId, offerId, offer.passengerId);
}

async function acceptOffer(driverId, requestId, offerId, requestPassengerId) {
  let trip;
  let passengerId;
  let result;

  try {
    result = await withTransaction(async (client) => {
      await client.query(`SELECT set_config('app.user_id', $1, true)`, [String(driverId)]);

      await ridesRepo.lockPassengerBooking(requestPassengerId, client);

      const request = await ridesRepo.findForUpdate(requestId, client);
      if (request?.status !== 'searching') {
        throw new AppError(409, 'ALREADY_TAKEN');
      }

      const availability = await driversRepo.findAvailabilityForUpdate(driverId, client);
      if (!availability?.activeVehicleId) {
        throw new AppError(409, 'ACTIVE_VEHICLE_REQUIRED');
      }

      await ridesRepo.markMatched(requestId, client);
      await offersRepo.markResponse(offerId, 'accepted', client);
      await offersRepo.withdrawOtherOffersForRequest(requestId, driverId, client);
      await offersRepo.withdrawOtherOffersForDriver(driverId, offerId, client);

      const insertedTrip = await tripsRepo.insertTrip({
        requestId,
        passengerId: request.passengerId,
        driverId,
        vehicleId: availability.activeVehicleId,
      }, client);

      await driversRepo.updateAvailability(driverId, { status: 'on_trip' }, client);

      const passenger = await passengersRepo.findNameAndRating(request.passengerId, client);

      trip = insertedTrip;
      passengerId = request.passengerId;

      return {
        trip: {
          publicCode: insertedTrip.tripCode,
          status: insertedTrip.status,
          pickup: {
            lat: request.pickupLat,
            lng: request.pickupLng,
            address: request.pickupAddress,
          },
          passenger: {
            name: formatShortName(passenger.fullName),
            rating: passenger.ratingAvg,
          },
        },
      };
    });
  } catch (error) {
    if (error.code === '23505' && error.constraint === 'trips_request_id_key') {
      throw new AppError(409, 'ALREADY_TAKEN');
    }
    throw error;
  }

  const io = getIO();
  if (io) {
    await broadcastTripStatus(io, { id: trip.id, passengerId, driverId }, {
      status: trip.status,
      tripCode: trip.tripCode,
    });
  }

  return result;
}
