import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isPointInsideBangladesh,
  isRouteInsideBangladesh,
} from '../../src/utils/bangladeshBoundary.js';

test('country boundary accepts representative Bangladesh locations', () => {
  assert.equal(isPointInsideBangladesh({ lat: 23.8103, lng: 90.4125 }), true); // Dhaka
  assert.equal(isPointInsideBangladesh({ lat: 24.8949, lng: 91.8687 }), true); // Sylhet
  assert.equal(isPointInsideBangladesh({ lat: 26.4880, lng: 88.3400 }), true); // Tetulia border area
});

test('country boundary rejects India points that still sit inside the old rectangle', () => {
  assert.equal(isPointInsideBangladesh({ lat: 22.5726, lng: 88.3639 }), false); // Kolkata
  assert.equal(isPointInsideBangladesh({ lat: 23.8315, lng: 91.2868 }), false); // Agartala
});

test('route validation rejects a polyline that exits into India and re-enters Bangladesh', () => {
  assert.equal(isRouteInsideBangladesh([
    { lat: 23.8103, lng: 90.4125 },
    { lat: 23.8315, lng: 91.2868 },
    { lat: 24.8949, lng: 91.8687 },
  ]), false);
});

test('route validation accepts a domestic road-like polyline', () => {
  assert.equal(isRouteInsideBangladesh([
    { lat: 23.8103, lng: 90.4125 },
    { lat: 24.0064, lng: 90.4172 },
    { lat: 24.4547, lng: 90.7816 },
  ]), true);
});
