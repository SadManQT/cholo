import * as marketplaceService from '../services/marketplace.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const listPromos = asyncHandler(async (request, response) => {
  const result = await marketplaceService.listPromos(request.query);
  response.json({ success: true, ...result });
});

export const createPromo = asyncHandler(async (request, response) => {
  const data = await marketplaceService.createPromo(request.user.id, request.body, request.ip);
  response.status(201).json({ success: true, data });
});

export const updatePromo = asyncHandler(async (request, response) => {
  const data = await marketplaceService.updatePromo(request.user.id, request.params.id, request.body, request.ip);
  response.json({ success: true, data });
});

export const listSurge = asyncHandler(async (request, response) => {
  const result = await marketplaceService.listSurge(request.query);
  response.json({ success: true, ...result });
});

export const createSurge = asyncHandler(async (request, response) => {
  const data = await marketplaceService.createSurge(request.user.id, request.body, request.ip);
  response.status(201).json({ success: true, data });
});

export const endSurge = asyncHandler(async (request, response) => {
  const data = await marketplaceService.endSurge(request.user.id, request.params.id, request.ip);
  response.json({ success: true, data });
});

export const listReports = asyncHandler(async (request, response) => {
  const result = await marketplaceService.listReports(request.query);
  response.json({ success: true, ...result });
});

export const updateReport = asyncHandler(async (request, response) => {
  const data = await marketplaceService.updateReport(request.user.id, request.params.id, request.body, request.ip);
  response.json({ success: true, data });
});

export const exportCsv = asyncHandler(async (request, response) => {
  const { kind } = request.params;
  const { from, to } = request.query;
  const csv = await marketplaceService.exportCsv(request.user.id, kind, { from, to }, request.ip);
  response.set('Content-Type', 'text/csv; charset=utf-8');
  response.set('Content-Disposition', `attachment; filename="cholo-${kind}-${from}-to-${to}.csv"`);
  // BOM so Excel opens Bangla names and ৳ correctly.
  response.send(`﻿${csv}`);
});
