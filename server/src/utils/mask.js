export function maskAccountNumber(raw) {
  const digitsOnly = String(raw).replace(/\D/g, '');
  const last4 = digitsOnly.slice(-4);
  return `${'*'.repeat(Math.max(digitsOnly.length - 4, 4))}${last4}`;
}
