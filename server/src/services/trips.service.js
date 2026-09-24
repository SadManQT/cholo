import { withTransaction } from '../config/db.js';
import * as driversRepo from '../repositories/drivers.repository.js';
import * as earningsRepo from '../repositories/earnings.repository.js';
import * as paymentsRepo from '../repositories/payments.repository.js';
import * as pricingRepo from '../repositories/pricing.repository.js';
import * as promosRepo from '../repositories/promos.repository.js';
import * as receiptsRepo from '../repositories/receipts.repository.js';
import * as ridesRepo from '../repositories/rides.repository.js';
import * as safetyRepo from '../repositories/safety.repository.js';
import * as ratingsRepo from '../repositories/ratings.repository.js';
import * as tripsRepo from '../repositories/trips.repository.js';
import * as usersRepo from '../repositories/users.repository.js';
import * as walletRepo from '../repositories/wallet.repository.js';
import { getIO } from '../sockets/index.js';
import { broadcastTripStatus } from '../sockets/rooms.js';
import { AppError } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';
import { computeCommission } from '../utils/commissionMath.js';
import { quote as computeFare, round2 } from '../utils/fareMath.js';
import { computeDiscount, isPromoApplicable, isPromoUsageAvailable } from '../utils/promoMath.js';
import * as geoService from './geo.service.js';
import * as paymentGateway from './paymentGateway.service.js';

async function notifyTripStatus(trip, payload) {
  const io = getIO();
  if (!io) return;
  await broadcastTripStatus(io, trip, payload);
}

const NO_SURGE = 1.0;

async function attributeTo(userId, client) {
  await client.query(`SELECT set_config('app.user_id', $1, true)`, [String(userId)]);
}

