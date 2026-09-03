import { withTransaction } from '../config/db.js';
import { env } from '../config/env.js';
import * as driversRepo from '../repositories/drivers.repository.js';
import * as earningsRepo from '../repositories/earnings.repository.js';
import * as paymentsRepo from '../repositories/payments.repository.js';
import * as pricingRepo from '../repositories/pricing.repository.js';
import * as promosRepo from '../repositories/promos.repository.js';
import * as receiptsRepo from '../repositories/receipts.repository.js';
import * as ridesRepo from '../repositories/rides.repository.js';
import * as safetyRepo from '../repositories/safety.repository.js';
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

// doc 02-03 §8 T2's earning-row step, generalized: every completed AND
// PAID trip gets a driver_earnings split, regardless of which payment
// method actually settled it (cash here, wallet/gateway in payTrip below
// and payments.service.js's webhook handler). The wallet side of it
// depends on WHO is physically holding the fare right now, which is not
// the same for every method — collecting that wrong would either short
// the driver or double-pay them:
//
//   - cash: the driver already has the full fare in hand. The platform's
//     only claim is its commission cut, so this DEBITS the driver's
//     wallet by commissionAmount — a running "you owe the platform"
//     balance, which is what T2's own worked example describes.
//   - wallet/gateway ('platformCollected'): the PLATFORM holds the full
//     fare (the passenger paid it directly, not the driver). The
//     platform owes the driver their share, so this CREDITS the driver's
//     wallet by netEarning instead — debiting the commission on top of
//     that would be double-counting (net_earning is already gross minus
//     commission), and crediting net_earning AND leaving commission
//     untouched already correctly reflects the platform keeping its cut.
//
// Exported so trip completion, T3's wallet payment, and the gateway
// webhook all share this ONE implementation rather than three
// independent (and easy to accidentally mismatch) copies of this math.
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
  // Same identity every retry of THIS trip's settlement would produce —
  // the caller's own guard (a status transition check, or the payment
  // idempotency check in payments.service.js) already stops this from
  // running twice, but the UNIQUE idempotency_key is the unbypassable
  // last line, same belt-and-suspenders pattern as T1's request_id UNIQUE
  // (doc 02-03 §8). driver_earnings.trip_id UNIQUE backs it up a second way.
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

// promo_codes.usage_limit_total/usage_limit_per_user/first_ride_only are
// enforced HERE, not at booking (rides.service.js's createRequest comment
// comment) — this is the "redeemed as" moment (doc 01 relationship #58),
// as opposed to booking's looser "reserved on" (#37). A promo that stopped
// qualifying between booking and completion (expired, used up by someone
// else in the meantime, or no longer this passenger's first ride) is NOT
// an error here: completeTrip is a DRIVER-facing endpoint, the driver has
// no way to fix a passenger's promo eligibility, and the ride already
// happened — falling back to no discount is the only reasonable outcome,
// not a 422 that blocks a real trip over a promo edge case. FOR UPDATE
// locks the promo row so two trips completing at the same instant against
// a usage_limit_total-capped promo can't both read a stale count and both
// squeeze past the limit.
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

    // computeFare always returns discountAmount 0 (fareMath.js has no
    // promo knowledge) — preDiscountTotal is captured before redemption
    // mutates fare, so the receipt below can record the true pre-discount
    // subtotal without re-deriving it from a total+discount addition.
    const preDiscountTotal = fare.totalFare;
    const redemption = await redeemPromoIfApplicable(trip, preDiscountTotal, client);
    if (redemption) {
      fare.discountAmount = redemption.discountAmount;
      fare.totalFare = round2(preDiscountTotal - redemption.discountAmount);
    }

    // Cash settles instantly, in this same transaction. Every other
    // method needs its own separate payment flow: wallet settles via its
    // own later /pay call (payTrip below, T3), gateways via a redirect +
    // webhook (not built) — so those trips complete honestly 'unpaid'
    // rather than faking a gateway state (doc 08-09-10 §10.3's
    // "pending_redirect" is what that flow will report once it exists).
    const isCash = trip.paymentIntent === 'cash';

    const updated = await tripsRepo.completeTrip(trip.id, {
      actualDistanceKm: distanceKm,
      actualDurationMin: durationMin,
      fare,
      paymentStatus: isCash ? 'paid' : 'unpaid',
    }, client);

    // Redeem AFTER the trip row itself is written — promo_redemptions.
    // trip_id is NOT NULL (schema.sql), so the row it references must
    // already exist.
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

    // receipts — doc 01: "passenger-facing numbered financial document,"
    // one per completed trip regardless of payment method or status (it
    // documents what the passenger owes, not whether they've paid it yet
    // — wallet/gateway trips complete 'unpaid' and still get a receipt).
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

