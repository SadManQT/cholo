import { HOUR, MINUTE, ipKeyGenerator, rateLimit } from 'express-rate-limit';

import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

const isTest = env.NODE_ENV === 'test';

function withoutIpv4Prefix(ip) {
  return typeof ip === 'string' && ip.startsWith('::ffff:') ? ip.slice(7) : ip;
}

export function createAllowlistSkip(allowlist) {
  const allowed = new Set(allowlist.map(withoutIpv4Prefix));
  return (request) => allowed.size > 0 && allowed.has(withoutIpv4Prefix(request.ip));
}

const skipAllowlisted = createAllowlistSkip(env.RATE_LIMIT_ALLOWLIST);

function phoneAndIpKey(request) {
  return `${ipKeyGenerator(request.ip)}:${request.body?.phone ?? 'unknown'}`;
}

function rejectWithRateLimited(_request, _response, next) {
  next(new AppError(429, 'RATE_LIMITED'));
}

export function createRateLimiter(options) {
  return rateLimit({
    standardHeaders: true,
    legacyHeaders: false,
    handler: rejectWithRateLimited,
    skip: skipAllowlisted,
    ...options,
  });
}

export const authLimiter = createRateLimiter({
  windowMs: 15 * MINUTE,
  limit: isTest ? 1000 : 100,
});

export const registerLimiter = createRateLimiter({
  windowMs: HOUR,
  limit: isTest ? 1000 : 5,
  keyGenerator: (request) => ipKeyGenerator(request.ip),
});

const phoneKey = (request) => `phone:${request.body?.phone ?? 'unknown'}`;

const perIpAndPhone = (limit) => [
  createRateLimiter({ windowMs: 15 * MINUTE, limit: isTest ? 1000 : limit, keyGenerator: phoneAndIpKey, skipSuccessfulRequests: true }),
  createRateLimiter({ windowMs: 15 * MINUTE, limit: isTest ? 1000 : limit * 3, keyGenerator: phoneKey, skipSuccessfulRequests: true }),
];

export const loginLimiter = perIpAndPhone(8);

export const verifyOtpLimiter = perIpAndPhone(8);

export const resendOtpLimiter = createRateLimiter({
  windowMs: HOUR,
  limit: isTest ? 1000 : 3,
  keyGenerator: phoneAndIpKey,
});

export const paymentMutationLimiter = createRateLimiter({
  windowMs: HOUR,
  limit: isTest ? 1000 : 20,
});

export const bookingLimiter = createRateLimiter({
  windowMs: HOUR,
  limit: isTest ? 1000 : 30,
});

export const supportMutationLimiter = createRateLimiter({
  windowMs: HOUR,
  limit: isTest ? 1000 : 20,
});

export const disputeLimiter = createRateLimiter({
  windowMs: 24 * HOUR,
  limit: isTest ? 1000 : 10,
});

export const passwordMutationLimiter = createRateLimiter({
  windowMs: HOUR,
  limit: isTest ? 1000 : 8,
});

export const adminMutationLimiter = createRateLimiter({
  windowMs: 15 * MINUTE,
  limit: isTest ? 1000 : 100,
});

export const geoSearchLimiter = createRateLimiter({
  windowMs: MINUTE,
  limit: isTest ? 1000 : 30,
});

export const shareViewLimiter = createRateLimiter({
  windowMs: MINUTE,
  limit: isTest ? 1000 : 60,
});
