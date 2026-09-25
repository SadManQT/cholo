import { locale, t } from '../i18n';

export function formatBDT(value: string | number | null | undefined) {
  const amount = Number(value ?? 0);
  const sign = amount < 0 ? '-' : '';
  return `${sign}৳${new Intl.NumberFormat(locale, {
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(amount))}`;
}

export function formatDateTime(value: string | null | undefined) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Dhaka',
  }).format(date);
}

export function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  // A bare calendar date ("2031-01-01") has no zone; a timestamp is shown as the Dhaka calendar day.
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const date = new Date(dateOnly ? `${value}T00:00:00Z` : value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeZone: dateOnly ? 'UTC' : 'Asia/Dhaka',
  }).format(date);
}

export function formatDistance(value: number | null | undefined) {
  if (value == null) return '—';
  return t('{0} km', new Intl.NumberFormat(locale, { maximumFractionDigits: value < 10 ? 1 : 0, minimumFractionDigits: value < 10 ? 1 : 0 }).format(value));
}

const dhakaDateFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka' });

/** YYYY-MM-DD in Bangladesh time (not UTC), optionally shifted by whole days. */
export function dhakaDate(offsetDays = 0) {
  return dhakaDateFormatter.format(new Date(Date.now() + offsetDays * 86_400_000));
}

/** "2026-09" → "September 2026". */
export function formatMonth(month: string) {
  return new Date(`${month}-01T00:00:00+06:00`).toLocaleDateString(locale === 'bn-BD' ? 'bn-BD' : 'en-GB', { month: 'long', year: 'numeric', timeZone: 'Asia/Dhaka' });
}
