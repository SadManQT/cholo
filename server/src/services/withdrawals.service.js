import { withTransaction } from '../config/db.js';
import * as adminRepo from '../repositories/admin.repository.js';
import * as auditRepo from '../repositories/audit.repository.js';
import * as payoutAccountsRepo from '../repositories/payoutAccounts.repository.js';
import * as walletRepo from '../repositories/wallet.repository.js';
import * as withdrawalsRepo from '../repositories/withdrawals.repository.js';
import { AppError } from '../utils/AppError.js';

// No fee schedule is specified anywhere in the docs (no fee-rules table,
// no config) — 0 matches withdrawals.fee's own DB DEFAULT. Whoever adds a
// real fee structure edits this one constant, not every call site.
const WITHDRAWAL_FEE = 0;

// doc 08-09-10 §8: POST /driver/withdrawals — "amount, payoutAccountId |
// 201 requested | 422 INSUFFICIENT_BALANCE · 409 account unverified."
// Same "lock, then check, then act" shape as T3's wallet payment: the
// balance check and the debit happen inside ONE FOR UPDATE-guarded
// transaction, so two concurrent withdrawal requests against the same
// wallet can't both pass a stale balance check (walletRepo.
// getByUserIdForUpdate is the exact function T3 already proved this with).
export async function requestWithdrawal(driverId, { amount, payoutAccountId }) {
  const account = await payoutAccountsRepo.findByIdForDriver(payoutAccountId, driverId);
  // 404, not 403 — same IDOR-prevention pattern as every other ownership
  // check: a driver can't tell whether an account id that isn't theirs
  // exists at all.
  if (!account) throw new AppError(404, 'PAYOUT_ACCOUNT_NOT_FOUND');
  if (!account.isVerified) throw new AppError(409, 'PAYOUT_ACCOUNT_UNVERIFIED');

  return withTransaction(async (client) => {
    const wallet = await walletRepo.getByUserIdForUpdate(driverId, client);
    if (Number(wallet.balance) < amount) throw new AppError(422, 'INSUFFICIENT_BALANCE');

    const withdrawal = await withdrawalsRepo.insert(
      { driverId, payoutAccountId, amount, fee: WITHDRAWAL_FEE },
      client,
    );

    // The hold happens NOW, at request time, not at approval — otherwise
    // a driver could file several requests that together exceed their
    // real balance before any of them is reviewed.
    await walletRepo.insertTransaction({
      walletId: wallet.id,
      txnType: 'withdrawal',
      direction: 'debit',
      amount,
      referenceType: 'withdrawal',
      referenceId: withdrawal.id,
      idempotencyKey: `withdrawal-request-${withdrawal.id}`,
    }, client);

    // listForDriver's rows carry the joined payout-account display fields
    // (accountType/accountNoMasked) — the frontend renders both list and
    // just-created rows through the same Withdrawal shape, so this insert
    // result needs them too rather than only the bare withdrawals columns.
    return { ...withdrawal, accountType: account.accountType, accountNoMasked: account.accountNoMasked };
  });
}

export async function listWithdrawals(driverId, query) {
  const rows = await withdrawalsRepo.listForDriver(driverId, query);
  const total = rows[0]?.totalCount ?? 0;
  const data = rows.map(({ totalCount: _totalCount, ...withdrawal }) => withdrawal);

  return { data, meta: { page: query.page, limit: query.limit, total } };
}

// doc 08-09-10 §9: "admin_profiles.access_level (finance approves
// withdrawals...) — checked in services," not a stateless route
// middleware like requireRole — access_level lives in the DB, not the
// JWT. 'super' passes too: standard "top tier subsumes every narrower
// one" RBAC convention, matching the doc's own "needs ops+" phrasing for
// the (different) user-suspend action.
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

    // Reverse the hold placed at request time — a rejected withdrawal
    // never actually left the driver's wallet, so the request itself
    // must not have either.
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