async function loadOwnedTripForUpdate(driverId, tripCode, client) {
  const trip = await tripsRepo.findByCodeForUpdate(tripCode, client);
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

export async function settleDriverEarnings(trip, grossFare, client, { platformCollected = false } = {}) {
  const commission = await pricingRepo.getCurrentCommission(trip.categoryId, trip.cityId, client);
  if (!commission) throw new AppError(422, 'NO_COMMISSION_RULE_FOR_MARKET');

  const { commissionAmount, netEarning } = computeCommission({
    grossFare,
    commissionPct: commission.commissionPct,
  });

  await earningsRepo.insertEarning({
    tripId: trip.id,
    driverId: trip.driverId,
    grossFare,
    commissionRuleId: commission.id,
    commissionPct: commission.commissionPct,
    commissionAmount,
    netEarning,
  }, client);

  const driverWallet = await walletRepo.getByUserId(trip.driverId, client);
  await walletRepo.insertTransaction(platformCollected ? {
    walletId: driverWallet.id,
    txnType: 'trip_earning',
    direction: 'credit',
    amount: netEarning,
    referenceType: 'trip',
    referenceId: trip.id,
    idempotencyKey: `earning-trip-${trip.id}`,
  } : {
    walletId: driverWallet.id,
    txnType: 'commission',
    direction: 'debit',
    amount: commissionAmount,
    referenceType: 'trip',
    referenceId: trip.id,
    idempotencyKey: `commission-trip-${trip.id}`,
  }, client);
}

async function redeemPromoIfApplicable(trip, preDiscountTotal, client) {
  if (!trip.promoCodeId) return null;

  const promo = await promosRepo.findByIdForUpdate(trip.promoCodeId, client);
  if (!promo) return null;

  const counts = await promosRepo.countRedemptions(promo.id, trip.passengerId, client);
  if (!isPromoUsageAvailable(promo, counts)) return null;

  const isFirstRide = promo.firstRideOnly
    ? !(await tripsRepo.hasCompletedTrip(trip.passengerId, client))
    : true;
  const applicable = isPromoApplicable(promo, {
    cityId: trip.cityId,
    categoryId: trip.categoryId,
    fareAmount: preDiscountTotal,
    isFirstRide,
  });
  if (!applicable) return null;

  return { promoId: promo.id, discountAmount: computeDiscount(promo, preDiscountTotal) };
}

export async function completeTrip(driverId, tripCode, { waitingMin = 0 } = {}) {
  const result = await withTransaction(async (client) => {
    await attributeTo(driverId, client);
    const trip = await loadOwnedTripForUpdate(driverId, tripCode, client);
    assertTransition(trip, 'in_progress');

    const { distanceKm, durationMin } = await geoService.route(
      { lat: trip.pickupLat, lng: trip.pickupLng },
      { lat: trip.dropoffLat, lng: trip.dropoffLng },
    );

    const tariff = await pricingRepo.getCurrentTariff(trip.cityId, trip.categoryId, client);
    if (!tariff) throw new AppError(422, 'NO_TARIFF_FOR_MARKET');

    const fare = computeFare({
      tariff,
      distanceKm,
      durationMin,
      waitingMinutes: waitingMin,
      surgeMultiplier: NO_SURGE,
    });

    const preDiscountTotal = fare.totalFare;
    const redemption = await redeemPromoIfApplicable(trip, preDiscountTotal, client);
    if (redemption) {
      fare.discountAmount = redemption.discountAmount;
      fare.totalFare = round2(preDiscountTotal - redemption.discountAmount);
    }

    const isCash = trip.paymentIntent === 'cash';

    const updated = await tripsRepo.completeTrip(trip.id, {
      actualDistanceKm: distanceKm,
      actualDurationMin: durationMin,
      fare,
      paymentStatus: isCash ? 'paid' : 'unpaid',
    }, client);

    await driversRepo.updateAvailability(driverId, { status: 'online' }, client);

    if (redemption) {
      await promosRepo.insertRedemption({
        promoCodeId: redemption.promoId,
        userId: trip.passengerId,
        tripId: trip.id,
        discountAmount: redemption.discountAmount,
      }, client);
    }

    if (isCash) {
      await paymentsRepo.insertPayment({
        purpose: 'trip',
        tripId: trip.id,
        payerId: trip.passengerId,
        methodType: 'cash',
        gateway: 'none',
        amount: fare.totalFare,
        status: 'succeeded',
      }, client);
      await settleDriverEarnings(trip, fare.totalFare, client);
    }

    const receipt = await receiptsRepo.insert({
      tripId: trip.id,
      issuedTo: trip.passengerId,
      subtotal: preDiscountTotal,
      discount: fare.discountAmount,
      total: fare.totalFare,
    }, client);

    return { trip, updated, receipt };
  });

  const { trip, updated, receipt } = result;
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
    payment: {
      method: trip.paymentIntent,
      status: updated.paymentStatus,
    },
    receiptNo: receipt.receiptNo,
  };

  await notifyTripStatus(trip, { status: updated.status, completedAt: updated.completedAt, fare: response.fare });
  return response;
}

async function loadPayableTrip(passengerId, tripCode, client) {
  const trip = await tripsRepo.findByCodeForUpdate(tripCode, client);
  if (!trip || Number(trip.passengerId) !== passengerId) {
    throw new AppError(404, 'TRIP_NOT_FOUND');
  }
  if (trip.status !== 'completed') throw new AppError(409, 'BAD_TRANSITION');
  if (trip.paymentStatus !== 'unpaid') throw new AppError(409, 'ALREADY_PAID');
  if (await paymentsRepo.findActiveForTrip(trip.id, client)) {
    throw new AppError(409, 'PAYMENT_IN_PROGRESS');
  }
  return trip;
}

const GATEWAY_METHODS = ['bkash', 'nagad', 'card'];

export async function payTrip(passengerId, tripCode, { method }) {
  if (GATEWAY_METHODS.includes(method)) {
    return payTripByGateway(passengerId, tripCode, method);
  }

  const result = await withTransaction(async (client) => {
    await attributeTo(passengerId, client);
    const trip = await loadPayableTrip(passengerId, tripCode, client);

    const wallet = await walletRepo.getByUserIdForUpdate(passengerId, client);
    if (Number(wallet.balance) < Number(trip.totalFare)) {
      throw new AppError(422, 'INSUFFICIENT_FUNDS');
    }

    await paymentsRepo.insertPayment({
      purpose: 'trip',
      tripId: trip.id,
      payerId: passengerId,
      methodType: method,
      gateway: 'none',
      amount: trip.totalFare,
      status: 'succeeded',
    }, client);

    await walletRepo.insertTransaction({
      walletId: wallet.id,
      txnType: 'trip_payment',
      direction: 'debit',
      amount: trip.totalFare,
      referenceType: 'trip',
      referenceId: trip.id,
      idempotencyKey: `trip-payment-${trip.id}`,
    }, client);

    const updated = await tripsRepo.markPaid(trip.id, client);
    await settleDriverEarnings(trip, Number(trip.totalFare), client, { platformCollected: true });

    return { trip, updated };
  });

  const { trip, updated } = result;
  await notifyTripStatus(trip, { status: trip.status, paymentStatus: updated.paymentStatus });
  return { status: updated.paymentStatus, method };
}

