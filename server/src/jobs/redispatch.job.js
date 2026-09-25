import cron from 'node-cron';

import { logger } from '../utils/logger.js';
import * as dispatchService from '../services/dispatch.service.js';

const SCHEDULE = '*/5 * * * * *';

export function startRedispatchJob() {
  let running = false;
  return cron.schedule(SCHEDULE, async () => {
    if (running) return;
    running = true;
    try {
      const offered = await dispatchService.redispatchStaleRequests();
      if (offered > 0) logger.info(`redispatch.job: sent ${offered} new offer(s)`);
    } catch (error) {
      logger.error('redispatch.job: sweep failed', error);
    } finally {
      running = false;
    }
  });
}
