import * as citiesService from '../services/cities.service.js';

export async function listCities(_request, response, next) {
  try {
    const cities = await citiesService.listCities();
    response.json({ success: true, data: cities });
  } catch (error) {
    next(error);
  }
}
