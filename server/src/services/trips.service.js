import { withTransaction } from '../config/db.js';
import * as driversRepo from '../repositories/drivers.repository.js';
import * as pricingRepo from '../repositories/pricing.repository.js';
import * as ridesRepo from '../repositories/rides.repository.js';
import * as tripsRepo from '../repositories/trips.repository.js';
import { getIO } from '../sockets/index.js';
import { broadcastTripStatus } from '../sockets/rooms.js';
import { AppError } from '../utils/AppError.js';
import { quote as computeFare } from '../utils/fareMath.js';
import * as geoService from './geo.service.js';

// null in every test (tests import app.js, never server.js — see
// sockets/index.js) and in any process that hasn't attached a socket
// server yet; every call site below no-ops when this is null instead of
// throwing, the same "REST works with or without sockets" contract doc
// 05-06-07 §7 describes.
async function notifyTripStatus(trip, payload) {
  const io = getIO();
  if (!io) return;
  await broadcastTripStatus(io, trip, payload);
}

// Same reasoning as dispatch.service.js/rides.service.js: no zone-lookup
// infrastructure exists yet, so surge never applies.
const NO_SURGE = 1.0;

// Every UPDATE on trips fires fn_log_trip_status (schema.sql), which reads
// this session variable to attribute the trip_status_history row to a
// human rather than leaving changed_by NULL — the exact set_config (not
// SET LOCAL, doesn't take bind params) idiom dispatch.service.js's
// acceptOffer already uses for the trip's initial INSERT.
async function attributeTo(userId, client) {
  await client.query(`SELECT set_config('app.user_id', $1, true)`, [String(userId)]);
}

async function loadOwnedTripForUpdate(driverId, tripCode, client) {
  const trip = await tripsRepo.findByCodeForUpdate(tripCode, client);
  // 404, not 403, for an ownership mismatch — same IDOR-prevention pattern
  // as driver.service.js's vehicle checks: don't reveal that a trip code
  // exists to a driver who isn't on it.
  // trip.driverId is a string (BIGINT columns aren't auto-converted by
  // node-postgres); driverId here is the Number auth.js already parsed
  // from the JWT — Number() first, same pattern as driver.service.js's
  // vehicle-ownership checks, or this comparison is always false.
  if (!trip || Number(trip.driverId) !== driverId) {
    throw new AppError(404, 'TRIP_NOT_FOUND');
  }
  return trip;
}

function assertTransition(trip, expectedStatus) {
  if (trip.status !== expectedStatus) {
    throw new AppError(409, 'BAD_TRANSITION');
  }
}

export async function markArrived(driverId, tripCode) {
  const updated = await withTransaction(async (client) => {
    await attributeTo(driverId, client);
    const trip = await loadOwnedTripForUpdate(driverId, tripCode, client);
    assertTransition(trip, 'assigned');
    return { trip, updated: await tripsRepo.markArrived(trip.id, client) };
  });

  await notifyTripStatus(updated.trip, { status: updated.updated.status, arrivedAt: updated.updated.arrivedAt });
  return updated.updated;
}

export async function markStarted(driverId, tripCode) {
  const updated = await withTransaction(async (client) => {
    await attributeTo(driverId, client);
    const trip = await loadOwnedTripForUpdate(driverId, tripCode, client);
    assertTransition(trip, 'arrived');
    return { trip, updated: await tripsRepo.markStarted(trip.id, client) };
  });

  await notifyTripStatus(updated.trip, { status: updated.updated.status, startedAt: updated.updated.startedAt });
  return updated.updated;
}

