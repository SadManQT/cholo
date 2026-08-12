import * as tripsService from '../services/trips.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const list = asyncHandler(async (request, response) => {
  const result = await tripsService.listTrips(request.user.id, request.query);
  response.json({ success: true, data: result.data, meta: result.meta });
});

export const get = asyncHandler(async (request, response) => {
  const data = await tripsService.getTrip(request.user.id, request.params.tripCode);
  response.json({ success: true, data });
});

export const track = asyncHandler(async (request, response) => {
  const data = await tripsService.trackTrip(request.user.id, request.params.tripCode);
  response.json({ success: true, data });
});

export const listMessages = asyncHandler(async (request, response) => {
  const data = await tripsService.listMessages(request.user.id, request.params.tripCode);
  response.json({ success: true, data });
});

export const sendMessage = asyncHandler(async (request, response) => {
  const data = await tripsService.sendMessage(request.user.id, request.params.tripCode, request.body);
  response.status(201).json({ success: true, data });
});

export const triggerSos = asyncHandler(async (request, response) => {
  const data = await tripsService.triggerSos(request.user.id, request.params.tripCode, request.body);
  response.status(201).json({ success: true, data });
});

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

export const pay = asyncHandler(async (request, response) => {
  // 201: this creates a payment, same as doc 08-09-10 §7's own table entry
  // for this route ("201 payment") — unlike arrived/start/complete/cancel,
  // which all update the one trip resource that already exists.
  const data = await tripsService.payTrip(request.user.id, request.params.tripCode, request.body);
  response.status(201).json({ success: true, data });
});
