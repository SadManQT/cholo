import { apiClient } from './client';
import type { ApiSuccess } from '../types/api.types';
import type { Place } from '../types/geo.types';

export async function geocode(query: string) {
  const response = await apiClient.get<ApiSuccess<Place>>('/geo/geocode', { params: { query } });
  return response.data.data;
}

export async function reverseGeocode(lat: number, lng: number) {
  const response = await apiClient.get<ApiSuccess<{ address: string }>>('/geo/reverse', { params: { lat, lng } });
  return { lat, lng, address: response.data.data.address } satisfies Place;
}
