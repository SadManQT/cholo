export function formatBDT(value: string | number | null | undefined) {
  const amount = Number(value ?? 0);
  return `৳${new Intl.NumberFormat('en-BD', {
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount)}`;
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-BD', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Dhaka',
  }).format(new Date(value));
}

// For a bare "YYYY-MM-DD" (a DATE column, not TIMESTAMPTZ — e.g.
// v_driver_daily_earnings.earning_date) — formatDateTime would also show
// a spurious midnight time component, which is wrong for a whole-day row.
export function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-BD', {
    dateStyle: 'medium',
    timeZone: 'UTC', // the DATE string has no time/zone of its own — don't let the browser's local zone shift it a day
  }).format(new Date(`${value}T00:00:00Z`));
}

export function formatDistance(value: number | null | undefined) {
  if (value == null) return '—';
  return `${value.toFixed(value < 10 ? 1 : 0)} km`;
}
