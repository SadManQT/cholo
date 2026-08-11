import assert from 'node:assert/strict';
import { test } from 'node:test';

import { haversineDistanceKm } from '../../src/utils/haversine.js';

test('haversineDistanceKm returns 0 for identical points', () => {
  assert.equal(haversineDistanceKm(23.7925, 90.4078, 23.7925, 90.4078), 0);
});

test('haversineDistanceKm matches the known Gulshan-2 -> Dhanmondi-27 straight-line distance', () => {
  // ~6.9km straight-line (the 9.21km OSRM route used elsewhere in these
  // tests is the DRIVING distance, which is always >= straight-line).
  const distance = haversineDistanceKm(23.7925, 90.4078, 23.7461, 90.3742);
  assert.ok(distance > 6 && distance < 8, `expected ~6-8km, got ${distance}`);
});

test('haversineDistanceKm is symmetric', () => {
  const a = haversineDistanceKm(23.79, 90.40, 23.75, 90.38);
  const b = haversineDistanceKm(23.75, 90.38, 23.79, 90.40);
  assert.equal(Math.round(a * 1000), Math.round(b * 1000));
});

test('haversineDistanceKm scales roughly linearly for small offsets (sanity check on the formula)', () => {
  const oneKmish = haversineDistanceKm(23.79, 90.40, 23.799, 90.40); // ~1km of latitude
  assert.ok(oneKmish > 0.9 && oneKmish < 1.1, `expected ~1km, got ${oneKmish}`);
});
