import cron from 'node-cron';

import { logger } from '../utils/logger.js';
import * as ridesService from '../services/rides.service.js';

const SCHEDULE = '* * * * *';

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
