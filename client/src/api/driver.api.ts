import { apiClient } from './client';
import type { ApiSuccess } from '../types/api.types';
import type {
  DailyEarning, EarningTripRow, PayoutAccount, PayoutAccountType, Withdrawal,
} from '../types/earnings.types';
import type {
  AcceptedOffer, DriverAvailability, DriverDocType, DriverDocument, DriverStatus, DriverVehicle, LocationUpdate, RideOffer, VehicleDocType,
} from '../types/ride.types';

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

export async function getEarnings(params: { from?: string; to?: string } = {}) {
  const response = await apiClient.get<ApiSuccess<{ daily: DailyEarning[]; trips: EarningTripRow[] }>>(
    '/driver/earnings',
    { params },
  );
  return response.data.data;
}

export async function listPayoutAccounts() {
  const response = await apiClient.get<ApiSuccess<PayoutAccount[]>>('/driver/payout-accounts');
  return response.data.data;
}

export async function addPayoutAccount(input: {
  accountType: PayoutAccountType;
  accountName: string;
  accountNo: string;
  bankName?: string;
}) {
  const response = await apiClient.post<ApiSuccess<PayoutAccount>>('/driver/payout-accounts', input);
  return response.data.data;
}

export async function removePayoutAccount(accountId: string) {
  await apiClient.delete(`/driver/payout-accounts/${accountId}`);
}

export async function requestWithdrawal(input: { amount: number; payoutAccountId: string }) {
  const response = await apiClient.post<ApiSuccess<Withdrawal>>('/driver/withdrawals', input);
  return response.data.data;
}

export async function listWithdrawals(params: { page?: number; limit?: number } = {}) {
  const response = await apiClient.get<ApiSuccess<Withdrawal[]>>('/driver/withdrawals', { params });
  return { data: response.data.data, meta: response.data.meta };
}

export async function apply(input: { nidNumber: string; licenseNumber: string; licenseExpiry: string }) {
  const response = await apiClient.post<ApiSuccess<unknown>>('/driver/apply', input);
  return response.data.data;
}

export interface DocumentInput {
  fileUrl: string;
  docNumber?: string;
  issueDate?: string;
  expiryDate?: string;
}

export async function listDocuments() {
  const response = await apiClient.get<ApiSuccess<DriverDocument[]>>('/driver/documents');
  return response.data.data;
}

export async function addDocument(docType: DriverDocType, input: DocumentInput) {
  const response = await apiClient.post<ApiSuccess<DriverDocument>>('/driver/documents', { docType, ...input });
  return response.data.data;
}

export async function listVehicles() {
  const response = await apiClient.get<ApiSuccess<DriverVehicle[]>>('/driver/vehicles');
  return response.data.data;
}

export async function addVehicle(input: { categoryId: number; registrationNo: string; brand?: string; model?: string; modelYear?: number; color?: string }) {
  const response = await apiClient.post<ApiSuccess<DriverVehicle>>('/driver/vehicles', input);
  return response.data.data;
}

export async function activateVehicle(vehicleId: string) {
  const response = await apiClient.put<ApiSuccess<DriverVehicle>>(`/driver/vehicles/${vehicleId}/activate`);
  return response.data.data;
}

export async function listVehicleDocuments(vehicleId: string) {
  const response = await apiClient.get<ApiSuccess<DriverDocument[]>>(`/driver/vehicles/${vehicleId}/documents`);
  return response.data.data;
}

export async function addVehicleDocument(vehicleId: string, docType: VehicleDocType, input: DocumentInput) {
  const response = await apiClient.post<ApiSuccess<DriverDocument>>(`/driver/vehicles/${vehicleId}/documents`, { docType, ...input });
  return response.data.data;
}
