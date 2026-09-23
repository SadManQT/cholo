import { createHash, randomBytes } from 'node:crypto';

import jwt from 'jsonwebtoken';

import { env } from '../config/env.js';

export function signAccessToken({ userId, roles, sessionId }) {
  return jwt.sign(
    { roles, sid: sessionId },
    env.JWT_SECRET,
    { subject: String(userId), expiresIn: env.JWT_ACCESS_TTL },
  );
}

export function generateRefreshToken() {
  return randomBytes(32).toString('hex');
}

export function hashRefreshToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

export function refreshTokenExpiresAt() {
  return new Date(Date.now() + env.REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);
}
