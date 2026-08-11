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

export function formatDistance(value: number | null | undefined) {
  if (value == null) return '—';
  return `${value.toFixed(value < 10 ? 1 : 0)} km`;
}
