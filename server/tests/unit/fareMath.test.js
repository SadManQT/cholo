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
  assert.equal(fare.distanceFare, 202.5);
  assert.equal(fare.timeFare, 22.5);
  assert.equal(fare.waitingFare, 0);
  assert.equal(fare.surgeAmount, 0);
  assert.equal(fare.bookingFee, 10);
  assert.equal(fare.discountAmount, 0);
  assert.equal(fare.totalFare, 295);
  assertIdentity(fare);
});

test('quote floors the ride cost at minimum_fare for a short trip, folding the top-up into distanceFare', () => {
  const fare = quote({ tariff: carTariff, distanceKm: 0.5, durationMin: 2, surgeMultiplier: 1 });

  const rideCost = fare.baseFare + fare.distanceFare + fare.timeFare;
  assert.equal(rideCost, 120);
  assert.equal(fare.baseFare, 60);
  assert.equal(fare.totalFare, 130);
  assertIdentity(fare);
});

test('quote applies surge as an amount on top of the (possibly floored) ride cost, not on booking fee', () => {
  const fare = quote({ tariff: carTariff, distanceKm: 9.21, durationMin: 9, surgeMultiplier: 1.5 });

  const unsurged = quote({ tariff: carTariff, distanceKm: 9.21, durationMin: 9, surgeMultiplier: 1 });
  const exactRideCost = 60 + 202.62 + 22.5;
  assert.equal(fare.surgeAmount, Math.round(exactRideCost * 0.5 * 100) / 100);
  assert.equal(fare.totalFare, Math.round(exactRideCost * 1.5 + fare.bookingFee));
  assert.ok(fare.totalFare > unsurged.totalFare);
  assertIdentity(fare);
});

test('quote defaults surgeMultiplier to 1 (no surge) when omitted', () => {
  const fare = quote({ tariff: carTariff, distanceKm: 9.21, durationMin: 9 });
  assert.equal(fare.surgeAmount, 0);
});

test('quote never returns a negative distanceFare even when the minimum-fare top-up exceeds it', () => {
  const fare = quote({ tariff: carTariff, distanceKm: 0, durationMin: 0, surgeMultiplier: 1 });

  assert.equal(fare.distanceFare, 60);
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

  assert.equal(fare.waitingFare, 12);
  assert.equal(fare.totalFare, 307);
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

test('quote always returns a whole-taka total and keeps the breakdown adding up', () => {
  for (const distanceKm of [0, 0.37, 3.33, 9.21, 17.77]) {
    for (const surgeMultiplier of [1, 1.25, 1.7]) {
      const fare = quote({ tariff: carTariff, distanceKm, durationMin: 7, surgeMultiplier });
      assert.equal(fare.totalFare, Math.round(fare.totalFare));
      assert.ok(fare.distanceFare >= 0 && fare.baseFare >= 0);
      assertIdentity(fare);
    }
  }
});
