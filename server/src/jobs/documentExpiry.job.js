import cron from 'node-cron';

import { withTransaction } from '../config/db.js';
import * as documentsRepo from '../repositories/documents.repository.js';
import { notify } from '../services/notifications.service.js';
import { logger } from '../utils/logger.js';

const WARN_DAYS_AHEAD = 14;
const label = (docType) => docType.replaceAll('_', ' ');

export async function sweepDocumentExpiry() {
  return withTransaction(async (client) => {
    const expired = await documentsRepo.expireLapsedDocuments(client);
    for (const { driverId, docType } of expired) {
      await notify(driverId, {
        category: 'document',
        title: `Your ${label(docType)} has expired`,
        body: 'Upload a renewed copy so you can keep driving.',
      }, client);
    }
    const expiring = await documentsRepo.findExpiringOn(WARN_DAYS_AHEAD, client);
    for (const { driverId, docType, expiryDate } of expiring) {
      await notify(driverId, {
        category: 'document',
        title: `Your ${label(docType)} expires in ${WARN_DAYS_AHEAD} days`,
        body: `It expires on ${expiryDate}. Upload a renewed copy before then.`,
      }, client);
    }
    return { expired: expired.length, warned: expiring.length };
  });
}

export function startDocumentExpiryJob() {
  return cron.schedule('10 0 * * *', async () => {
    try {
      const result = await sweepDocumentExpiry();
      logger.info(`documentExpiry.job: expired ${result.expired}, warned ${result.warned}`);
    } catch (error) {
      logger.error('documentExpiry.job: sweep failed', error);
    }
  }, { timezone: 'Asia/Dhaka' });
}
