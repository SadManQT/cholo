import { env } from '../config/env.js';
import * as paymentsRepo from '../repositories/payments.repository.js';
import * as usersRepo from '../repositories/users.repository.js';
import * as walletRepo from '../repositories/wallet.repository.js';
import { AppError } from '../utils/AppError.js';
import * as paymentGateway from './paymentGateway.service.js';

// wallets is 1:1 with users (fn_create_user_wallet, schema.sql) — a miss
// here means the trigger never ran, which should be impossible for any
// authenticated user; 404 rather than a silent default is the honest
// response to state that should never happen.
async function requireWallet(userId) {
  const wallet = await walletRepo.getByUserId(userId);
  if (!wallet) throw new AppError(404, 'NOT_FOUND');
  return wallet;
}

export async function getWallet(userId) {
  const wallet = await requireWallet(userId);
  return { balance: wallet.balance, currency: wallet.currency, status: wallet.status };
}

export async function listTransactions(userId, query) {
  const wallet = await requireWallet(userId);
  const rows = await walletRepo.listTransactions(wallet.id, query);
  const total = rows[0]?.totalCount ?? 0;
  const data = rows.map(({ totalCount: _totalCount, ...txn }) => txn);

  return {
    data,
    meta: { page: query.page, limit: query.limit, total },
  };
}

// doc 08-09-10 §7: POST /wallet/topup — "amount, method → gateway
// session." Unlike a trip payment there's no trip to guard against
// double-paying; the only work here is starting the session. Settlement
// (the wallet credit) happens later, entirely in the webhook — a topup
// payment row is 'initiated' until SSLCommerz confirms it, same as a
// gateway trip payment (trips.service.js's payTripByGateway).
export async function initiateTopup(userId, { amount, method }) {
  await requireWallet(userId); // same "should be impossible to miss" guard as getWallet

  const payment = await paymentsRepo.insertPayment({
    purpose: 'wallet_topup',
    tripId: null,
    payerId: userId,
    methodType: method,
    gateway: paymentGateway.activeGateway(),
    amount,
    status: 'initiated',
  });

  const payer = await usersRepo.findById(userId);
  const session = await paymentGateway.createSession({
    tranId: payment.publicId,
    amount,
    customerName: payer.fullName,
    customerEmail: payer.email ?? 'no-email@cholo.app',
    successUrl: `${env.CLIENT_ORIGIN}/payments/${payment.publicId}?result=success`,
    failUrl: `${env.CLIENT_ORIGIN}/payments/${payment.publicId}?result=fail`,
    cancelUrl: `${env.CLIENT_ORIGIN}/payments/${payment.publicId}?result=cancel`,
    ipnUrl: `${env.PUBLIC_API_ORIGIN}/api/v1/webhooks/payments/${paymentGateway.activeGateway()}`,
  });

  return {
    payment: { publicId: payment.publicId, amount: payment.amount, status: payment.status },
    redirectUrl: session.redirectUrl,
  };
}
