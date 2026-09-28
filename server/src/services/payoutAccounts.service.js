import { withTransaction } from '../config/db.js';
import * as payoutAccountsRepo from '../repositories/payoutAccounts.repository.js';
import { AppError } from '../utils/AppError.js';
import { maskAccountNumber } from '../utils/mask.js';

export async function listPayoutAccounts(driverId) {
  return payoutAccountsRepo.listForDriver(driverId);
}

export async function createPayoutAccount(driverId, { accountType, accountName, accountNo, bankName }) {
  return withTransaction((client) => payoutAccountsRepo.insert({
    driverId,
    accountType,
    accountName,
    accountNo,
    accountNoMasked: maskAccountNumber(accountNo),
    bankName,
  }, client));
}

export async function removePayoutAccount(driverId, accountId) {
  const account = await payoutAccountsRepo.findByIdForDriver(accountId, driverId);
  if (!account) throw new AppError(404, 'PAYOUT_ACCOUNT_NOT_FOUND');

  const linkedWithdrawals = await payoutAccountsRepo.countWithdrawalsForAccount(accountId);
  if (linkedWithdrawals > 0) throw new AppError(409, 'PAYOUT_ACCOUNT_IN_USE');

  await withTransaction((client) => payoutAccountsRepo.remove(accountId, driverId, client));
}
