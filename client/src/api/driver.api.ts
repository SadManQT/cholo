import { apiClient } from './client';
import type { ApiSuccess } from '../types/api.types';
import type { AcceptedOffer, DriverAvailability, DriverStatus, LocationUpdate, RideOffer } from '../types/ride.types';

export async function getStatus() {
  const response = await apiClient.get<ApiSuccess<DriverStatus>>('/driver/status');
  return response.data.data;
}

export async function setAvailability(status: 'online' | 'offline' | 'break', location?: LocationUpdate) {
  const response = await apiClient.put<ApiSuccess<DriverAvailability>>('/driver/availability', {
    status,
    ...(location ? { currentLat: location.lat, currentLng: location.lng, heading: location.heading } : {}),
  });
  return response.data.data;
}

export async function listOffers() {
  const response = await apiClient.get<ApiSuccess<RideOffer[]>>('/driver/offers');
  return response.data.data;
}

export async function respondToOffer(offerId: string, responseValue: 'accepted' | 'rejected') {
  const response = await apiClient.post<ApiSuccess<AcceptedOffer | { id: string; response: 'rejected' }>>(
    `/driver/offers/${offerId}/respond`,
    { response: responseValue },
  );
  return response.data.data;
}
