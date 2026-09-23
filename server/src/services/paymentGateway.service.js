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
