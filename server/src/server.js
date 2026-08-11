import app from './app.js';
import { pool } from './config/db.js';
import { env } from './config/env.js';
import { startExpireRequestsJob } from './jobs/expireRequests.job.js';
import { attachSocketServer } from './sockets/index.js';

const server = app.listen(env.PORT, () => {
  console.log(`Cholo API listening on port ${env.PORT}`);
});

// doc 05-06-07 §7: "one Node process, one HTTP server — Express handles
// /api/* requests, Socket.io hijacks connections that ask to upgrade. They
// share the same port." Attached here, not app.js, same two-file-entry
// reasoning as the cron job below: supertest imports app.js and must never
// open a real port or accept upgrade requests just to exercise an HTTP
// route.
const io = attachSocketServer(server);

// Started here, not app.js — same "two-file entry trick" reasoning as
// Socket.io (doc 06 §3.1): app.js stays a side-effect-free Express app that
// supertest can import without a cron loop also spinning up in every test
// run.
const expireRequestsJob = startExpireRequestsJob();

let isShuttingDown = false;

function shutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`${signal} received; shutting down HTTP server`);
  expireRequestsJob.stop();
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
