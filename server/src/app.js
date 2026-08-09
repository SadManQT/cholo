import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';

import { corsOptions } from './config/cors.js';
import { checkDatabaseConnection } from './config/db.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { notFound } from './middlewares/notFound.js';
import { requestLogger } from './middlewares/requestLogger.js';
import apiRouter from './routes/index.js';
import { logger } from './utils/logger.js';

const app = express();

app.use(cors(corsOptions));
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

app.use('/api/v1', apiRouter);
app.use(notFound);
app.use(errorHandler);

export default app;
