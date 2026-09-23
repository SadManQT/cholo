import { AppError } from '../utils/AppError.js';
import { ERROR_MESSAGES } from '../utils/errorMessages.js';
import { logger } from '../utils/logger.js';

const postgresErrors = Object.freeze({
  23505: { status: 409, code: 'DUPLICATE' },
  23503: { status: 422, code: 'VALIDATION_FAILED' },
  23514: { status: 422, code: 'VALIDATION_FAILED' },
  57014: { status: 503, code: 'DATABASE_TIMEOUT' },
  '53300': { status: 503, code: 'DATABASE_UNAVAILABLE' },
  '57P01': { status: 503, code: 'DATABASE_UNAVAILABLE' },
  '57P03': { status: 503, code: 'DATABASE_UNAVAILABLE' },
  ECONNREFUSED: { status: 503, code: 'DATABASE_UNAVAILABLE' },
});

function sendError(response, status, code, details) {
  const error = {
    code,
    message: ERROR_MESSAGES[code] ?? code,
  };

  if (details !== undefined) {
    error.details = details;
  }

  return response.status(status).json({ success: false, error });
}

export function errorHandler(error, request, response, next) {
  if (response.headersSent) {
    return next(error);
  }

  if (error instanceof AppError) {
    return sendError(response, error.status, error.code, error.details);
  }

  if (error.type === 'entity.too.large') {
    return sendError(response, 413, 'PAYLOAD_TOO_LARGE');
  }

  if (error.type === 'entity.parse.failed') {
    return sendError(response, 422, 'VALIDATION_FAILED', [
      { field: 'body', issue: 'Request body must contain valid JSON.' },
    ]);
  }

  const postgresError = postgresErrors[error.code];

  const context = { method: request.method, path: request.originalUrl };

  if (postgresError) {
    if (postgresError.status >= 500) logger.error('Database unavailable', error, context);
    return sendError(response, postgresError.status, postgresError.code);
  }

  logger.error('Unhandled request error', error, context);

  return sendError(response, 500, 'INTERNAL');
}
