import app from './app.js';
import { pool } from './config/db.js';
import { env } from './config/env.js';
import { startDocumentExpiryJob } from './jobs/documentExpiry.job.js';
import { startExpireRequestsJob } from './jobs/expireRequests.job.js';
import { startRedispatchJob } from './jobs/redispatch.job.js';
import { startScheduledRidesJob } from './jobs/scheduledRides.job.js';
import { startSuspensionsJob } from './jobs/suspensions.job.js';
import { attachSocketServer } from './sockets/index.js';

const server = app.listen(env.PORT, () => {
  console.log(`Cholo API listening on port ${env.PORT}`);
});

const io = attachSocketServer(server);

const jobs = [
  startExpireRequestsJob(), startSuspensionsJob(), startDocumentExpiryJob(),
  startRedispatchJob(), startScheduledRidesJob(),
];

let isShuttingDown = false;

function shutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`${signal} received; shutting down HTTP server`);
  for (const job of jobs) job.stop();
  io.close();
  server.close(async (error) => {
    if (error) {
      console.error('HTTP server shutdown failed:', error);
      process.exitCode = 1;
    }

    await pool.end();
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
