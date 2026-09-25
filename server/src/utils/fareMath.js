
export function round2(amount) {
  return Math.round(amount * 100) / 100;
}

export function quote({ tariff, distanceKm, durationMin, surgeMultiplier = 1, waitingMinutes = 0 }) {
  const baseFare = round2(tariff.baseFare);
  const timeFare = round2(durationMin * tariff.perMinRate);
  const billableWaitingMinutes = Math.max(0, waitingMinutes - (tariff.freeWaitMinutes ?? 0));
  const waitingFare = round2(billableWaitingMinutes * (tariff.waitingPerMin ?? 0));
  const bookingFee = round2(tariff.bookingFee);
  const discountAmount = 0;

  let distanceFare = round2(distanceKm * tariff.perKmRate);
  let rideCost = round2(baseFare + distanceFare + timeFare);

  if (rideCost < tariff.minimumFare) {
    distanceFare = round2(distanceFare + (tariff.minimumFare - rideCost));
    rideCost = tariff.minimumFare;
  }

  const surgeAmount = round2(rideCost * (surgeMultiplier - 1));
  const exactTotal = round2(
    baseFare + distanceFare + timeFare + waitingFare + surgeAmount + bookingFee - discountAmount,
  );

  // Riders pay whole taka. The rounding difference (at most ±0.50) goes into a fare line so the
  // breakdown still adds up to the total (chk_fare_identity).
  const totalFare = Math.round(exactTotal);
  const roundingAdjustment = round2(totalFare - exactTotal);
  let adjustedBaseFare = baseFare;
  if (distanceFare + roundingAdjustment >= 0) distanceFare = round2(distanceFare + roundingAdjustment);
  else adjustedBaseFare = round2(baseFare + roundingAdjustment);

  return {
    baseFare: adjustedBaseFare,
    distanceFare,
    timeFare,
    waitingFare,
    surgeAmount,
    bookingFee,
    discountAmount,
    totalFare,
  };
}
