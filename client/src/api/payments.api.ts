import { apiClient } from './client';
import type { ApiSuccess } from '../types/api.types';

export type GatewayMethod = 'bkash' | 'nagad' | 'card';

export interface PaymentSummary {
  publicId: string;
  purpose: 'trip' | 'wallet_topup';
  methodType: string;
  amount: string;
  status: 'initiated' | 'pending' | 'succeeded' | 'failed' | 'refunded';
  completedAt: string | null;
  tripCode: string | null;
}

export async function getPayment(publicId: string) {
  const response = await apiClient.get<ApiSuccess<PaymentSummary>>(`/payments/${publicId}`);
  return response.data.data;
}

export async function topup(amount: number, method: GatewayMethod) {
  const response = await apiClient.post<ApiSuccess<{ redirectUrl: string; payment: { publicId: string } }>>('/wallet/topup', { amount, method });
  return response.data.data;
}

type PayTripResult =
  | { status: 'paid' | 'unpaid'; method: 'wallet' }
  | { status: 'pending_redirect'; method: GatewayMethod; redirectUrl: string };

export async function payTrip(tripCode: string, method: 'wallet' | GatewayMethod) {
  const response = await apiClient.post<ApiSuccess<PayTripResult>>(`/trips/${encodeURIComponent(tripCode)}/pay`, { method });
  return response.data.data;
}
