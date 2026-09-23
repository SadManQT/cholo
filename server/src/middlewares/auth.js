import jwt from 'jsonwebtoken';

import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

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

export const requireRole = (...allowed) => (request, _response, next) =>
  allowed.some((role) => request.user.roles.includes(role))
    ? next()
    : next(new AppError(403, 'FORBIDDEN_ROLE'));
