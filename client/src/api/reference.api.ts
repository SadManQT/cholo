import { apiClient } from './client';
import type { ApiSuccess } from '../types/api.types';
import type { City, VehicleCategory } from '../types/ride.types';

export async function listCities() {
  const response = await apiClient.get<ApiSuccess<City[]>>('/cities');
  return response.data.data;
}

export async function listVehicleCategories() {
  const response = await apiClient.get<ApiSuccess<VehicleCategory[]>>('/vehicle-categories');
  return response.data.data;
}
