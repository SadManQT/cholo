import * as vehicleCategoriesService from '../services/vehicleCategories.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const list = asyncHandler(async (_request, response) => {
  const data = await vehicleCategoriesService.listActive();
  response.json({ success: true, data });
});
