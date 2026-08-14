import { withTransaction } from '../config/db.js';
import * as adminRepo from '../repositories/admin.repository.js';
import * as auditRepo from '../repositories/audit.repository.js';
import * as disputesRepo from '../repositories/disputes.repository.js';
import * as walletRepo from '../repositories/wallet.repository.js';
import { AppError } from '../utils/AppError.js';

function paginate(rows, query) {
  const total = rows[0]?.totalCount ?? 0;
  return { data: rows.map(({ totalCount: _totalCount, ...row }) => row), meta: { ...query, total } };
}

export async function createDispute(userId, input) {
  const trip = await disputesRepo.findParticipantTrip(input.tripPublicId, userId);
  if (!trip) throw new AppError(404, 'TRIP_NOT_FOUND');
  if (trip.status !== 'completed') throw new AppError(409, 'BAD_TRANSITION');
  if (input.disputedAmount != null && input.disputedAmount > Number(trip.totalFare)) {
    throw new AppError(422, 'DISPUTED_AMOUNT_TOO_HIGH');
  }
  if (await disputesRepo.hasOpenDispute(trip.id, userId)) {
    throw new AppError(409, 'DUPLICATE_OPEN_DISPUTE');
  }
  return disputesRepo.insert({
    tripId: trip.id,
    raisedBy: userId,
    disputeType: input.disputeType,
    description: input.description,
    disputedAmount: input.disputedAmount,
  });
}

export async function listMine(userId, query) {
  return paginate(await disputesRepo.listForUser(userId, query), query);
}

export async function listQueue(query) {
  return paginate(await disputesRepo.listQueue(query), query);
}

async function requireResolutionLevel(adminId, wantsRefund, client) {
  const level = await adminRepo.getAccessLevel(adminId, client);
  const allowed = wantsRefund ? ['super', 'finance'] : ['super', 'ops', 'support'];
  if (!allowed.includes(level)) throw new AppError(403, 'FORBIDDEN_ACCESS_LEVEL');
}

export async function resolveDispute(adminId, disputeId, input, ipAddress) {
  return withTransaction(async (client) => {
    const wantsRefund = input.status === 'resolved_refunded';
    await requireResolutionLevel(adminId, wantsRefund, client);
    const dispute = await disputesRepo.findForUpdate(disputeId, client);
    if (!dispute) throw new AppError(404, 'DISPUTE_NOT_FOUND');
    if (!['open', 'under_review'].includes(dispute.status)) throw new AppError(409, 'DISPUTE_CLOSED');

    let refundPaymentId = null;
    if (wantsRefund) {
      const payment = await disputesRepo.findSucceededPaymentForTrip(dispute.tripId, client);
      if (!payment) throw new AppError(409, 'PAYMENT_NOT_REFUNDABLE');
      if (input.refundAmount > Number(payment.amount)) throw new AppError(422, 'REFUND_AMOUNT_TOO_HIGH');

      const wallet = await walletRepo.getByUserId(dispute.passengerId, client);
      await walletRepo.insertTransaction({
        walletId: wallet.id,
        txnType: 'refund',
        direction: 'credit',
        amount: input.refundAmount,
        referenceType: 'payment',
        referenceId: payment.id,
        idempotencyKey: `dispute-refund-${dispute.id}`,
        note: `Refund for ${dispute.disputeNo}`,
      }, client);
      await disputesRepo.markPaymentRefunded(payment.id, input.refundAmount, client);
      await disputesRepo.markTripRefunded(dispute.tripId, client);
      refundPaymentId = payment.id;
    }

    const resolved = await disputesRepo.resolve(disputeId, {
      ...input, adminId, refundPaymentId,
    }, client);
    await auditRepo.insert({
      actorId: adminId, actorRole: 'ADMIN', ipAddress,
      action: 'DISPUTE_RESOLVED', entityType: 'disputes', entityId: disputeId,
      oldValue: { status: dispute.status },
      newValue: { status: input.status, resolutionNote: input.resolutionNote, refundAmount: input.refundAmount ?? null },
    }, client);
    return resolved;
  });
}
