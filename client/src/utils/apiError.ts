import { isAxiosError } from 'axios';
import type { ApiErrorBody } from '../types/api.types';

// The backend already gives a human-readable message per error code
// (server/src/utils/errorMessages.js) — this just reaches into the axios
// error for it rather than re-deriving a second copy of that catalog
// client-side.
export function getApiErrorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (isAxiosError<ApiErrorBody>(error) && error.response?.data?.error?.message) {
    return error.response.data.error.message;
  }
  return fallback;
}
