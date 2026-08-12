// The raw account number is never stored (driver_payout_accounts.
// account_no_masked is the only column for it, schema.sql's own comment:
// "numbers stored masked") — this is the one place the raw digits ever
// exist in the app, just long enough to compute what to keep.
export function maskAccountNumber(raw) {
  const digitsOnly = String(raw).replace(/\D/g, '');
  const last4 = digitsOnly.slice(-4);
  return `${'*'.repeat(Math.max(digitsOnly.length - 4, 4))}${last4}`;
}
