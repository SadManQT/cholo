import * as payoutAccountsRepo from '../repositories/payoutAccounts.repository.js';
import { AppError } from '../utils/AppError.js';
import { maskAccountNumber } from '../utils/mask.js';

export async function listPayoutAccounts(driverId) {
  return payoutAccountsRepo.listForDriver(driverId);
}

export async function createPayoutAccount(driverId, { accountType, accountName, accountNo, bankName }) {
  return payoutAccountsRepo.insert({
    driverId,
    accountType,
    accountName,
    accountNoMasked: maskAccountNumber(accountNo),
    bankName,
  });
}

export async function removePayoutAccount(driverId, accountId) {
  const account = await payoutAccountsRepo.findByIdForDriver(accountId, driverId);
  // 404, not 403 — same IDOR-prevention pattern as every other ownership
  // check in this codebase.
  if (!account) throw new AppError(404, 'PAYOUT_ACCOUNT_NOT_FOUND');

  // withdrawals.payout_account_id is ON DELETE RESTRICT regardless of the
  // withdrawal's status (even a long-settled 'paid' one keeps the FK) —
  // this check matches that reality rather than the narrower "pending
  // withdrawal" wording in doc 08-09-10 §8, which would still hit the
  // DB's own RESTRICT and surface a confusing generic error.
  const linkedWithdrawals = await payoutAccountsRepo.countWithdrawalsForAccount(accountId);
  if (linkedWithdrawals > 0) throw new AppError(409, 'PAYOUT_ACCOUNT_IN_USE');

  await payoutAccountsRepo.remove(accountId, driverId);
}
