import { HOUR, MINUTE, ipKeyGenerator, rateLimit } from 'express-rate-limit';

import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

// The whole suite exercises these same routes from one test-client IP —
// production thresholds would make the suite trip its own rate limits.
// NODE_ENV=test (set via tests/setup.js, doc 08 §10) relaxes them instead
// of disabling the middleware, so the wiring itself still runs in tests.
const isTest = env.NODE_ENV === 'test';

function phoneAndIpKey(request) {
  return `${ipKeyGenerator(request.ip)}:${request.body?.phone ?? 'unknown'}`;
}

// Delegate 429s to the central errorHandler instead of express-rate-limit's
// own response, so the error envelope matches every other endpoint (doc 09 §1).
function rejectWithRateLimited(_request, _response, next) {
  next(new AppError(429, 'RATE_LIMITED'));
}

export function createRateLimiter(options) {
  return rateLimit({
    standardHeaders: true,
    legacyHeaders: false,
    handler: rejectWithRateLimited,
    ...options,
  });
}

// Coarse safety net across every /auth/* route — generic abuse/DoS, not
// tuned to any one endpoint's specific risk.
export const authLimiter = createRateLimiter({
  windowMs: 15 * MINUTE,
  limit: isTest ? 1000 : 100,
});

// Registering sends a real SMS (doc 10 §5) — keyed by IP only, since each
// registration necessarily uses a fresh, unique phone (doc 09: 409 DUPLICATE
// otherwise), so a phone-keyed limit here would never actually engage
// against the threat it exists for: one IP spamming many different numbers.
export const registerLimiter = createRateLimiter({
  windowMs: HOUR,
  limit: isTest ? 1000 : 5,
  keyGenerator: (request) => ipKeyGenerator(request.ip),
});

// Login has no per-record attempt cap the way OTPs do (doc 10 §11: brute
// force → bcrypt cost + rate limit per phone+IP). Keyed by phone+IP so one
// attacker can't lock out a victim's IP-mates, and only failed attempts
// count — a legitimate user logging in nine times shouldn't get throttled
// for it.
export const loginLimiter = createRateLimiter({
  windowMs: 15 * MINUTE,
  limit: isTest ? 1000 : 8,
  keyGenerator: phoneAndIpKey,
  skipSuccessfulRequests: true,
});

// Defense in depth alongside the per-OTP-record 5-attempt cap already
// enforced in auth.service.js (doc 10 §5) — that cap is the real guessing
// defense; this just stops one IP from hammering the endpoint itself.
export const verifyOtpLimiter = createRateLimiter({
  windowMs: 15 * MINUTE,
  limit: isTest ? 1000 : 8,
  keyGenerator: phoneAndIpKey,
  skipSuccessfulRequests: true,
});

// Resending sends another real SMS (doc 09 §4: "429 RATE_LIMITED — SMS
// costs money") — tighter than verify's own limiter since every successful
// call here has a direct cost, not just a guess attempt.
export const resendOtpLimiter = createRateLimiter({
  windowMs: HOUR,
  limit: isTest ? 1000 : 3,
  keyGenerator: phoneAndIpKey,
});
