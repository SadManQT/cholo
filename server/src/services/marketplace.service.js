import { withTransaction } from '../config/db.js';
import * as adminRepo from '../repositories/admin.repository.js';
import * as auditRepo from '../repositories/audit.repository.js';
import * as marketplaceRepo from '../repositories/marketplace.repository.js';
import * as socialRepo from '../repositories/social.repository.js';
import { AppError } from '../utils/AppError.js';
import { notify } from './notifications.service.js';

async function requireAccessLevel(adminId, allowed, client) {
  const level = await adminRepo.getAccessLevel(adminId, client);
  if (!allowed.includes(level)) throw new AppError(403, 'FORBIDDEN_ACCESS_LEVEL');
}

const audit = (adminId, ipAddress, action, entityType, entityId, oldValue, newValue, client) => auditRepo.insert({
  actorId: adminId, actorRole: 'ADMIN', ipAddress, action, entityType, entityId, oldValue, newValue,
}, client);

const paged = (rows, query) => ({
  data: rows.map(({ totalCount: _totalCount, ...row }) => row),
  meta: { page: query.page, limit: query.limit, total: rows[0]?.totalCount ?? 0 },
});

const offsetOf = (query) => (query.page - 1) * query.limit;

export async function listPromos(query) {
  return paged(await marketplaceRepo.listPromos({ limit: query.limit, offset: offsetOf(query) }), query);
}

function promoCodeTaken(error) {
  if (error.code === '23505') throw new AppError(409, 'PROMO_CODE_TAKEN');
  throw error;
}

export async function createPromo(adminId, { notifyRiders, ...input }, ipAddress) {
  return withTransaction(async (client) => {
    await requireAccessLevel(adminId, ['super', 'ops'], client);
    const id = await marketplaceRepo.insertPromo(input, adminId, client).catch(promoCodeTaken);
    await audit(adminId, ipAddress, 'PROMO_CREATED', 'promo_codes', id, null, input, client);
    if (notifyRiders) {
      const off = input.promoType === 'percentage' ? `${input.value}% off` : `৳${input.value} off`;
      await marketplaceRepo.notifyAllRiders({
        title: `${off} with code ${input.code}`,
        body: input.description ?? 'Enter the code when you book your next ride.',
        payload: { promoCode: input.code },
      }, client);
    }
    return marketplaceRepo.findPromoById(id, client);
  });
}

export async function updatePromo(adminId, id, input, ipAddress) {
  return withTransaction(async (client) => {
    await requireAccessLevel(adminId, ['super', 'ops'], client);
    const before = await marketplaceRepo.findPromoById(id, client);
    if (!before || !await marketplaceRepo.lockPromo(id, client)) throw new AppError(404, 'PROMO_NOT_FOUND');
    await marketplaceRepo.updatePromo(id, input, client).catch(promoCodeTaken);
    await audit(adminId, ipAddress, 'PROMO_UPDATED', 'promo_codes', id, before, input, client);
    return marketplaceRepo.findPromoById(id, client);
  });
}

export async function listSurge(query) {
  return paged(await marketplaceRepo.listSurge({
    includeEnded: query.includeEnded, limit: query.limit, offset: offsetOf(query),
  }), query);
}

export async function createSurge(adminId, input, ipAddress) {
  return withTransaction(async (client) => {
    await requireAccessLevel(adminId, ['super', 'ops'], client);
    if (!await marketplaceRepo.zoneExists(input.zoneId, client)) throw new AppError(404, 'ZONE_NOT_FOUND');
    const created = await marketplaceRepo.insertSurge(input, adminId, client);
    await audit(adminId, ipAddress, 'SURGE_STARTED', 'surge_pricing', created.id, null, created, client);
    return created;
  });
}

export async function endSurge(adminId, id, ipAddress) {
  return withTransaction(async (client) => {
    await requireAccessLevel(adminId, ['super', 'ops'], client);
    const ended = await marketplaceRepo.endSurge(id, client);
    if (!ended) throw new AppError(404, 'SURGE_NOT_FOUND');
    await audit(adminId, ipAddress, 'SURGE_ENDED', 'surge_pricing', id, null, ended, client);
    return ended;
  });
}

export async function listReports(query) {
  return paged(await socialRepo.listReports({ status: query.status, limit: query.limit, offset: offsetOf(query) }), query);
}

const CLOSED_REPORT_STATUSES = ['action_taken', 'dismissed'];

export async function updateReport(adminId, id, { status, note }, ipAddress) {
  return withTransaction(async (client) => {
    await requireAccessLevel(adminId, ['super', 'ops', 'support'], client);
    const report = await socialRepo.findReportForUpdate(id, client);
    if (!report) throw new AppError(404, 'REPORT_NOT_FOUND');
    if (CLOSED_REPORT_STATUSES.includes(report.status)) throw new AppError(409, 'REPORT_CLOSED');
    await socialRepo.updateReportStatus(id, status, adminId, client);
    await audit(adminId, ipAddress, 'USER_REPORT_UPDATED', 'user_reports', id, { status: report.status }, { status, note }, client);
    if (CLOSED_REPORT_STATUSES.includes(status)) {
      await notify(report.reporterId, {
        category: 'safety',
        title: 'We reviewed your report',
        body: status === 'action_taken'
          ? 'Thank you. We took action on the account you reported.'
          : 'Thank you. We looked into it and found no rule was broken this time.',
      }, client);
    }
    return { id, status };
  });
}

function csvCell(value) {
  if (value == null) return '';
  const text = value instanceof Date ? value.toISOString() : String(value);
  // Leading =,+,-,@ would run as a formula in Excel; prefix with a quote to keep it text.
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv(rows) {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  return [headers.join(','), ...rows.map((row) => headers.map((key) => csvCell(row[key])).join(','))].join('\r\n');
}

export async function exportCsv(adminId, kind, range, ipAddress) {
  await requireAccessLevel(adminId, ['super', 'finance']);
  const rows = await marketplaceRepo.exportRows(kind, range);
  await audit(adminId, ipAddress, 'DATA_EXPORTED', 'exports', null, null, { kind, ...range, rows: rows.length });
  return toCsv(rows);
}
