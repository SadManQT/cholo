import { apiClient } from './client';
import type { ApiSuccess } from '../types/api.types';
import type { User } from '../types/user.types';

export async function getMe(): Promise<User> {
  const { data } = await apiClient.get<ApiSuccess<User>>('/me');
  return data.data;
}
