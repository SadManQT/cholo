import * as ridesService from '../services/rides.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const quote = asyncHandler(async (request, response) => {
  const data = await ridesService.quote(request.body);
  response.json({ success: true, data });
});

export const createRequest = asyncHandler(async (request, response) => {
  const data = await ridesService.createRequest(request.user.id, request.body);
  response.status(201).json({ success: true, data });
});
