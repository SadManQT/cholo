import * as tripsService from '../services/trips.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const markArrived = asyncHandler(async (request, response) => {
  const data = await tripsService.markArrived(request.user.id, request.params.tripCode);
  response.json({ success: true, data });
});

export const markStarted = asyncHandler(async (request, response) => {
  const data = await tripsService.markStarted(request.user.id, request.params.tripCode);
  response.json({ success: true, data });
});

export const complete = asyncHandler(async (request, response) => {
  const data = await tripsService.completeTrip(request.user.id, request.params.tripCode, request.body);
  response.json({ success: true, data });
});

export const cancel = asyncHandler(async (request, response) => {
  const data = await tripsService.cancelTrip(request.user.id, request.params.tripCode, request.body);
  response.json({ success: true, data });
});
