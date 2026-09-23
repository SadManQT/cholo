import cron from 'node-cron';

import { withTransaction } from '../config/db.js';
import * as adminRepo from '../repositories/admin.repository.js';
import { notify } from '../services/notifications.service.js';
import { logger } from '../utils/logger.js';

const SCHEDULE = '*/5 * * * *';

export async function reinstateExpiredSuspensions() {
  return withTransaction(async (client) => {
    const ids = await adminRepo.reinstateExpiredSuspensions(client);
    for (const userId of ids) {
      await notify(userId, { category: 'system', title: 'Your account is active again', body: 'Your suspension period has ended.' }, client);
    }
    return ids;
  });
}

export function startSuspensionsJob() {
  return cron.schedule(SCHEDULE, async () => {
    try {
      const ids = await reinstateExpiredSuspensions();
      if (ids.length > 0) logger.info(`suspensions.job: reinstated ${ids.length} account(s)`);
    } catch (error) {
      logger.error('suspensions.job: sweep failed', error);
    }
  });
}
