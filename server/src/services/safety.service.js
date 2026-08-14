import { withTransaction } from '../config/db.js';
import * as adminRepo from '../repositories/admin.repository.js';
import * as auditRepo from '../repositories/audit.repository.js';
import * as safetyRepo from '../repositories/safety.repository.js';
import { AppError } from '../utils/AppError.js';

async function requireSafetyLevel(adminId, client) {
  const level = await adminRepo.getAccessLevel(adminId, client);
  if (!['super', 'ops', 'support'].includes(level)) throw new AppError(403, 'FORBIDDEN_ACCESS_LEVEL');
}

export async function listAlerts(query) {
  const rows = await safetyRepo.listQueue(query);
  const total = rows[0]?.totalCount ?? 0;
  return {
    data: rows.map(({ totalCount: _totalCount, ...row }) => row),
    meta: { page: query.page, limit: query.limit, total },
  };
}

export async function acknowledge(adminId, alertId, ipAddress) {
  return withTransaction(async (client) => {
    await requireSafetyLevel(adminId, client);
    const alert = await safetyRepo.findForUpdate(alertId, client);
    if (!alert) throw new AppError(404, 'SOS_NOT_FOUND');
    if (alert.status !== 'active') throw new AppError(409, 'SOS_ALREADY_HANDLED');
    const updated = await safetyRepo.acknowledge(alertId, adminId, client);
    await auditRepo.insert({
      actorId: adminId, actorRole: 'ADMIN', ipAddress,
      action: 'SOS_ACKNOWLEDGED', entityType: 'sos_alerts', entityId: alertId,
      oldValue: { status: alert.status }, newValue: { status: updated.status },
    }, client);
    return updated;
  });
}

export async function resolve(adminId, alertId, input, ipAddress) {
  return withTransaction(async (client) => {
    await requireSafetyLevel(adminId, client);
    const alert = await safetyRepo.findForUpdate(alertId, client);
    if (!alert) throw new AppError(404, 'SOS_NOT_FOUND');
    if (!['active', 'acknowledged'].includes(alert.status)) throw new AppError(409, 'SOS_ALREADY_HANDLED');
    const updated = await safetyRepo.resolve(alertId, { ...input, adminId }, client);
    await auditRepo.insert({
      actorId: adminId, actorRole: 'ADMIN', ipAddress,
      action: input.status === 'false_alarm' ? 'SOS_MARKED_FALSE_ALARM' : 'SOS_RESOLVED',
      entityType: 'sos_alerts', entityId: alertId,
      oldValue: { status: alert.status }, newValue: { status: updated.status, resolutionNote: input.resolutionNote },
    }, client);
    return updated;
  });
}
