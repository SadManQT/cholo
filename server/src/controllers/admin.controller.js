import * as adminService from '../services/admin.service.js';
import * as withdrawalsService from '../services/withdrawals.service.js';
import * as disputesService from '../services/disputes.service.js';
import * as safetyService from '../services/safety.service.js';
import * as supportService from '../services/support.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const listDrivers = asyncHandler(async (request, response) => {
  const result = await adminService.listDrivers(request.query);
  response.json({ success: true, ...result });
});

export const reviewDriverDocument = asyncHandler(async (request, response) => {
  const data = await adminService.reviewDriverDocument(
    request.user.id,
    request.params.id,
    request.body,
    request.ip,
  );
  response.json({ success: true, data });
});

export const reviewVehicleDocument = asyncHandler(async (request, response) => {
  const data = await adminService.reviewVehicleDocument(
    request.user.id,
    request.params.id,
    request.body,
    request.ip,
  );
  response.json({ success: true, data });
});

export const approveDriver = asyncHandler(async (request, response) => {
  const data = await adminService.decideDriver(
    request.user.id,
    request.params.id,
    'approved',
    null,
    request.ip,
  );
  response.json({ success: true, data });
});

export const rejectDriver = asyncHandler(async (request, response) => {
  const data = await adminService.decideDriver(
    request.user.id,
    request.params.id,
    'rejected',
    request.body.reason,
    request.ip,
  );
  response.json({ success: true, data });
});

export const approveVehicle = asyncHandler(async (request, response) => {
  const data = await adminService.decideVehicle(
    request.user.id,
    request.params.id,
    'approved',
    null,
    request.ip,
  );
  response.json({ success: true, data });
});

export const rejectVehicle = asyncHandler(async (request, response) => {
  const data = await adminService.decideVehicle(
    request.user.id,
    request.params.id,
    'rejected',
    request.body.reason,
    request.ip,
  );
  response.json({ success: true, data });
});

export const listWithdrawalQueue = asyncHandler(async (request, response) => {
  const result = await withdrawalsService.listQueue(request.query);
  response.json({ success: true, data: result.data, meta: result.meta });
});

export const approveWithdrawal = asyncHandler(async (request, response) => {
  const data = await withdrawalsService.approveWithdrawal(request.user.id, request.params.id, request.ip);
  response.json({ success: true, data });
});

export const rejectWithdrawal = asyncHandler(async (request, response) => {
  const data = await withdrawalsService.rejectWithdrawal(
    request.user.id,
    request.params.id,
    request.body.reason,
    request.ip,
  );
  response.json({ success: true, data });
});

export const getStats = asyncHandler(async (request, response) => {
  const data = await adminService.getStats(request.query);
  response.json({ success: true, data });
});

export const listUsers = asyncHandler(async (request, response) => {
  const result = await adminService.listUsers(request.query);
  response.json({ success: true, ...result });
});

export const suspendUser = asyncHandler(async (request, response) => {
  const data = await adminService.decideUser(
    request.user.id, request.params.id, 'suspended', request.body.reason, request.ip,
  );
  response.json({ success: true, data });
});

export const reinstateUser = asyncHandler(async (request, response) => {
  const data = await adminService.decideUser(
    request.user.id, request.params.id, 'active', request.body.reason, request.ip,
  );
  response.json({ success: true, data });
});

export const listPricingRules = asyncHandler(async (request, response) => {
  const result = await adminService.listPricingRules(request.query);
  response.json({ success: true, ...result });
});

export const publishPricingRule = asyncHandler(async (request, response) => {
  const data = await adminService.publishPricingRule(request.user.id, request.body, request.ip);
  response.status(201).json({ success: true, data });
});

export const listVehicles = asyncHandler(async (request, response) => {
  const result = await adminService.listVehicles(request.query);
  response.json({ success: true, ...result });
});

export const listDisputes = asyncHandler(async (request, response) => {
  const result = await disputesService.listQueue(request.query);
  response.json({ success: true, ...result });
});

export const resolveDispute = asyncHandler(async (request, response) => {
  const data = await disputesService.resolveDispute(
    request.user.id, request.params.id, request.body, request.ip,
  );
  response.json({ success: true, data });
});

export const listSos = asyncHandler(async (request, response) => {
  const result = await safetyService.listAlerts(request.query);
  response.json({ success: true, ...result });
});

export const acknowledgeSos = asyncHandler(async (request, response) => {
  const data = await safetyService.acknowledge(request.user.id, request.params.id, request.ip);
  response.json({ success: true, data });
});

export const resolveSos = asyncHandler(async (request, response) => {
  const data = await safetyService.resolve(request.user.id, request.params.id, request.body, request.ip);
  response.json({ success: true, data });
});

export const listAuditLogs = asyncHandler(async (request, response) => {
  const result = await adminService.listAuditLogs(request.query);
  response.json({ success: true, ...result });
});

export const listSupportTickets = asyncHandler(async (request, response) => {
  const result = await supportService.listQueue(request.user.id, request.query);
  response.json({ success: true, ...result });
});

export const getSupportTicket = asyncHandler(async (request, response) => {
  const data = await supportService.getAdminTicket(request.user.id, request.params.id);
  response.json({ success: true, data });
});

export const updateSupportTicket = asyncHandler(async (request, response) => {
  const data = await supportService.updateTicket(
    request.user.id, request.params.id, request.body, request.ip,
  );
  response.json({ success: true, data });
});

export const addSupportMessage = asyncHandler(async (request, response) => {
  const data = await supportService.addAdminMessage(
    request.user.id, request.params.id, request.body, request.ip,
  );
  response.status(201).json({ success: true, data });
});
