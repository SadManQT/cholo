import { env } from '../../config/env.js';
import { AppError } from '../../utils/AppError.js';

// SSLCommerz's real v4 API (verified live against the sandbox — every
// field name here matches an actual request/response, not guessed from
// docs alone). Two calls: Session API to START a payment (redirect the
// customer), Validation API to CONFIRM one really happened — the second
// is what "verify the signature" (doc 08-09-10 §10.4) means for this
// gateway: instead of reproducing a hash locally, ask SSLCommerz's own
// server directly, which can't be spoofed by a forged webhook body.
const SESSION_URL = `${env.SSLCOMMERZ_BASE_URL}/gwprocess/v4/api.php`;
const VALIDATION_URL = `${env.SSLCOMMERZ_BASE_URL}/validator/api/validationserverAPI.php`;

async function fetchJson(url, options) {
  let response;
  try {
    response = await fetch(url, options);
  } catch {
    throw new AppError(503, 'GATEWAY_UNAVAILABLE');
  }
  if (!response.ok) throw new AppError(503, 'GATEWAY_UNAVAILABLE');
  return response.json();
}

// createSession() — doc 09 §7's "amount, method → gateway session" for
// both /wallet/topup and /trips/:code/pay. tranId is always OUR payment's
// public_id, never a fresh gateway-side id — that's what lets the later
// webhook correlate `tran_id` straight back to one payments row (doc
// 08-09-10 §10.4's `merchantInvoice` matching by public_id).
export async function createSession({
  tranId, amount, customerName, customerEmail, successUrl, failUrl, cancelUrl, ipnUrl,
}) {
  const body = new URLSearchParams({
    store_id: env.SSLCOMMERZ_STORE_ID,
    store_passwd: env.SSLCOMMERZ_STORE_PASSWORD,
    total_amount: amount.toFixed(2),
    currency: 'BDT',
    tran_id: tranId,
    success_url: successUrl,
    fail_url: failUrl,
    cancel_url: cancelUrl,
    ipn_url: ipnUrl,
    cus_name: customerName,
    cus_email: customerEmail,
    // SSLCommerz's Session API rejects the request outright without a
    // full customer/shipping block — none of this is meaningful for a
    // ride payment, so it's the same fixed filler every call, not
    // per-user data worth threading through from the caller.
    cus_add1: 'Dhaka',
    cus_city: 'Dhaka',
    cus_country: 'Bangladesh',
    cus_phone: '01700000000',
    shipping_method: 'NO',
    product_name: 'Cholo ride payment',
    product_category: 'Transport',
    product_profile: 'general',
  });

  const data = await fetchJson(SESSION_URL, { method: 'POST', body });
  if (data.status !== 'SUCCESS') throw new AppError(502, 'GATEWAY_SESSION_FAILED');

  return { redirectUrl: data.GatewayPageURL, sessionKey: data.sessionkey };
}

// verifyTransaction() — the Validation API, called with the val_id the
// IPN claims. 'VALID' and 'VALIDATED' are SSLCommerz's own two accepted
// success statuses (VALIDATED means it's been checked more than once);
// anything else (including their own 'INVALID_TRANSACTION' for an
// unrecognized val_id) is not a real, confirmed payment.
export async function verifyTransaction({ valId }) {
  const url = `${VALIDATION_URL}?${new URLSearchParams({
    val_id: valId,
    store_id: env.SSLCOMMERZ_STORE_ID,
    store_passwd: env.SSLCOMMERZ_STORE_PASSWORD,
    format: 'json',
  })}`;

  const data = await fetchJson(url, { method: 'GET' });

  return {
    tranId: data.tran_id || null,
    succeeded: data.status === 'VALID' || data.status === 'VALIDATED',
    amount: data.amount ? Number(data.amount) : null,
    gatewayTxnId: data.bank_tran_id || null,
  };
}
