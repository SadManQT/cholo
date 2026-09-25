import { createHmac } from 'node:crypto';

import jwt from 'jsonwebtoken';

import { env } from '../config/env.js';

// Each purpose signs with its own key derived from JWT_SECRET, so a share link or a half-finished
// two-step login can never be replayed as an API access token (or as each other).
const keyFor = (purpose) => createHmac('sha256', env.JWT_SECRET).update(`cholo:${purpose}`).digest();

export const signScoped = (purpose, claims, expiresIn) => jwt.sign(claims, keyFor(purpose), { expiresIn });

export function verifyScoped(purpose, token) {
  try {
    return jwt.verify(token, keyFor(purpose));
  } catch {
    return null;
  }
}