// doc 08-09-10 §6: "server computes distance from pings and the full fare."
// sockets/location.handler.js now records real GPS pings into
// trip_location_pings during the trip (roadmap step 15) — but aggregating
// that trail into an "actual distance travelled" figure (sparse pings,
// dropped connections, etc.) is real work this task didn't ask for. A
// fresh route() over the trip's own pickup/dropoff remains the stand-in
// for "actual" distance/duration until that aggregation is built.
export async function completeTrip(driverId, tripCode, { waitingMin = 0 } = {}) {
  const result = await withTransaction(async (client) => {
    await attributeTo(driverId, client);
    const trip = await loadOwnedTripForUpdate(driverId, tripCode, client);
    assertTransition(trip, 'in_progress');

    const { distanceKm, durationMin } = await geoService.route(
      { lat: trip.pickupLat, lng: trip.pickupLng },
      { lat: trip.dropoffLat, lng: trip.dropoffLng },
    );

    // Current tariff at COMPLETION time, not the original quote's — trips'
    // fare columns are the authoritative snapshot (doc 01: "the immutable
    // fare-breakdown snapshot"), captured once, here. ride_requests only
    // ever stored the single-number est_fare, never the itemized
    // breakdown, so there is nothing earlier to reuse.
    const tariff = await pricingRepo.getCurrentTariff(trip.cityId, trip.categoryId, client);
    if (!tariff) throw new AppError(422, 'NO_TARIFF_FOR_MARKET');

    const fare = computeFare({
      tariff,
      distanceKm,
      durationMin,
      waitingMinutes: waitingMin,
      surgeMultiplier: NO_SURGE,
    });

    const updated = await tripsRepo.completeTrip(trip.id, {
      actualDistanceKm: distanceKm,
      actualDurationMin: durationMin,
      fare,
    }, client);

    return { trip, updated };
  });

  const { trip, updated } = result;
  const response = {
    status: updated.status,
    fare: {
      base: updated.baseFare,
      distance: updated.distanceFare,
      time: updated.timeFare,
      waiting: updated.waitingFare,
      surge: updated.surgeAmount,
      bookingFee: updated.bookingFee,
      discount: updated.discountAmount,
      total: updated.totalFare,
      currency: updated.currency,
    },
    // doc 08-09-10 §10.3 shows a gateway-specific "pending_redirect" here
    // — that implies payment processing (M7, not built). Reporting the
    // trip's REAL payment_status ('unpaid' — nothing has processed
    // payment yet) is more honest than fabricating a gateway state.
    payment: {
      status: updated.paymentStatus,
    },
  };

  await notifyTripStatus(trip, { status: updated.status, completedAt: updated.completedAt, fare: response.fare });
  return response;
}

// doc 08-09-10 §5: cancellation is only meaningful before the ride is
// actually under way — 'in_progress'/'completed'/'cancelled' all fall
// through to BAD_TRANSITION, matching the doc's own "already in_progress"
// example error.
const CANCELLABLE_STATUSES = ['assigned', 'arrived'];

// Not specified in any doc — same kind of stand-in constant as
// dispatch.service.js's DISPATCH_RADIUS_KM: real tuning is a product/ops
// decision, not this milestone's. A short free-cancel window right after
// assignment absorbs an honest instant "wrong button" tap without treating
// every cancellation as chargeable.
const PASSENGER_GRACE_PERIOD_MINUTES = 2;

// /trips/:tripCode/cancel is for either side of the trip, unlike the other
// three (DRIVER only) — resolve by matching the JWT's user id against the
// row's own passenger_id/driver_id rather than a role check, so ownership
// and role can never disagree.
function resolveParticipantRole(userId, trip) {
  if (Number(trip.passengerId) === userId) return 'passenger';
  if (Number(trip.driverId) === userId) return 'driver';
  return null;
}

// doc 04's own description of pricing_rules.cancellation_fee: "Charged on
// late passenger cancellation." Only a passenger cancellation can owe this
// fee — a driver cancelling costs the driver their own wasted trip, not the
// passenger's money, and there's no driver-side penalty ledger yet (that's
// wallet/M7 territory). 'arrived' always charges (the driver is already
// there, waiting); 'assigned' charges only once the grace period passes.
async function computeCancellationFee(role, trip, client) {
  if (role !== 'passenger') return 0;

  const withinGracePeriod = trip.status === 'assigned'
    && Date.now() - new Date(trip.assignedAt).getTime() <= PASSENGER_GRACE_PERIOD_MINUTES * 60_000;
  if (withinGracePeriod) return 0;

  const tariff = await pricingRepo.getCurrentTariff(trip.cityId, trip.categoryId, client);
  if (!tariff) throw new AppError(422, 'NO_TARIFF_FOR_MARKET');
  return tariff.cancellationFee;
}

export async function cancelTrip(userId, tripCode, { reasonCode, reasonText }) {
  const result = await withTransaction(async (client) => {
    await attributeTo(userId, client);

    const trip = await tripsRepo.findByCodeForUpdate(tripCode, client);
    const role = trip && resolveParticipantRole(userId, trip);
    // 404, not 403 — same IDOR-prevention pattern as the other three
    // transitions: a caller who isn't on this trip can't tell it exists.
    if (!role) throw new AppError(404, 'TRIP_NOT_FOUND');
    if (!CANCELLABLE_STATUSES.includes(trip.status)) {
      throw new AppError(409, 'BAD_TRANSITION');
    }

    const feeCharged = await computeCancellationFee(role, trip, client);

    const cancelled = await tripsRepo.markCancelled(trip.id, client);
    const cancellation = await tripsRepo.insertCancellation(trip.id, {
      cancelledByRole: role,
      cancelledBy: userId,
      reasonCode,
      reasonText,
      feeCharged,
    }, client);

    // Without this, ux_one_active_request_per_passenger (schema.sql) keeps
    // counting this 'matched' request as the passenger's one active slot
    // forever — nothing else ever moves it out of that status once its
    // trip is cancelled, permanently locking them out of booking again.
    await ridesRepo.markCancelled(trip.requestId, client);

    // The driver isn't on a trip anymore — free them back up for dispatch,
    // the same availability transition acceptOffer makes going the other way.
    await driversRepo.updateAvailability(trip.driverId, { status: 'online' }, client);

    return {
      trip,
      response: {
        status: cancelled.status,
        cancelledBy: role,
        reasonCode,
        feeCharged: cancellation.feeCharged,
        cancelledAt: cancellation.cancelledAt,
      },
    };
  });

  await notifyTripStatus(result.trip, result.response);
  return result.response;
}

