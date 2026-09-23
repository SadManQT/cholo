import { env } from '../../config/env.js';
import { AppError } from '../../utils/AppError.js';

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
