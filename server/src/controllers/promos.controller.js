import * as promosService from '../services/promos.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const validate = asyncHandler(async (request, response) => {
  const data = await promosService.validatePromo(request.user.id, request.body);
  response.json({ success: true, data });
});

export const listAvailable = asyncHandler(async (request, response) => {
  const data = await promosService.listAvailablePromos(request.query.cityId);
  response.json({ success: true, data });
});