export async function listTrips(userId, query) {
  const rows = await tripsRepo.listForUser(userId, query);
  const total = rows[0]?.totalCount ?? 0;
  const data = rows.map(({ totalCount: _totalCount, ...trip }) => trip);

  return {
    data,
    meta: { page: query.page, limit: query.limit, total },
  };
}

function toTripDetail(trip, history) {
  return {
    publicCode: trip.publicCode,
    requestPublicId: trip.requestPublicId,
    status: trip.status,
    participantRole: trip.participantRole,
    cityName: trip.cityName,
    categoryName: trip.categoryName,
    pickup: { lat: trip.pickupLat, lng: trip.pickupLng, address: trip.pickupAddress },
    dropoff: { lat: trip.dropoffLat, lng: trip.dropoffLng, address: trip.dropoffAddress },
    estimate: {
      distanceKm: trip.estDistanceKm,
      durationMin: trip.estDurationMin,
      fare: trip.estFare,
      surgeMultiplier: trip.surgeMultiplier,
      paymentIntent: trip.paymentIntent,
    },
    passenger: {
      id: trip.passengerPublicId,
      name: trip.passengerName,
      phone: trip.passengerPhone,
      photoUrl: trip.passengerPhotoUrl,
      rating: trip.passengerRating,
    },
    driver: {
      id: trip.driverPublicId,
      name: trip.driverName,
      phone: trip.driverPhone,
      photoUrl: trip.driverPhotoUrl,
      rating: trip.driverRating,
    },
    vehicle: {
      registrationNo: trip.vehicleRegistrationNo,
      brand: trip.vehicleBrand,
      model: trip.vehicleModel,
      color: trip.vehicleColor,
    },
    timeline: {
      assignedAt: trip.assignedAt,
      arrivedAt: trip.arrivedAt,
      startedAt: trip.startedAt,
      completedAt: trip.completedAt,
    },
    actual: {
      distanceKm: trip.actualDistanceKm,
      durationMin: trip.actualDurationMin,
    },
    fare: {
      base: trip.baseFare,
      distance: trip.distanceFare,
      time: trip.timeFare,
      waiting: trip.waitingFare,
      surge: trip.surgeAmount,
      bookingFee: trip.bookingFee,
      discount: trip.discountAmount,
      total: trip.totalFare,
      currency: trip.currency,
      paymentStatus: trip.paymentStatus,
    },
    cancellation: trip.cancelledAt ? {
      byRole: trip.cancelledByRole,
      reasonCode: trip.cancellationReasonCode,
      reasonText: trip.cancellationReasonText,
      fee: trip.cancellationFee,
      cancelledAt: trip.cancelledAt,
    } : null,
    history,
  };
}

export async function getTrip(userId, tripCode) {
  const trip = await tripsRepo.findDetailForUser(tripCode, userId);
  if (!trip) throw new AppError(404, 'TRIP_NOT_FOUND');
  const history = await tripsRepo.listStatusHistory(trip.id);
  return toTripDetail(trip, history);
}

export async function trackTrip(userId, tripCode) {
  const trip = await tripsRepo.findParticipantTrip(tripCode, userId);
  if (!trip) throw new AppError(404, 'TRIP_NOT_FOUND');
  const location = await tripsRepo.findLatestLocationForUser(tripCode, userId);
  if (location?.lat == null || location?.lng == null) return null;
  return location;
}

export async function listMessages(userId, tripCode) {
  const trip = await tripsRepo.findParticipantTrip(tripCode, userId);
  if (!trip) throw new AppError(404, 'TRIP_NOT_FOUND');
  return tripsRepo.listMessages(trip.id);
}

export async function sendMessage(userId, tripCode, input) {
  const trip = await tripsRepo.findParticipantTrip(tripCode, userId);
  if (!trip) throw new AppError(404, 'TRIP_NOT_FOUND');
  if (!['assigned', 'arrived', 'in_progress'].includes(trip.status)) {
    throw new AppError(409, 'TRIP_CLOSED');
  }
  return tripsRepo.insertMessage(trip.id, userId, input);
}

export async function triggerSos(userId, tripCode, location) {
  const trip = await tripsRepo.findParticipantTrip(tripCode, userId);
  if (!trip) throw new AppError(404, 'TRIP_NOT_FOUND');
  if (!['assigned', 'arrived', 'in_progress'].includes(trip.status)) {
    throw new AppError(409, 'TRIP_CLOSED');
  }
  return tripsRepo.insertSosAlert(trip.id, userId, location);
}
