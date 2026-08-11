import cron from 'node-cron';

import { logger } from '../utils/logger.js';
import * as ridesService from '../services/rides.service.js';

// doc 08-09-10 §10.1's own worked example is a 5-minute search window
// (rides.service.js's REQUEST_EXPIRY_MINUTES) — sweeping every minute keeps
// the gap between "expires_at passes" and "status actually flips to
// expired" small without hammering a table this small every few seconds.
const SCHEDULE = '* * * * *';

// jobs/ only wires a cron schedule to a service call (doc 06 §3.1's folder
// contract: "cron schedules calling services" / never "logic that only
// jobs use") — the actual sweep (mark stale requests expired, withdraw
// their still-pending offers) lives in rides.service.js/expireStaleRequests,
// exactly like dispatch/trips logic lives in their own services.
export function startExpireRequestsJob() {
  return cron.schedule(SCHEDULE, async () => {
    try {
      const expired = await ridesService.expireStaleRequests();
      if (expired.length > 0) {
        logger.info(`expireRequests.job: expired ${expired.length} stale ride request(s)`);
      }
    } catch (error) {
      logger.error('expireRequests.job: sweep failed', error);
    }
  });
}
