import { withTransaction } from '../config/db.js';
import * as paymentsRepo from '../repositories/payments.repository.js';
import * as tripsRepo from '../repositories/trips.repository.js';
import * as walletRepo from '../repositories/wallet.repository.js';
import { AppError } from '../utils/AppError.js';
import * as paymentGateway from './paymentGateway.service.js';
import { settleDriverEarnings } from './trips.service.js';

// doc 09 §7: GET /payments/:publicId — "Attempt status (poll after
// gateway redirect)." payer-scoped, same 404-not-403 IDOR shape as every
// other ownership check in this codebase.
export async function getPayment(userId, publicId) {
  const payment = await paymentsRepo.findByPublicId(publicId);
  if (!payment || Number(payment.payerId) !== userId) {
    throw new AppError(404, 'PAYMENT_NOT_FOUND');
  }

  return {
    publicId: payment.publicId,
    purpose: payment.purpose,
    methodType: payment.methodType,
    amount: payment.amount,
    status: payment.status,
    completedAt: payment.completedAt,
  };
}

// doc 08-09-10 §10.4's gateway webhook — verified live against
// SSLCommerz's real sandbox for both halves: Session API (createSession)
// and Validation API (verifyTransaction). Two rules make it safe:
//
// 1. VERIFY, don't trust the POSTed body. body.val_id is only a claim —
//    verifyTransaction() asks SSLCommerz's OWN server directly whether a
//    transaction with that val_id really succeeded, which a forged
//    webhook POST cannot fake (it would need SSLCommerz's server to lie
//    on its own validation endpoint).
// 2. IDEMPOTENT — "the same webhook delivered twice must not double-
//    process the payment." Three layers, same belt-and-suspenders shape
//    as T1/T2/T3:
//      a. findByPublicIdForUpdate LOCKS the one payment row named by
//         tran_id before deciding anything — a second delivery arriving
//         at the same instant genuinely blocks here until the first
//         transaction commits or rolls back.
//      b. Once unblocked, it re-reads status — already 'succeeded'?
//         Return immediately, no-op. This is the fast path doc 08-09-10
//         §10.4 describes ("already succeeded? return 200").
//      c. Even if both those failed somehow, payments.gateway_txn_id
//         UNIQUE and driver_earnings.trip_id UNIQUE (and wallet_
//         transactions.idempotency_key UNIQUE for the topup credit) make
//         a genuine double-write physically impossible, not just
//         unlikely — the same "belt AND suspenders" doc 02-03 §8 uses
//         for T1's accept race.
export async function handleWebhook(gatewayName, body) {
  // The route names which gateway sent this — if it doesn't match the
  // one actually configured, there's nothing to verify it against.
  if (gatewayName !== paymentGateway.activeGateway()) {
    throw new AppError(401, 'BAD_SIGNATURE');
  }

  const valId = body?.val_id;
  if (!valId) throw new AppError(401, 'BAD_SIGNATURE');

  const verification = await paymentGateway.verifyTransaction({ valId });
  if (!verification.succeeded || !verification.tranId) {
    // A legitimate FAILED/CANCELLED IPN, or an unrecognized val_id —
    // either way, SSLCommerz's own server says there's nothing to
    // settle. Not an error: still 200, just settled: false.
    return { received: true, settled: false };
  }

  return withTransaction(async (client) => {
    const payment = await paymentsRepo.findByPublicIdForUpdate(verification.tranId, client);
    if (!payment) throw new AppError(401, 'BAD_SIGNATURE'); // tran_id we never issued

    if (payment.status === 'succeeded') {
      return { received: true, settled: false }; // idempotent no-op
    }

    // The verified amount must match what THIS payment actually asked
    // for — a mismatch means the val_id doesn't really belong to this
    // tran_id's transaction, verified server or not.
    if (verification.amount != null && Math.abs(verification.amount - Number(payment.amount)) > 0.01) {
      throw new AppError(401, 'BAD_SIGNATURE');
    }

    await paymentsRepo.markSucceeded(payment.id, verification.gatewayTxnId, client);

    if (payment.purpose === 'trip') {
      const trip = await tripsRepo.findByIdForUpdate(payment.tripId, client);
      await tripsRepo.markPaid(trip.id, client);
      // Same earnings split as T2's cash settlement and T3's wallet
      // payment — every paid trip gets one, regardless of method. The
      // gateway holds the fare on the platform's behalf here too, so
      // this credits the driver's net share (same as wallet payment),
      // not a commission debit (that's cash-only).
      await settleDriverEarnings(trip, Number(payment.amount), client, { platformCollected: true });
    } else {
      // purpose === 'wallet_topup' — credit the payer's own wallet.
      const wallet = await walletRepo.getByUserId(payment.payerId, client);
      await walletRepo.insertTransaction({
        walletId: wallet.id,
        txnType: 'topup',
        direction: 'credit',
        amount: payment.amount,
        referenceType: 'payment',
        referenceId: payment.id,
        idempotencyKey: `topup-payment-${payment.id}`,
      }, client);
    }

    return { received: true, settled: true };
  });
}
