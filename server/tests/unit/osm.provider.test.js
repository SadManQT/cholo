import assert from 'node:assert/strict';
import { afterEach, mock, test } from 'node:test';

import { geocode, reverseGeocode, route } from '../../src/services/providers/osm.provider.js';

function jsonResponse(body, { ok = true } = {}) {
  return { ok, json: async () => body };
}

afterEach(() => {
  mock.restoreAll();
});

test('route() calls OSRM with lng,lat coordinate order and returns distance/duration', async () => {
  const fetchMock = mock.method(globalThis, 'fetch', async (url) => {
    assert.match(url, /\/route\/v1\/driving\/90\.4078,23\.7925;90\.3742,23\.7461/);
    assert.match(url, /alternatives=3/);
    assert.match(url, /overview=full/);
    assert.match(url, /geometries=geojson/);
    return jsonResponse({
      code: 'Ok',
      routes: [{
        distance: 9214.4,
        duration: 542.1,
        geometry: { coordinates: [[90.4078, 23.7925], [90.3742, 23.7461]] },
      }],
    });
  });

  const result = await route({ lat: 23.7925, lng: 90.4078 }, { lat: 23.7461, lng: 90.3742 });

  assert.deepEqual(result, {
    distanceKm: 9.21,
    durationMin: 9,
    path: [{ lat: 23.7925, lng: 90.4078 }, { lat: 23.7461, lng: 90.3742 }],
    alternatives: [],
  });
  assert.equal(fetchMock.mock.callCount(), 1);
});

test('route() selects the shortest returned road path and keeps other alternatives', async () => {
  mock.method(globalThis, 'fetch', async () => jsonResponse({
    code: 'Ok',
    routes: [
      {
        distance: 10_200,
        duration: 600,
        geometry: { coordinates: [[90.1, 23.1], [90.3, 23.3]] },
      },
      {
        distance: 8_400,
        duration: 720,
        geometry: { coordinates: [[90.1, 23.1], [90.2, 23.2], [90.3, 23.3]] },
      },
    ],
  }));

  const result = await route({ lat: 23.1, lng: 90.1 }, { lat: 23.3, lng: 90.3 });

  assert.equal(result.distanceKm, 8.4);
  assert.equal(result.durationMin, 12);
  assert.equal(result.path.length, 3);
  assert.equal(result.alternatives.length, 1);
  assert.equal(result.alternatives[0].distanceKm, 10.2);
});

test('route() throws ROUTE_NOT_FOUND when OSRM reports no route', async () => {
  mock.method(globalThis, 'fetch', async () => jsonResponse({ code: 'NoRoute', routes: [] }));

  await assert.rejects(
    () => route({ lat: 0, lng: 0 }, { lat: 1, lng: 1 }),
    (error) => {
      assert.equal(error.status, 422);
      assert.equal(error.code, 'ROUTE_NOT_FOUND');
      return true;
    },
  );
});

test('route() throws GEO_PROVIDER_UNAVAILABLE when the upstream request fails', async () => {
  mock.method(globalThis, 'fetch', async () => {
    throw new Error('network down');
  });

  await assert.rejects(
    () => route({ lat: 0, lng: 0 }, { lat: 1, lng: 1 }),
    (error) => {
      assert.equal(error.status, 503);
      assert.equal(error.code, 'GEO_PROVIDER_UNAVAILABLE');
      return true;
    },
  );
});

test('route() throws GEO_PROVIDER_UNAVAILABLE on a non-ok HTTP response', async () => {
  mock.method(globalThis, 'fetch', async () => jsonResponse({}, { ok: false }));

  await assert.rejects(
    () => route({ lat: 0, lng: 0 }, { lat: 1, lng: 1 }),
    (error) => {
      assert.equal(error.status, 503);
      assert.equal(error.code, 'GEO_PROVIDER_UNAVAILABLE');
      return true;
    },
  );
});

test('geocode() sends a descriptive User-Agent (Nominatim usage policy) and parses the first match', async () => {
  const fetchMock = mock.method(globalThis, 'fetch', async (url, options) => {
    assert.match(url, /\/search\?q=Gulshan%202/);
    assert.match(options.headers['User-Agent'], /Cholo/);
    assert.match(url, /countrycodes=bd/);
    assert.match(url, /addressdetails=1/);
    return jsonResponse([{
      lat: '23.7925',
      lon: '90.4078',
      display_name: 'Gulshan 2, Dhaka',
      address: { country_code: 'bd' },
    }]);
  });

  const result = await geocode('Gulshan 2');

  assert.deepEqual(result, {
    lat: 23.7925,
    lng: 90.4078,
    address: 'Gulshan 2, Dhaka',
    countryCode: 'bd',
  });
  assert.equal(fetchMock.mock.callCount(), 1);
});

test('geocode() throws ADDRESS_NOT_FOUND when Nominatim returns no matches', async () => {
  mock.method(globalThis, 'fetch', async () => jsonResponse([]));

  await assert.rejects(
    () => geocode('somewhere that does not exist'),
    (error) => {
      assert.equal(error.status, 422);
      assert.equal(error.code, 'ADDRESS_NOT_FOUND');
      return true;
    },
  );
});

test('reverseGeocode() returns the resolved address', async () => {
  mock.method(globalThis, 'fetch', async (url) => {
    assert.match(url, /\/reverse\?lat=23\.7925&lon=90\.4078/);
    assert.match(url, /addressdetails=1/);
    return jsonResponse({ display_name: 'Gulshan 2, Dhaka', address: { country_code: 'bd' } });
  });

  const result = await reverseGeocode(23.7925, 90.4078);
  assert.deepEqual(result, { address: 'Gulshan 2, Dhaka', countryCode: 'bd' });
});

test('reverseGeocode() throws ADDRESS_NOT_FOUND when Nominatim reports an error', async () => {
  mock.method(globalThis, 'fetch', async () => jsonResponse({ error: 'Unable to geocode' }));

  await assert.rejects(
    () => reverseGeocode(0, 0),
    (error) => {
      assert.equal(error.status, 422);
      assert.equal(error.code, 'ADDRESS_NOT_FOUND');
      return true;
    },
  );
});
