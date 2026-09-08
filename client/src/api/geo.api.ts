import { apiClient } from './client';
import type { ApiSuccess } from '../types/api.types';
import type { LatLng, Place, RouteResult } from '../types/geo.types';

export async function geocode(query: string) {
  const response = await apiClient.get<ApiSuccess<Place>>('/geo/geocode', { params: { query } });
  return response.data.data;
}

export async function search(query: string, signal?: AbortSignal) {
  const response = await apiClient.get<ApiSuccess<Place[]>>('/geo/search', { params: { query }, signal });
  return response.data.data;
}

export async function reverseGeocode(lat: number, lng: number) {
  const response = await apiClient.get<ApiSuccess<{ address: string }>>('/geo/reverse', { params: { lat, lng } });
  return { lat, lng, address: response.data.data.address } satisfies Place;
}

export async function getRoute(pickup: LatLng, dropoff: LatLng) {
  const response = await apiClient.post<ApiSuccess<RouteResult>>('/geo/route', { pickup, dropoff });
  return response.data.data;
}
