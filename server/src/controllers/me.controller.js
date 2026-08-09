import * as meService from '../services/me.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const getMe = asyncHandler(async (request, response) => {
  const data = await meService.getMe(request.user.id);
  response.json({ success: true, data });
});

export const updateMe = asyncHandler(async (request, response) => {
  const data = await meService.updateMe(request.user.id, request.body);
  response.json({ success: true, data });
});

export const changePassword = asyncHandler(async (request, response) => {
  await meService.changePassword(request.user.id, request.user.sessionId, request.body);
  response.status(204).end();
});
