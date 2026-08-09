import * as citiesService from '../services/cities.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const listCities = asyncHandler(async (_request, response) => {
  const cities = await citiesService.listCities();
  response.json({ success: true, data: cities });
});
