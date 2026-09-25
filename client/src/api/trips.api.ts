import { apiClient } from './client';
import type { ApiSuccess } from '../types/api.types';
import type { TrackedLocation } from '../types/geo.types';
import type { ParticipantRole, ReportCategory, SharedTrip, TripDetail, TripMessage, TripStatus, TripSummary } from '../types/ride.types';

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

type Position = { lat: number; lng: number } | null | undefined;
const positionBody = (position: Position) => (position ? { lat: position.lat, lng: position.lng } : {});

export async function markArrived(tripCode: string, position?: Position) {
  const response = await apiClient.post<ApiSuccess<{ tripCode: string; status: TripStatus }>>(
    `/trips/${encodeURIComponent(tripCode)}/arrived`,
    positionBody(position),
  );
  return response.data.data;
}

export async function startTrip(tripCode: string) {
  const response = await apiClient.post<ApiSuccess<{ tripCode: string; status: TripStatus }>>(
    `/trips/${encodeURIComponent(tripCode)}/start`,
  );
  return response.data.data;
}

export async function completeTrip(tripCode: string, waitingMin = 0, position?: Position, { endEarly = false } = {}) {
  const response = await apiClient.post<ApiSuccess<{ status: TripStatus; endedEarly: boolean }>>(
    `/trips/${encodeURIComponent(tripCode)}/complete`,
    { waitingMin, ...positionBody(position), ...(endEarly ? { endEarly: true } : {}) },
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

export async function rateTrip(tripCode: string, score: number, comment?: string) {
  const response = await apiClient.post<ApiSuccess<{ score: number; comment: string | null }>>(
    `/trips/${encodeURIComponent(tripCode)}/rating`,
    { score, ...(comment ? { comment } : {}) },
  );
  return response.data.data;
}

export async function markStopReached(tripCode: string, stopOrder: number, position?: Position) {
  const response = await apiClient.post<ApiSuccess<{ order: number; arrivedAt: string }>>(
    `/trips/${encodeURIComponent(tripCode)}/stops/${stopOrder}/arrived`,
    positionBody(position),
  );
  return response.data.data;
}

export async function createShareLink(tripCode: string) {
  const response = await apiClient.post<ApiSuccess<{ url: string; token: string }>>(
    `/trips/${encodeURIComponent(tripCode)}/share`,
  );
  return response.data.data;
}

export async function getSharedTrip(token: string) {
  const response = await apiClient.get<ApiSuccess<SharedTrip>>(`/share/${encodeURIComponent(token)}`);
  return response.data.data;
}

export async function reportTrip(tripCode: string, category: ReportCategory, description?: string) {
  const response = await apiClient.post<ApiSuccess<{ id: string }>>(
    `/trips/${encodeURIComponent(tripCode)}/report`,
    { category, ...(description ? { description } : {}) },
  );
  return response.data.data;
}
