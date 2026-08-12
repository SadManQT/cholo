import { env } from '../config/env.js';
import * as sslcommerzProvider from './providers/sslcommerz.provider.js';

// The same adapter shape as geo.service.js (doc 05-06-07 §8: one
// interface, providers behind it): switching PAYMENT_GATEWAY=sslcommerz|
// bkash in env is meant to change zero business code — every caller in
// this codebase imports THIS file, never a provider module directly.
const providers = {
  sslcommerz: sslcommerzProvider,
  // bkash/nagad: not implemented — bKash's own developer portal has new
  // signups disabled at the time of writing, so there's no sandbox to
  // build and verify this against yet; SSLCommerz's is instantly self-
  // serve (published universal test credentials, no signup at all).
};

function currentProvider() {
  const provider = providers[env.PAYMENT_GATEWAY];

  if (!provider) {
    throw new Error(`PAYMENT_GATEWAY "${env.PAYMENT_GATEWAY}" has no adapter implementation`);
  }

  return provider;
}

// The webhook route is named by gateway (/webhooks/payments/:gateway) —
// this lets the controller confirm the path actually matches the
// currently active provider before trusting anything in the body.
export function activeGateway() {
  return env.PAYMENT_GATEWAY;
}

export function createSession(params) {
  return currentProvider().createSession(params);
}

export function verifyTransaction(params) {
  return currentProvider().verifyTransaction(params);
}
