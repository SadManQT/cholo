import { apiClient } from './client';
import type { ApiSuccess } from '../types/api.types';
import type { LatLng } from '../types/geo.types';
import type { CreateRideRequestInput, RideQuote, RideRequest } from '../types/ride.types';

export async function getQuote(input: {
  cityId: number;
  categoryId: number;
  pickup: LatLng;
  dropoff: LatLng;
}) {
  const response = await apiClient.post<ApiSuccess<RideQuote>>('/rides/quote', input);
  return response.data.data;
}

export async function createRequest(input: CreateRideRequestInput) {
  const response = await apiClient.post<ApiSuccess<RideRequest>>('/ride-requests', input);
  return response.data.data;
}

export async function getRequest(publicId: string) {
  const response = await apiClient.get<ApiSuccess<RideRequest>>(`/ride-requests/${encodeURIComponent(publicId)}`);
  return response.data.data;
}

export async function cancelRequest(publicId: string) {
  const response = await apiClient.delete<ApiSuccess<Pick<RideRequest, 'publicId' | 'status'>>>(
    `/ride-requests/${encodeURIComponent(publicId)}`,
  );
  return response.data.data;
}
