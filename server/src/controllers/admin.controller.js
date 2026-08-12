import * as adminService from '../services/admin.service.js';
import * as withdrawalsService from '../services/withdrawals.service.js';
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
