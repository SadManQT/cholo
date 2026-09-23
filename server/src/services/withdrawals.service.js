import { withTransaction } from '../config/db.js';
import * as adminRepo from '../repositories/admin.repository.js';
import * as auditRepo from '../repositories/audit.repository.js';
import * as payoutAccountsRepo from '../repositories/payoutAccounts.repository.js';
import * as walletRepo from '../repositories/wallet.repository.js';
import * as withdrawalsRepo from '../repositories/withdrawals.repository.js';
import { AppError } from '../utils/AppError.js';

const WITHDRAWAL_FEE = 0;

export async function requestWithdrawal(driverId, { amount, payoutAccountId }) {
  const account = await payoutAccountsRepo.findByIdForDriver(payoutAccountId, driverId);
  if (!account) throw new AppError(404, 'PAYOUT_ACCOUNT_NOT_FOUND');
  if (!account.isVerified) throw new AppError(409, 'PAYOUT_ACCOUNT_UNVERIFIED');

  return withTransaction(async (client) => {
    const wallet = await walletRepo.getByUserIdForUpdate(driverId, client);
    if (Number(wallet.balance) < amount) throw new AppError(422, 'INSUFFICIENT_BALANCE');

    const withdrawal = await withdrawalsRepo.insert(
      { driverId, payoutAccountId, amount, fee: WITHDRAWAL_FEE },
      client,
    );

    await walletRepo.insertTransaction({
      walletId: wallet.id,
      txnType: 'withdrawal',
      direction: 'debit',
      amount,
      referenceType: 'withdrawal',
      referenceId: withdrawal.id,
      idempotencyKey: `withdrawal-request-${withdrawal.id}`,
    }, client);

    return { ...withdrawal, accountType: account.accountType, accountNoMasked: account.accountNoMasked };
  });
}

export async function listWithdrawals(driverId, query) {
  const rows = await withdrawalsRepo.listForDriver(driverId, query);
  const total = rows[0]?.totalCount ?? 0;
  const data = rows.map(({ totalCount: _totalCount, ...withdrawal }) => withdrawal);

  return { data, meta: { page: query.page, limit: query.limit, total } };
}

async function requireFinanceLevel(adminId) {
  const level = await adminRepo.getAccessLevel(adminId);
  if (level !== 'finance' && level !== 'super') {
    throw new AppError(403, 'FORBIDDEN_ACCESS_LEVEL');
  }
}

export async function listQueue(query) {
  const rows = await withdrawalsRepo.listQueue(query);
  const total = rows[0]?.totalCount ?? 0;
  const data = rows.map(({ totalCount: _totalCount, ...withdrawal }) => withdrawal);

  return { data, meta: { page: query.page, limit: query.limit, total } };
}

export async function approveWithdrawal(adminId, withdrawalId, ipAddress) {
  await requireFinanceLevel(adminId);

  return withTransaction(async (client) => {
    const withdrawal = await withdrawalsRepo.findByIdForUpdate(withdrawalId, client);
    if (!withdrawal) throw new AppError(404, 'WITHDRAWAL_NOT_FOUND');
    if (withdrawal.status !== 'requested') throw new AppError(409, 'WITHDRAWAL_ALREADY_REVIEWED');

    const updated = await withdrawalsRepo.markApproved(withdrawalId, adminId, client);
    await auditRepo.insert({
      actorId: adminId,
      actorRole: 'ADMIN',
      ipAddress,
      action: 'WITHDRAWAL_APPROVED',
      entityType: 'withdrawals',
      entityId: withdrawalId,
      oldValue: { status: withdrawal.status },
      newValue: { status: 'approved' },
    }, client);

    return updated;
  });
}

export async function rejectWithdrawal(adminId, withdrawalId, reason, ipAddress) {
  await requireFinanceLevel(adminId);

  return withTransaction(async (client) => {
    const withdrawal = await withdrawalsRepo.findByIdForUpdate(withdrawalId, client);
    if (!withdrawal) throw new AppError(404, 'WITHDRAWAL_NOT_FOUND');
    if (withdrawal.status !== 'requested') throw new AppError(409, 'WITHDRAWAL_ALREADY_REVIEWED');

    const updated = await withdrawalsRepo.markRejected(withdrawalId, adminId, reason, client);

    const wallet = await walletRepo.getByUserId(withdrawal.driverId, client);
    await walletRepo.insertTransaction({
      walletId: wallet.id,
      txnType: 'adjustment',
      direction: 'credit',
      amount: withdrawal.amount,
      referenceType: 'withdrawal',
      referenceId: withdrawal.id,
      idempotencyKey: `withdrawal-reject-${withdrawal.id}`,
      note: 'Withdrawal rejected — hold reversed',
    }, client);

    await auditRepo.insert({
      actorId: adminId,
      actorRole: 'ADMIN',
      ipAddress,
      action: 'WITHDRAWAL_REJECTED',
      entityType: 'withdrawals',
      entityId: withdrawalId,
      oldValue: { status: withdrawal.status },
      newValue: { status: 'rejected', reason },
    }, client);

    return updated;
  });
}
