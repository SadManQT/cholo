import { round2 } from './fareMath.js';

export function computeCommission({ grossFare, commissionPct }) {
  const commissionAmount = round2(grossFare * (commissionPct / 100));
  const netEarning = round2(grossFare - commissionAmount);

  return { commissionAmount, netEarning };
}
