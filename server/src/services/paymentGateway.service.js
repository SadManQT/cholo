import { env } from '../config/env.js';
import * as sslcommerzProvider from './providers/sslcommerz.provider.js';

const providers = {
  sslcommerz: sslcommerzProvider,
};

function currentProvider() {
  const provider = providers[env.PAYMENT_GATEWAY];

  if (!provider) {
    throw new Error(`PAYMENT_GATEWAY "${env.PAYMENT_GATEWAY}" has no adapter implementation`);
  }

  return provider;
}

export function activeGateway() {
  return env.PAYMENT_GATEWAY;
}

export function createSession(params) {
  return currentProvider().createSession(params);
}

export function verifyTransaction(params) {
  return currentProvider().verifyTransaction(params);
}

/** Where the gateway sends the customer's browser back to (GET or POST, depending on the gateway). */
export function gatewayReturnUrls(publicId) {
  const base = `${env.PUBLIC_API_ORIGIN}/api/v1/payments/${publicId}/return`;
  return {
    successUrl: `${base}?result=success`,
    failUrl: `${base}?result=fail`,
    cancelUrl: `${base}?result=cancel`,
    ipnUrl: `${env.PUBLIC_API_ORIGIN}/api/v1/webhooks/payments/${activeGateway()}`,
  };
}
