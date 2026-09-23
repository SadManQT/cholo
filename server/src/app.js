import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';

import { corsOptions } from './config/cors.js';
import { env } from './config/env.js';
import { checkDatabaseConnection } from './config/db.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { notFound } from './middlewares/notFound.js';
import { requestLogger } from './middlewares/requestLogger.js';
import apiRouter from './routes/index.js';
import { logger } from './utils/logger.js';

const app = express();

// Render terminates TLS one proxy hop in front of the app; without this every request shares the proxy's IP
// and one rider's failed logins would rate-limit everyone.
if (env.NODE_ENV === 'production') app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(cors(corsOptions));
app.use((_request, response, next) => {
  response.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  });
  if (env.NODE_ENV === 'production') response.set('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
  next();
});
app.use(express.json());
app.use(cookieParser());
app.use(requestLogger);

app.get('/health', async (_request, response) => {
  try {
    await checkDatabaseConnection();
    response.json({ db: true });
  } catch (error) {
    logger.error('Database health check failed', error);
    response.status(503).json({ db: false });
  }
});

app.use('/uploads', express.static(env.UPLOAD_DIR, {
  immutable: true,
  maxAge: '30d',
  index: false,
  setHeaders: (response) => response.set({
    'Cross-Origin-Resource-Policy': 'cross-origin',
    'X-Robots-Tag': 'noindex',
    'Cache-Control': 'private, max-age=2592000, immutable',
  }),
}));
app.use('/api/v1', apiRouter);
app.use(notFound);
app.use(errorHandler);

export default app;
