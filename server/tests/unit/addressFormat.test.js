import assert from 'node:assert/strict';
import { test } from 'node:test';

import { formatCompactAddress, stripAdminSuffix } from '../../src/utils/addressFormat.js';

test('formatCompactAddress joins primary/area/city with commas', () => {
  const result = formatCompactAddress({ primary: 'Gulshan 2', area: 'Gulshan', city: 'Dhaka', fallback: 'unused' });
  assert.equal(result, 'Gulshan 2, Gulshan, Dhaka');
});

test('formatCompactAddress drops a case-insensitive duplicate between primary/area/city', () => {
  // primary falls back to the area's own value when there's no separate
  // POI/road name — area would otherwise repeat it right after.
  const result = formatCompactAddress({ primary: 'Lalmatia', area: 'Lalmatia', city: 'Dhaka', fallback: 'unused' });
  assert.equal(result, 'Lalmatia, Dhaka');
});

test('formatCompactAddress skips missing (null/undefined) segments without leaving stray commas', () => {
  const result = formatCompactAddress({ primary: 'Gulshan', area: undefined, city: 'Dhaka', fallback: 'unused' });
  assert.equal(result, 'Gulshan, Dhaka');
});

test('formatCompactAddress uses the fallback when every segment is missing', () => {
  const result = formatCompactAddress({ primary: null, area: null, city: null, fallback: 'raw display name' });
  assert.equal(result, 'raw display name');
});

test('stripAdminSuffix removes a trailing "Metropolitan" or "District"', () => {
  assert.equal(stripAdminSuffix('Dhaka Metropolitan'), 'Dhaka');
  assert.equal(stripAdminSuffix('Dhaka District'), 'Dhaka');
});

test('stripAdminSuffix leaves a plain city name untouched', () => {
  assert.equal(stripAdminSuffix('Dhaka'), 'Dhaka');
});

test('stripAdminSuffix passes through undefined (no city/county field at all)', () => {
  assert.equal(stripAdminSuffix(undefined), undefined);
});