async function payTripByGateway(passengerId, tripCode, method) {
  const result = await withTransaction(async (client) => {
    await attributeTo(passengerId, client);
    const trip = await loadPayableTrip(passengerId, tripCode, client);

    const payment = await paymentsRepo.insertPayment({
      purpose: 'trip',
      tripId: trip.id,
      payerId: passengerId,
      methodType: method,
      gateway: paymentGateway.activeGateway(),
      amount: trip.totalFare,
      status: 'initiated',
    }, client);

    return { trip, payment };
  });

  const { trip, payment } = result;
  const payer = await usersRepo.findById(passengerId);
  const session = await paymentGateway.createSession({
    tranId: payment.publicId,
    amount: Number(trip.totalFare),
    customerName: payer.fullName,
    customerEmail: payer.email ?? 'no-email@cholo.app',
    ...paymentGateway.gatewayReturnUrls(payment.publicId),
  });

  return {
    status: 'pending_redirect',
    method,
    redirectUrl: session.redirectUrl,
    payment: { publicId: payment.publicId, amount: payment.amount, status: payment.status },
  };
}

const CANCELLABLE_STATUSES = ['assigned', 'arrived'];

const PASSENGER_GRACE_PERIOD_MINUTES = 2;

function resolveParticipantRole(userId, trip) {
  if (Number(trip.passengerId) === userId) return 'passenger';
  if (Number(trip.driverId) === userId) return 'driver';
  return null;
}

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

    await ridesRepo.markCancelled(trip.requestId, client);

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
    receipt: trip.receiptNo ? { receiptNo: trip.receiptNo, issuedAt: trip.receiptIssuedAt } : null,
    myRating: trip.myRating ?? null,
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
  const result = await withTransaction(async (client) => {
    const trip = await tripsRepo.findParticipantTrip(tripCode, userId, client);
    if (!trip) throw new AppError(404, 'TRIP_NOT_FOUND');
    if (!['assigned', 'arrived', 'in_progress'].includes(trip.status)) {
      throw new AppError(409, 'TRIP_CLOSED');
    }
    const alert = await tripsRepo.insertSosAlert(trip.id, userId, location, client);
    await safetyRepo.notifyAdmins(alert, userId, client);
    const contacts = await safetyRepo.listEmergencyContacts(userId, client);
    return { alert, contacts };
  });

  logger.warn('SOS triggered — emergency contact fan-out', {
    alertId: result.alert.id,
    userId,
    contacts: result.contacts.map(({ name, phone, priority }) => ({ name, phone, priority })),
  });
  return result.alert;
}

export async function rateTrip(userId, tripCode, { score, comment }) {
  return withTransaction(async (client) => {
    const trip = await ratingsRepo.findTripForRating(tripCode, userId, client);
    if (!trip) throw new AppError(404, 'TRIP_NOT_FOUND');
    if (trip.status !== 'completed') throw new AppError(409, 'TRIP_NOT_COMPLETED');
    const raterRole = Number(trip.passengerId) === userId ? 'passenger' : 'driver';
    const rateeId = raterRole === 'passenger' ? trip.driverId : trip.passengerId;
    const rating = await ratingsRepo.insert({ tripId: trip.id, raterId: userId, rateeId, raterRole, score, comment }, client)
      .catch((error) => {
        if (error.code === '23505') throw new AppError(409, 'ALREADY_RATED');
        throw error;
      });
    await ratingsRepo.refreshAverage(rateeId, raterRole, client);
    return rating;
  });
}
