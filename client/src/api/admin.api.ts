import { apiClient } from './client';
import type { ApiSuccess } from '../types/api.types';
import type { WithdrawalQueueRow, WithdrawalStatus } from '../types/earnings.types';

export async function listWithdrawalQueue(params: {
  status?: WithdrawalStatus;
  page?: number;
  limit?: number;
} = {}) {
  const response = await apiClient.get<ApiSuccess<WithdrawalQueueRow[]>>('/admin/withdrawals', { params });
  return { data: response.data.data, meta: response.data.meta };
}

export async function approveWithdrawal(id: string) {
  const response = await apiClient.post<ApiSuccess<{ id: string; status: WithdrawalStatus }>>(
    `/admin/withdrawals/${id}/approve`,
  );
  return response.data.data;
}

export async function rejectWithdrawal(id: string, reason: string) {
  const response = await apiClient.post<ApiSuccess<{ id: string; status: WithdrawalStatus }>>(
    `/admin/withdrawals/${id}/reject`,
    { reason },
  );
  return response.data.data;
}
