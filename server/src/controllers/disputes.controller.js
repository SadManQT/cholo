import * as disputesService from '../services/disputes.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const create = asyncHandler(async (request, response) => {
  const data = await disputesService.createDispute(request.user.id, request.body);
  response.status(201).json({ success: true, data });
});

export const list = asyncHandler(async (request, response) => {
  const result = await disputesService.listMine(request.user.id, request.query);
  response.json({ success: true, ...result });
});
