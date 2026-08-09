import jwt from 'jsonwebtoken';

import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

// Stateless on purpose (doc 10 §3): no DB read here, just signature + expiry.
// That's the whole trade-off of the access/refresh pair — a stolen access
// token stays valid until it naturally expires (15 min), it can't be
// revoked early. Revocation lives on the refresh side (doc 10 §7).
export function auth(request, _response, next) {
  const token = request.headers.authorization?.split(' ')[1];

  if (!token) {
    return next(new AppError(401, 'AUTH_REQUIRED'));
  }

  try {
    const claims = jwt.verify(token, env.JWT_SECRET);
    request.user = { id: Number(claims.sub), roles: claims.roles, sessionId: claims.sid };
    next();
  } catch {
    next(new AppError(401, 'TOKEN_EXPIRED'));
  }
}

// Route-level role gate (doc 10 §9 layer 1) — cheap and declarative, just
// reads the roles already verified onto req.user by `auth`. It only proves
// "a driver", not "this driver's own resource" — ownership is a second,
// separate check every service still has to make (IDOR, doc 10 §9 layer 2).
export const requireRole = (...allowed) => (request, _response, next) =>
  allowed.some((role) => request.user.roles.includes(role))
    ? next()
    : next(new AppError(403, 'FORBIDDEN_ROLE'));
