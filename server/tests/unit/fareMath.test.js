import assert from 'node:assert/strict';
import { test } from 'node:test';

import { quote } from '../../src/utils/fareMath.js';

const carTariff = {
  baseFare: 60,
  perKmRate: 22,
  perMinRate: 2.5,
  minimumFare: 120,
  bookingFee: 10,
};

function assertIdentity(fare) {
  const sum = fare.baseFare + fare.distanceFare + fare.timeFare
    + fare.waitingFare + fare.surgeAmount + fare.bookingFee - fare.discountAmount;
  assert.equal(Math.round(sum * 100) / 100, fare.totalFare);
}

test('quote computes base + distance + time + booking fee for a normal trip', () => {
  const fare = quote({ tariff: carTariff, distanceKm: 9.21, durationMin: 9, surgeMultiplier: 1 });

  assert.equal(fare.baseFare, 60);
  assert.equal(fare.distanceFare, 202.62); // 9.21 * 22
  assert.equal(fare.timeFare, 22.5); // 9 * 2.5
  assert.equal(fare.waitingFare, 0);
  assert.equal(fare.surgeAmount, 0);
  assert.equal(fare.bookingFee, 10);
  assert.equal(fare.discountAmount, 0);
  assert.equal(fare.totalFare, 295.12);
  assertIdentity(fare);
});

test('quote floors the ride cost at minimum_fare for a short trip, folding the top-up into distanceFare', () => {
  // 60 base + (0.5*22=11) distance + (2*2.5=5) time = 76, below the 120 floor
  const fare = quote({ tariff: carTariff, distanceKm: 0.5, durationMin: 2, surgeMultiplier: 1 });

  const rideCost = fare.baseFare + fare.distanceFare + fare.timeFare;
  assert.equal(rideCost, 120); // floored
  assert.equal(fare.baseFare, 60); // base_fare itself is never touched
  assert.equal(fare.totalFare, 130); // 120 ride cost + 10 booking fee
  assertIdentity(fare);
});

test('quote applies surge as an amount on top of the (possibly floored) ride cost, not on booking fee', () => {
  const fare = quote({ tariff: carTariff, distanceKm: 9.21, durationMin: 9, surgeMultiplier: 1.5 });

  const rideCost = fare.baseFare + fare.distanceFare + fare.timeFare;
  assert.equal(fare.surgeAmount, Math.round(rideCost * 0.5 * 100) / 100);
  assert.equal(fare.totalFare, Math.round((rideCost * 1.5 + fare.bookingFee) * 100) / 100);
  assertIdentity(fare);
});

test('quote defaults surgeMultiplier to 1 (no surge) when omitted', () => {
  const fare = quote({ tariff: carTariff, distanceKm: 9.21, durationMin: 9 });
  assert.equal(fare.surgeAmount, 0);
});

test('quote never returns a negative distanceFare even when the minimum-fare top-up exceeds it', () => {
  // 0 km, 0 min: ride cost is just base_fare (60), still below the 120 floor
  const fare = quote({ tariff: carTariff, distanceKm: 0, durationMin: 0, surgeMultiplier: 1 });

  assert.equal(fare.distanceFare, 60); // absorbs the entire 60 shortfall
  assert.ok(fare.distanceFare >= 0);
  assertIdentity(fare);
});

test('quote defaults waitingMinutes to 0 (pre-trip quotes have no waiting yet)', () => {
  const fare = quote({ tariff: carTariff, distanceKm: 9.21, durationMin: 9 });
  assert.equal(fare.waitingFare, 0);
});

test('quote bills only waiting time beyond free_wait_minutes, at waiting_per_min', () => {
  const waitingTariff = { ...carTariff, waitingPerMin: 3, freeWaitMinutes: 1 };
  const fare = quote({
    tariff: waitingTariff, distanceKm: 9.21, durationMin: 9, waitingMinutes: 5,
  });

  assert.equal(fare.waitingFare, 12); // (5 - 1) * 3
  assert.equal(fare.totalFare, 307.12); // 295.12 + 12
  assertIdentity(fare);
});

test('quote charges nothing when waiting stays within free_wait_minutes', () => {
  const waitingTariff = { ...carTariff, waitingPerMin: 3, freeWaitMinutes: 5 };
  const fare = quote({
    tariff: waitingTariff, distanceKm: 9.21, durationMin: 9, waitingMinutes: 3,
  });

  assert.equal(fare.waitingFare, 0);
  assertIdentity(fare);
});

test('quote treats a tariff with no waiting fields (waitingPerMin/freeWaitMinutes undefined) as zero, not NaN', () => {
  const fare = quote({ tariff: carTariff, distanceKm: 9.21, durationMin: 9, waitingMinutes: 5 });
  assert.equal(fare.waitingFare, 0);
  assert.ok(!Number.isNaN(fare.totalFare));
  assertIdentity(fare);
});
