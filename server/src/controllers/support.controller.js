import * as supportService from '../services/support.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const create = asyncHandler(async (request, response) => {
  const data = await supportService.createTicket(request.user.id, request.body);
  response.status(201).json({ success: true, data });
});

export const list = asyncHandler(async (request, response) => {
  const result = await supportService.listMine(request.user.id, request.query);
  response.json({ success: true, ...result });
});

export const get = asyncHandler(async (request, response) => {
  const data = await supportService.getMine(request.user.id, request.params.id);
  response.json({ success: true, data });
});

export const addMessage = asyncHandler(async (request, response) => {
  const data = await supportService.addUserMessage(request.user.id, request.params.id, request.body);
  response.status(201).json({ success: true, data });
});
