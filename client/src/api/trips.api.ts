import { apiClient } from './client';
import type { ApiSuccess } from '../types/api.types';
import type { TrackedLocation } from '../types/geo.types';
import type { ParticipantRole, TripDetail, TripMessage, TripStatus, TripSummary } from '../types/ride.types';

export async function listTrips(params: {
  page?: number;
  limit?: number;
  status?: TripStatus | 'active';
  role?: ParticipantRole;
} = {}) {
  const response = await apiClient.get<ApiSuccess<TripSummary[]>>('/trips', { params });
  return { data: response.data.data, meta: response.data.meta };
}

export async function getTrip(tripCode: string) {
  const response = await apiClient.get<ApiSuccess<TripDetail>>(`/trips/${encodeURIComponent(tripCode)}`);
  return response.data.data;
}

export async function trackTrip(tripCode: string) {
  const response = await apiClient.get<ApiSuccess<TrackedLocation | null>>(
    `/trips/${encodeURIComponent(tripCode)}/track`,
  );
  return response.data.data;
}

export async function markArrived(tripCode: string) {
  const response = await apiClient.post<ApiSuccess<{ tripCode: string; status: TripStatus }>>(
    `/trips/${encodeURIComponent(tripCode)}/arrived`,
  );
  return response.data.data;
}

export async function startTrip(tripCode: string) {
  const response = await apiClient.post<ApiSuccess<{ tripCode: string; status: TripStatus }>>(
    `/trips/${encodeURIComponent(tripCode)}/start`,
  );
  return response.data.data;
}

export async function completeTrip(tripCode: string, waitingMin = 0) {
  const response = await apiClient.post<ApiSuccess<{ status: TripStatus }>>(
    `/trips/${encodeURIComponent(tripCode)}/complete`,
    { waitingMin },
  );
  return response.data.data;
}

export async function cancelTrip(
  tripCode: string,
  reasonCode: 'changed_mind' | 'driver_late' | 'no_show' | 'wrong_pickup' | 'vehicle_issue' | 'other',
  reasonText?: string,
) {
  const response = await apiClient.post<ApiSuccess<{ status: TripStatus; feeCharged: string }>>(
    `/trips/${encodeURIComponent(tripCode)}/cancel`,
    { reasonCode, ...(reasonText ? { reasonText } : {}) },
  );
  return response.data.data;
}

export async function listMessages(tripCode: string) {
  const response = await apiClient.get<ApiSuccess<TripMessage[]>>(
    `/trips/${encodeURIComponent(tripCode)}/messages`,
  );
  return response.data.data;
}

export async function sendMessage(tripCode: string, body: string, messageType: 'text' | 'quick_reply' = 'text') {
  const response = await apiClient.post<ApiSuccess<TripMessage>>(
    `/trips/${encodeURIComponent(tripCode)}/messages`,
    { body, messageType },
  );
  return response.data.data;
}

export async function triggerSos(tripCode: string, lat: number, lng: number) {
  const response = await apiClient.post<ApiSuccess<{ id: string; status: 'active'; triggeredAt: string }>>(
    `/trips/${encodeURIComponent(tripCode)}/sos`,
    { lat, lng },
  );
  return response.data.data;
}
