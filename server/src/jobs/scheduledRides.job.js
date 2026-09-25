import cron from 'node-cron';

import { logger } from '../utils/logger.js';
import * as ridesService from '../services/rides.service.js';

const SCHEDULE = '* * * * *';

export function startScheduledRidesJob() {
  return cron.schedule(SCHEDULE, async () => {
    try {
      const { reminders, dispatched } = await ridesService.dispatchScheduledRequests();
      if (reminders + dispatched > 0) {
        logger.info(`scheduledRides.job: ${reminders} reminder(s), ${dispatched} search(es) started`);
      }
    } catch (error) {
      logger.error('scheduledRides.job: sweep failed', error);
    }
  });
}
