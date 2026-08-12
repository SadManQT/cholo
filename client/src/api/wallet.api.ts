import { apiClient } from './client';
import type { ApiSuccess } from '../types/api.types';
import type { Wallet, WalletTransaction } from '../types/wallet.types';

export async function getWallet() {
  const response = await apiClient.get<ApiSuccess<Wallet>>('/wallet');
  return response.data.data;
}

export async function listTransactions(params: { page?: number; limit?: number } = {}) {
  const response = await apiClient.get<ApiSuccess<WalletTransaction[]>>('/wallet/transactions', { params });
  return { data: response.data.data, meta: response.data.meta };
}
