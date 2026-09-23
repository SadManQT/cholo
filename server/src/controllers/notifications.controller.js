import * as notificationsService from '../services/notifications.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const list = asyncHandler(async (request, response) => {
  response.json({ success: true, ...(await notificationsService.listMine(request.user.id, request.query)) });
});

export const markRead = asyncHandler(async (request, response) => {
  response.json({ success: true, data: await notificationsService.markRead(request.user.id, request.body.ids) });
});
