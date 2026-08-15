import assert from 'node:assert/strict';
import { afterEach, mock, test } from 'node:test';

import { geocode, reverseGeocode, search } from '../../src/services/providers/photon.provider.js';

function jsonResponse(body, { ok = true } = {}) {
  return { ok, json: async () => body };
}

function feature({ lng, lat, ...properties }) {
  return { type: 'Feature', properties, geometry: { type: 'Point', coordinates: [lng, lat] } };
}

afterEach(() => {
  mock.restoreAll();
});

test('geocode() sends a Bangladesh bbox and a descriptive User-Agent, and parses the first match', async () => {
  const fetchMock = mock.method(globalThis, 'fetch', async (url, options) => {
    assert.match(url, /\/api\/\?q=Gulshan/);
    assert.match(url, /bbox=88\.01,20\.34,92\.68,26\.64/);
    assert.match(options.headers['User-Agent'], /Cholo/);
    return jsonResponse({
      features: [feature({
        lat: 23.7921765, lng: 90.4155528, name: 'Gulshan',
        district: 'Gulshan', city: 'Dhaka', countrycode: 'BD',
      })],
    });
  });

  const result = await geocode('Gulshan');

  assert.deepEqual(result, { lat: 23.7921765, lng: 90.4155528, address: 'Gulshan, Dhaka', countryCode: 'bd' });
  assert.equal(fetchMock.mock.callCount(), 1);
});

test('geocode() throws ADDRESS_NOT_FOUND when Photon returns no features', async () => {
  mock.method(globalThis, 'fetch', async () => jsonResponse({ features: [] }));

  await assert.rejects(
    () => geocode('somewhere that does not exist'),
    (error) => {
      assert.equal(error.status, 422);
      assert.equal(error.code, 'ADDRESS_NOT_FOUND');
      return true;
    },
  );
});

test('geocode() builds a compact address from Photon\'s field names (street/district/city), dropping postcode/county/state/country', async () => {
  mock.method(globalThis, 'fetch', async () => jsonResponse({
    features: [feature({
      lat: 23.7640558, lng: 90.3856872, name: 'Bangladesh Military Museum',
      street: 'Bijoy Sharani', locality: 'Elenbari', district: 'Tejgaon', city: 'Dhaka',
      county: 'Dhaka Metropolitan', state: 'Dhaka Division', postcode: '1215',
      country: 'Bangladesh', countrycode: 'BD',
    })],
  }));

  const result = await geocode('Bangladesh Military Museum');

  assert.equal(result.address, 'Bangladesh Military Museum, Tejgaon, Dhaka');
});

// The exact edge case that motivated switching providers in the first
// place — Nominatim returns nothing at all for a misspelled query, Photon's
// Elasticsearch-backed fuzzy matching still finds it.
test('geocode() resolves a misspelled query via fuzzy matching', async () => {
  mock.method(globalThis, 'fetch', async () => jsonResponse({
    features: [feature({
      lat: 23.7921765, lng: 90.4155528, name: 'Gulshan',
      district: 'Gulshan', city: 'Dhaka', countrycode: 'BD',
    })],
  }));

  const result = await geocode('Gulshsn'); // typo, missing the second 'a'

  assert.equal(result.address, 'Gulshan, Dhaka');
});

test('search() returns every candidate with a compact address, not just the first', async () => {
  const fetchMock = mock.method(globalThis, 'fetch', async (url) => {
    assert.match(url, /limit=5/);
    return jsonResponse({
      features: [
        feature({ lat: 23.7947191, lng: 90.4136986, name: 'Gulshan 2', district: 'Gulshan', city: 'Dhaka', countrycode: 'BD' }),
        feature({ lat: 23.7925, lng: 90.4078, name: 'Gulshan 1', district: 'Gulshan', city: 'Dhaka', countrycode: 'BD' }),
      ],
    });
  });

  const results = await search('Gulshan');

  assert.equal(results.length, 2);
  assert.equal(results[0].address, 'Gulshan 2, Gulshan, Dhaka');
  assert.equal(results[1].address, 'Gulshan 1, Gulshan, Dhaka');
  assert.equal(fetchMock.mock.callCount(), 1);
});

test('search() returns an empty array (not an error) when Photon has no matches yet', async () => {
  mock.method(globalThis, 'fetch', async () => jsonResponse({ features: [] }));

  const results = await search('xyz');

  assert.deepEqual(results, []);
});

test('reverseGeocode() returns the nearest feature\'s compact address', async () => {
  mock.method(globalThis, 'fetch', async (url) => {
    assert.match(url, /\/reverse\?lat=23\.7461&lon=90\.3742/);
    return jsonResponse({
      features: [feature({
        lat: 23.7459545, lng: 90.3740852, name: 'Academia',
        district: 'Dhanmondi', city: 'Dhaka', countrycode: 'BD',
      })],
    });
  });

  const result = await reverseGeocode(23.7461, 90.3742);

  assert.deepEqual(result, { address: 'Academia, Dhanmondi, Dhaka', countryCode: 'bd' });
});

test('reverseGeocode() throws ADDRESS_NOT_FOUND when Photon has no nearby feature', async () => {
  mock.method(globalThis, 'fetch', async () => jsonResponse({ features: [] }));

  await assert.rejects(
    () => reverseGeocode(0, 0),
    (error) => {
      assert.equal(error.status, 422);
      assert.equal(error.code, 'ADDRESS_NOT_FOUND');
      return true;
    },
  );
});

test('geocode() throws GEO_PROVIDER_UNAVAILABLE when the request itself fails', async () => {
  mock.method(globalThis, 'fetch', async () => { throw new Error('network down'); });

  await assert.rejects(
    () => geocode('Gulshan'),
    (error) => {
      assert.equal(error.status, 503);
      assert.equal(error.code, 'GEO_PROVIDER_UNAVAILABLE');
      return true;
    },
  );
});