// T3 (doc 02-03 §8): "debit the passenger wallet + mark the payment
// succeeded, atomically; the FOR UPDATE inside fn_apply_wallet_txn
// prevents two simultaneous spends from both passing a balance check."
// That protection only holds if the balance CHECK participates in the
// same lock the debit's INSERT takes — walletRepo.getByUserIdForUpdate's
// SELECT ... FOR UPDATE is what makes that true here: a second concurrent
// /pay (on a DIFFERENT trip, same wallet) genuinely blocks on this SELECT
// until the first transaction commits, then reads the POST-debit balance,
// never a stale one both could pass.
// Shared by payTrip's wallet branch and gateway branch: both need the
// SAME trip lookup + ownership + status guards before doing their very
// different settlement work.
async function loadPayableTrip(passengerId, tripCode, client) {
  const trip = await tripsRepo.findByCodeForUpdate(tripCode, client);
  // 404, not 403 — same IDOR-prevention pattern as every other trip
  // transition: a caller who isn't the passenger on this trip can't
  // tell it exists, not even to learn it needs paying.
  if (!trip || Number(trip.passengerId) !== passengerId) {
    throw new AppError(404, 'TRIP_NOT_FOUND');
  }
  // Only a completed trip has a final total_fare to pay — the fare
  // columns are all still 0 (their DEFAULT) before completeTrip runs.
  if (trip.status !== 'completed') throw new AppError(409, 'BAD_TRANSITION');
  if (trip.paymentStatus !== 'unpaid') throw new AppError(409, 'ALREADY_PAID');
  // trip.paymentStatus only moves off 'unpaid' once a gateway webhook
  // actually confirms money moved, so without this a double-click, client
  // retry, or a reopened checkout tab sails through the check above and
  // opens a SECOND SSLCommerz session for the same fare. If the passenger
  // completes both, only the first webhook can ever mark a payment
  // 'succeeded' (ux_payment_one_success) — the second is a real charge
  // with no way left to record it as settled.
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

  // wallet (T3, doc 02-03 §8): "debit the passenger wallet + mark the
  // payment succeeded, atomically; the FOR UPDATE inside
  // fn_apply_wallet_txn prevents two simultaneous spends from both
  // passing a balance check." That protection only holds if the balance
  // CHECK participates in the same lock the debit's INSERT takes —
  // walletRepo.getByUserIdForUpdate's SELECT ... FOR UPDATE is what makes
  // that true here: a second concurrent /pay (on a DIFFERENT trip, same
  // wallet) genuinely blocks on this SELECT until the first transaction
  // commits, then reads the POST-debit balance, never a stale one both
  // could pass.
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
      // Same belt-and-suspenders shape as T2's commission idempotency key
      // and payments' own ux_payment_one_success UNIQUE INDEX — a second
      // debit for the SAME trip is structurally impossible, not just
      // lock-prevented.
      idempotencyKey: `trip-payment-${trip.id}`,
    }, client);

    const updated = await tripsRepo.markPaid(trip.id, client);
    // The platform now holds this fare (unlike cash, where the driver
    // already does) — every paid trip gets a driver_earnings row, but
    // platformCollected: true credits the driver their net share instead
    // of debiting a commission that was never physically theirs to owe.
    await settleDriverEarnings(trip, Number(trip.totalFare), client, { platformCollected: true });

    return { trip, updated };
  });

  const { trip, updated } = result;
  await notifyTripStatus(trip, { status: trip.status, paymentStatus: updated.paymentStatus });
  return { status: updated.paymentStatus, method };
}

// Gateway methods (bkash/nagad/card, routed through whichever provider
// paymentGateway.service.js currently has active) can't settle inline —
// doc 08-09-10 §10.3's "pending_redirect" is the honest state between
// starting a gateway session and its webhook confirming money actually
// moved. This only ever creates an 'initiated' payment row; success
// happens later in payments.service.js's webhook handler.
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
    successUrl: `${env.CLIENT_ORIGIN}/payments/${payment.publicId}?result=success`,
    failUrl: `${env.CLIENT_ORIGIN}/payments/${payment.publicId}?result=fail`,
    cancelUrl: `${env.CLIENT_ORIGIN}/payments/${payment.publicId}?result=cancel`,
    ipnUrl: `${env.PUBLIC_API_ORIGIN}/api/v1/webhooks/payments/${paymentGateway.activeGateway()}`,
  });

  return {
    status: 'pending_redirect',
    method,
    redirectUrl: session.redirectUrl,
    // Same shape as wallet.service.js's initiateTopup response — the
    // frontend needs this publicId to poll GET /payments/:publicId after
    // the gateway redirect lands back on success/fail/cancel_url.
    payment: { publicId: payment.publicId, amount: payment.amount, status: payment.status },
  };
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
    // doc 08-09-10 §6: GET /trips/:publicId's documented shape is "parties,
    // vehicle, fare breakdown, receipt link" — null until completeTrip has
    // run (receipts.trip_id only exists for completed trips).
    receipt: trip.receiptNo ? { receiptNo: trip.receiptNo, issuedAt: trip.receiptIssuedAt } : null,
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

  // SMS fan-out is a documented v1 scope-cut: log the explicit targets so
  // the demo proves who would be contacted without pretending a provider
  // integration exists. The safety row and admin notification are real.
  logger.warn('SOS triggered — emergency contact fan-out', {
    alertId: result.alert.id,
    userId,
    contacts: result.contacts.map(({ name, phone, priority }) => ({ name, phone, priority })),
  });
  return result.alert;
}
