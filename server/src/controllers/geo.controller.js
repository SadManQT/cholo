import * as geoService from '../services/geo.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const geocode = asyncHandler(async (request, response) => {
  const data = await geoService.geocode(request.query.query);
  response.json({ success: true, data });
});

export const search = asyncHandler(async (request, response) => {
  const data = await geoService.search(request.query.query);
  response.json({ success: true, data });
});

export const reverseGeocode = asyncHandler(async (request, response) => {
  const data = await geoService.reverseGeocode(request.query.lat, request.query.lng);
  response.json({ success: true, data });
});

export const route = asyncHandler(async (request, response) => {
  const data = await geoService.route(request.body.pickup, request.body.dropoff);
  response.json({ success: true, data });
});
