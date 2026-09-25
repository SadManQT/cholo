import { apiClient } from './client';
import type { ApiSuccess } from '../types/api.types';

export const ACCEPTED_UPLOAD_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/** Identity and vehicle documents go private: the API only ever shows them through expiring links. */
export async function uploadFile(file: File, { isPrivate = false } = {}): Promise<string> {
  const response = await apiClient.post<ApiSuccess<{ url: string }>>('/uploads', file, {
    headers: { 'Content-Type': file.type },
    params: isPrivate ? { private: 'true' } : undefined,
  });
  return response.data.data.url;
}
