import { round2 } from './fareMath.js';

// Mirrors chk_driver_earnings_identity (schema.sql):
//   net_earning = gross_fare - commission_amount
// commissionAmount is rounded first, then netEarning is derived from the
// two already-rounded numbers (never re-rounded independently) — the same
// discipline fareMath.js's quote() uses for chk_fare_identity, so the
// CHECK constraint can never disagree with what the app computed.
export function computeCommission({ grossFare, commissionPct }) {
  const commissionAmount = round2(grossFare * (commissionPct / 100));
  const netEarning = round2(grossFare - commissionAmount);

  return { commissionAmount, netEarning };
}
