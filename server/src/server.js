import app from './app.js';
import { pool } from './config/db.js';
import { env } from './config/env.js';

const server = app.listen(env.PORT, () => {
  console.log(`Cholo API listening on port ${env.PORT}`);
});

let isShuttingDown = false;

function shutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`${signal} received; shutting down HTTP server`);
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
