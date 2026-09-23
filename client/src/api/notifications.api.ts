import { apiClient } from './client';
import type { ApiSuccess } from '../types/api.types';
import type { AppNotification } from '../types/notification.types';

export async function listNotifications(page = 1) {
  const response = await apiClient.get<ApiSuccess<AppNotification[]>>('/notifications', { params: { page, limit: 30 } });
  return { data: response.data.data, unread: response.data.meta?.unread ?? 0 };
}

export async function markRead(ids?: string[]) {
  await apiClient.post('/notifications/read', ids ? { ids } : {});
}
