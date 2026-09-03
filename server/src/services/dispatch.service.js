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

// Not specified in any doc — a reasonable urban dispatch radius, easy to
// tune later. No PostGIS yet (doc 01 §13.14), so this is a plain haversine
// filter over online drivers, not an indexed radius query — fine at this
// scale, the upgrade path is documented.
const DISPATCH_RADIUS_KM = 5;

// doc 11-12 §6.1: "a driver has 15 seconds to decide."
const OFFER_TIMEOUT_SECONDS = 15;

// Single round only: ride_offers.round exists for "nearest first, widening"
// (doc 04) multi-wave dispatch, but advancing to round 2 needs a scheduled
// job to detect "nobody answered in time" — that's step 14's expiry cron,
// not built yet. This fans out once, to every eligible driver in range.
//
// DB work only — no socket emit here. This runs inside the same transaction
// that inserts the ride_request, so anything pushed from here would notify a
// driver about an offer a later statement in that same transaction could
// still roll back. Call broadcastNewOffers() with the return value only
// after that transaction has committed.
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

// doc 08-09-10's own driver/offers row: "Pending offers (push arrives via
// socket; this is the pull)" — so the push is deliberately thin, just enough
// for the driver app to know something arrived and go fetch
// GET /driver/offers for the full card, not a duplicate of that response
// over the wire.
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

  // Resolved by ANY path already — a prior accept/reject, or this same
  // request being withdrawn because another driver took it. One check
  // covers all of those; the request-level FOR UPDATE race below is what
  // actually decides "another driver" in the first place.
  if (offer.response !== 'pending') {
    throw new AppError(409, 'ALREADY_TAKEN');
  }
  if (isExpired(offer.offeredAt)) {
    await offersRepo.markResponse(offerId, 'timed_out');
    throw new AppError(410, 'OFFER_EXPIRED');
  }

  if (response === 'rejected') {
    // Guarded UPDATE (WHERE response = 'pending') — if this loses the race
    // against a concurrent accept/withdrawal that resolved the offer first,
    // it applies to zero rows rather than stomping that outcome back to
    // 'rejected'.
    const applied = await offersRepo.markResponse(offerId, 'rejected');
    if (!applied) throw new AppError(409, 'ALREADY_TAKEN');
    return { id: offerId, response: 'rejected' };
  }

  return acceptOffer(driverId, offer.requestId, offerId, offer.passengerId);
}

// The accept race, doc 02-03 §8 T1 — the exact pattern from doc 08-09-10
// §3's dispatch.service.js snippet, using this codebase's own withTransaction
// helper (config/db.js) instead of hand-rolled BEGIN/COMMIT/ROLLBACK, since
// that helper already exists and is what every other multi-step write here
// uses (driver.service.js, etc).
async function acceptOffer(driverId, requestId, offerId, requestPassengerId) {
  let trip;
  let passengerId;
  let result;

  try {
    result = await withTransaction(async (client) => {
      // NOT `SET LOCAL app.user_id = $1` — despite being the literal doc
      // 08-09-10 §3 snippet, SET does not accept bind parameters through
      // node-postgres (confirmed against live Postgres: "syntax error at or
      // near $1"). set_config(..., true) is the parameterizable equivalent
      // — same LOCAL-to-this-transaction scoping, third arg true = LOCAL.
      await client.query(`SELECT set_config('app.user_id', $1, true)`, [String(driverId)]);

      // Same lock/order as rides.service.js booking: this makes the
      // request -> trip handoff indivisible to a concurrent new booking.
      await ridesRepo.lockPassengerBooking(requestPassengerId, client);

      // 🔒 row lock: a second driver's accept blocks HERE, not at the INSERT.
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
      // Everyone else's pending offer for this request is moot now...
      await offersRepo.withdrawOtherOffersForRequest(requestId, driverId, client);
      // ...and so is this driver's pending offer on any OTHER request —
      // they're about to be on_trip and can't serve it.
      await offersRepo.withdrawOtherOffersForDriver(driverId, offerId, client);

      const insertedTrip = await tripsRepo.insertTrip({
        requestId,
        passengerId: request.passengerId,
        driverId,
        vehicleId: availability.activeVehicleId,
      }, client);

      await driversRepo.updateAvailability(driverId, { status: 'on_trip' }, client);

      const passenger = await passengersRepo.findNameAndRating(request.passengerId, client);

      // Captured for the post-commit broadcast below — never emit from
      // inside the transaction itself, or a participant could be notified
      // about a trip that a later statement in this same block still rolls
      // back.
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
    // Belt and suspenders (doc 02-03 §8 T1): the lock above is what actually
    // prevents the race. This just means "if it were somehow bypassed, the
    // UNIQUE constraint makes a second trip physically unstorable" — trips
    // .request_id UNIQUE is the unbypassable floor.
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
