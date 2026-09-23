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

export const listPlaces = asyncHandler(async (request, response) => {
  response.json({ success: true, data: await meService.listPlaces(request.user.id) });
});

export const addPlace = asyncHandler(async (request, response) => {
  response.status(201).json({ success: true, data: await meService.addPlace(request.user.id, request.body) });
});

export const updatePlace = asyncHandler(async (request, response) => {
  response.json({ success: true, data: await meService.updatePlace(request.user.id, request.params.id, request.body) });
});

export const removePlace = asyncHandler(async (request, response) => {
  await meService.removePlace(request.user.id, request.params.id);
  response.status(204).end();
});

export const listContacts = asyncHandler(async (request, response) => {
  response.json({ success: true, data: await meService.listContacts(request.user.id) });
});

export const addContact = asyncHandler(async (request, response) => {
  response.status(201).json({ success: true, data: await meService.addContact(request.user.id, request.body) });
});

export const removeContact = asyncHandler(async (request, response) => {
  await meService.removeContact(request.user.id, request.params.id);
  response.status(204).end();
});
