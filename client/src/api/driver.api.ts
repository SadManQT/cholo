import { apiClient } from './client';
import type { ApiSuccess } from '../types/api.types';
import type {
  DailyEarning, EarningTripRow, PayoutAccount, PayoutAccountType, Withdrawal,
} from '../types/earnings.types';
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
