export function formatBDT(value: string | number | null | undefined) {
  const amount = Number(value ?? 0);
  const sign = amount < 0 ? '-' : '';
  return `${sign}৳${new Intl.NumberFormat('en-BD', {
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(amount))}`;
}

export function formatDateTime(value: string | null | undefined) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-BD', {
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
  return new Intl.DateTimeFormat('en-BD', {
    dateStyle: 'medium',
    timeZone: dateOnly ? 'UTC' : 'Asia/Dhaka',
  }).format(date);
}

export function formatDistance(value: number | null | undefined) {
  if (value == null) return '—';
  return `${value.toFixed(value < 10 ? 1 : 0)} km`;
}
