import { withTransaction } from '../config/db.js';
import * as paymentsRepo from '../repositories/payments.repository.js';
import * as tripsRepo from '../repositories/trips.repository.js';
import * as walletRepo from '../repositories/wallet.repository.js';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';
import * as paymentGateway from './paymentGateway.service.js';
import { settleDriverEarnings } from './trips.service.js';

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
    tripCode: payment.tripCode ?? null,
  };
}

export async function handleWebhook(gatewayName, body) {
  if (gatewayName !== paymentGateway.activeGateway()) {
    throw new AppError(401, 'BAD_SIGNATURE');
  }

  const valId = body?.val_id;
  if (!valId) throw new AppError(401, 'BAD_SIGNATURE');

  const verification = await paymentGateway.verifyTransaction({ valId });
  if (!verification.succeeded || !verification.tranId) {
    return { received: true, settled: false };
  }

  return withTransaction(async (client) => {
    const payment = await paymentsRepo.findByPublicIdForUpdate(verification.tranId, client);
    if (!payment) throw new AppError(401, 'BAD_SIGNATURE');

    if (payment.status === 'succeeded' || payment.status === 'refunded') {
      return { received: true, settled: false };
    }

    if (verification.amount != null && Math.abs(verification.amount - Number(payment.amount)) > 0.01) {
      throw new AppError(401, 'BAD_SIGNATURE');
    }

    await paymentsRepo.markSucceeded(payment.id, verification.gatewayTxnId, client);

    if (payment.purpose === 'trip') {
      const trip = await tripsRepo.findByIdForUpdate(payment.tripId, client);
      await tripsRepo.markPaid(trip.id, client);
      await settleDriverEarnings(trip, Number(payment.amount), client, { platformCollected: true });
    } else {
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

/**
 * Settles a successful return immediately (verified with the gateway, same as the IPN, and idempotent) so the
 * customer doesn't wait on a delayed IPN; marks failed/cancelled attempts so the customer can retry.
 */
export async function handleReturn(publicId, result, body) {
  if (result === 'success' && body?.val_id) {
    await handleWebhook(paymentGateway.activeGateway(), body).catch((error) => {
      logger.error('Payment return settlement failed; waiting for IPN', error, { publicId });
    });
  } else if (result !== 'success') {
    await paymentsRepo.markFailedIfInitiated(publicId);
  }
  return `${env.CLIENT_ORIGIN[0]}/payments/${publicId}?result=${result}`;
}
