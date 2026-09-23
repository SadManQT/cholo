import { apiClient } from './client';
import type { ApiSuccess } from '../types/api.types';

export interface AvailablePromo {
  code: string;
  description: string | null;
  promoType: 'percentage' | 'fixed_amount';
  value: number;
  maxDiscount: number | null;
  minFare: number | null;
  validUntil: string | null;
}

export async function listAvailable(cityId: number) {
  const response = await apiClient.get<ApiSuccess<AvailablePromo[]>>('/promos/available', { params: { cityId } });
  return response.data.data;
}
