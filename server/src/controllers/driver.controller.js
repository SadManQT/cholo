import * as driverService from '../services/driver.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const apply = asyncHandler(async (request, response) => {
  const data = await driverService.apply(request.user.id, request.body);
  response.status(201).json({ success: true, data });
});

export const getStatus = asyncHandler(async (request, response) => {
  const data = await driverService.getStatus(request.user.id);
  response.json({ success: true, data });
});

export const addDocument = asyncHandler(async (request, response) => {
  const data = await driverService.addDriverDocument(request.user.id, request.body);
  response.status(201).json({ success: true, data });
});

export const listDocuments = asyncHandler(async (request, response) => {
  const data = await driverService.listDriverDocuments(request.user.id);
  response.json({ success: true, data });
});

export const addVehicle = asyncHandler(async (request, response) => {
  const data = await driverService.addVehicle(request.user.id, request.body);
  response.status(201).json({ success: true, data });
});

export const listVehicles = asyncHandler(async (request, response) => {
  const data = await driverService.listVehicles(request.user.id);
  response.json({ success: true, data });
});

export const updateVehicle = asyncHandler(async (request, response) => {
  const data = await driverService.updateVehicle(request.user.id, request.params.id, request.body);
  response.json({ success: true, data });
});

export const deactivateVehicle = asyncHandler(async (request, response) => {
  await driverService.deactivateVehicle(request.user.id, request.params.id);
  response.status(204).end();
});

export const activateVehicle = asyncHandler(async (request, response) => {
  const data = await driverService.activateVehicle(request.user.id, request.params.id);
  response.json({ success: true, data });
});

export const addVehicleDocument = asyncHandler(async (request, response) => {
  const data = await driverService.addVehicleDocument(
    request.user.id,
    request.params.id,
    request.body,
  );
  response.status(201).json({ success: true, data });
});

export const listVehicleDocuments = asyncHandler(async (request, response) => {
  const data = await driverService.listVehicleDocuments(request.user.id, request.params.id);
  response.json({ success: true, data });
});

export const setAvailability = asyncHandler(async (request, response) => {
  const data = await driverService.setAvailability(request.user.id, request.body);
  response.json({ success: true, data });
});
