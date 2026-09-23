import { apiClient } from './client';
import type { ApiSuccess } from '../types/api.types';

export const ACCEPTED_UPLOAD_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export async function uploadFile(file: File): Promise<string> {
  const response = await apiClient.post<ApiSuccess<{ url: string }>>('/uploads', file, {
    headers: { 'Content-Type': file.type },
  });
  return response.data.data.url;
}
