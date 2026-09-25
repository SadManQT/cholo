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

export const listFavoriteDrivers = asyncHandler(async (request, response) => {
  response.json({ success: true, data: await meService.listFavoriteDrivers(request.user.id) });
});

export const addFavoriteDriver = asyncHandler(async (request, response) => {
  await meService.addFavoriteDriver(request.user.id, request.params.driverId);
  response.status(204).end();
});

export const removeFavoriteDriver = asyncHandler(async (request, response) => {
  await meService.removeFavoriteDriver(request.user.id, request.params.driverId);
  response.status(204).end();
});

export const getReferral = asyncHandler(async (request, response) => {
  response.json({ success: true, data: await meService.getReferral(request.user.id) });
});

export const deleteAccount = asyncHandler(async (request, response) => {
  // The refresh token is revoked, so the leftover cookie can no longer mint a session.
  await meService.deleteAccount(request.user.id, request.body);
  response.status(204).end();
});

export const getTwoFactor = asyncHandler(async (request, response) => {
  response.json({ success: true, data: await meService.getTwoFactorStatus(request.user.id) });
});

export const startTwoFactorSetup = asyncHandler(async (request, response) => {
  response.json({ success: true, data: await meService.startTwoFactorSetup(request.user.id) });
});

export const enableTwoFactor = asyncHandler(async (request, response) => {
  response.json({ success: true, data: await meService.enableTwoFactor(request.user.id, request.body) });
});

export const disableTwoFactor = asyncHandler(async (request, response) => {
  response.json({ success: true, data: await meService.disableTwoFactor(request.user.id, request.body) });
});
