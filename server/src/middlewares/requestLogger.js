import { logger } from '../utils/logger.js';

export function requestLogger(request, response, next) {
  const startedAt = process.hrtime.bigint();

  response.once('finish', () => {
    const durationNanoseconds = process.hrtime.bigint() - startedAt;
    const durationMs = Number(durationNanoseconds) / 1_000_000;

    logger.info('Request completed', {
      method: request.method,
      path: request.originalUrl,
      status: response.statusCode,
      durationMs: Number(durationMs.toFixed(2)),
    });
  });

  next();
}
