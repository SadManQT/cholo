import express from 'express';

import { checkDatabaseConnection } from './config/db.js';
import apiRouter from './routes/index.js';

const app = express();

app.use(express.json());

app.get('/health', async (_request, response) => {
  try {
    await checkDatabaseConnection();
    response.json({ db: true });
  } catch (error) {
    console.error('Database health check failed:', error);
    response.status(503).json({ db: false });
  }
});

app.use('/api/v1', apiRouter);

export default app;
