import * as vehicleCategoriesRepo from '../repositories/vehicleCategories.repository.js';

export function listActive() {
  return vehicleCategoriesRepo.findActive();
}
