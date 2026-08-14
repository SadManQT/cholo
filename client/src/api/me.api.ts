import { apiClient } from './client';
import type { ApiSuccess } from '../types/api.types';
import type { User } from '../types/user.types';

export async function getMe(): Promise<User> {
  const { data } = await apiClient.get<ApiSuccess<User>>('/me');
  return data.data;
}

export async function updateMe(input: {
  fullName?: string;
  email?: string;
  photoUrl?: string;
  preferredLanguage?: 'bn' | 'en';
}): Promise<User> {
  const { data } = await apiClient.patch<ApiSuccess<User>>('/me', input);
  return data.data;
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await apiClient.patch('/me/password', { currentPassword, newPassword });
}
