// Pure fare arithmetic — no req/res, no SQL, no I/O (doc 08-09-10 §6: "a
// pure function → unit-testable"). Mirrors the exact identity the database
// enforces on `trips` via chk_fare_identity (doc 03 §2):
//
//   total = base + distance + time + waiting + surge + booking - discount
//
// A pre-trip quote has no waiting time (the trip hasn't started) and no
// discount (promos are redeemed at booking/completion, doc 01 relationship
// #60), so both default to 0 — the shape stays identical to what `trips`
// will later store, on purpose (doc 01 §13.7: rules explain "what would
// this cost now?", snapshots explain "why did it cost that?"). Completion
// passes a real waitingMinutes; discount stays 0 here regardless (promo
// redemption is roadmap M7 step 21e, not built yet).

function round2(amount) {
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

  // minimum_fare guards the ride cost itself, before surge/booking fee are
  // layered on — the shortfall folds into distanceFare (the variable
  // component) so base_fare stays a pure copy of the tariff's constant.
  if (rideCost < tariff.minimumFare) {
    distanceFare = round2(distanceFare + (tariff.minimumFare - rideCost));
    rideCost = tariff.minimumFare;
  }

  const surgeAmount = round2(rideCost * (surgeMultiplier - 1));
  const totalFare = round2(
    baseFare + distanceFare + timeFare + waitingFare + surgeAmount + bookingFee - discountAmount,
  );

  return {
    baseFare,
    distanceFare,
    timeFare,
    waitingFare,
    surgeAmount,
    bookingFee,
    discountAmount,
    totalFare,
  };
}
