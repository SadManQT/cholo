import { isAxiosError } from 'axios';
import type { ApiErrorBody } from '../types/api.types';

interface FieldIssue {
  field: string;
  issue: string;
}

function fieldIssues(error: unknown): FieldIssue[] {
  if (!isAxiosError<ApiErrorBody>(error)) return [];
  const details = error.response?.data?.error?.details;
  return Array.isArray(details) ? details.filter((d): d is FieldIssue => typeof d?.field === 'string' && typeof d?.issue === 'string') : [];
}

export function getApiErrorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (isAxiosError<ApiErrorBody>(error)) {
    const body = error.response?.data?.error;
    // A field issue ("Password must be at least 8 characters") says what to fix; the code's message rarely does.
    const [first] = fieldIssues(error);
    if (first) return first.issue;
    if (body?.message) return body.message;
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') return 'The server took too long to respond. Please try again.';
    if (!error.response) return "Can't reach Cholo right now. Check your connection and try again.";
  }
  return fallback;
}

export function getApiErrorCode(error: unknown): string | null {
  if (isAxiosError<ApiErrorBody>(error)) return error.response?.data?.error?.code ?? null;
  return null;
}

/** Server validation issues keyed by field name, for showing under the matching input. */
export function getApiFieldErrors(error: unknown): Record<string, string> {
  const result: Record<string, string> = {};
  for (const { field, issue } of fieldIssues(error)) result[field] ??= issue;
  return result;
}

export function getSuspension(error: unknown): { reason: string | null; until: string | null } | null {
  if (!isAxiosError<ApiErrorBody>(error) || error.response?.data?.error?.code !== 'ACCOUNT_SUSPENDED') return null;
  const details = error.response.data.error.details as { reason?: string | null; until?: string | null } | undefined;
  return { reason: details?.reason ?? null, until: details?.until ?? null };
}
