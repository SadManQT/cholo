import * as citiesRepository from '../repositories/cities.repository.js';

export async function listCities() {
  return citiesRepository.findAll();
}
