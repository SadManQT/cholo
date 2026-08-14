import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import * as osmProvider from './providers/osm.provider.js';

// The Geo Abstraction (doc 05-06-07 §8): one interface, providers behind it.
// Switching GEO_PROVIDER=osm|google in env is meant to change zero business
// code — every caller in this codebase imports THIS file, never a provider
// module directly.
const providers = {
  osm: osmProvider,
  // google: not implemented — the documented future adapter for when the
  // free OSM stack needs to be swapped for a billed one (doc 05-06-07 §8).
};

function currentProvider() {
  const provider = providers[env.GEO_PROVIDER];

  if (!provider) {
    throw new Error(`GEO_PROVIDER "${env.GEO_PROVIDER}" has no adapter implementation`);
  }

  return provider;
}

// Fast local guard used by every route/quote/request entrance. Nominatim's
// country code remains the exact border authority for an address selected
// through search or reverse-geocoding; this rectangle is also a cheap
// server-side fence against arbitrary foreign coordinates bypassing the UI.
export const BANGLADESH_BOUNDS = Object.freeze({
  south: 20.34,
  north: 26.64,
  west: 88.01,
  east: 92.68,
});

export function isWithinServiceArea({ lat, lng }) {
  return lat >= BANGLADESH_BOUNDS.south
    && lat <= BANGLADESH_BOUNDS.north
    && lng >= BANGLADESH_BOUNDS.west
    && lng <= BANGLADESH_BOUNDS.east;
}

export function assertWithinServiceArea(...points) {
  if (points.some((point) => !isWithinServiceArea(point))) {
    throw new AppError(422, 'OUTSIDE_SERVICE_AREA');
  }
}

function assertBangladeshCountry(countryCode) {
  if (countryCode?.toLowerCase() !== 'bd') {
    throw new AppError(422, 'OUTSIDE_SERVICE_AREA');
  }
}

export async function geocode(text) {
  const place = await currentProvider().geocode(text);
  assertWithinServiceArea(place);
  assertBangladeshCountry(place.countryCode);
  return { lat: place.lat, lng: place.lng, address: place.address };
}

export async function reverseGeocode(lat, lng) {
  assertWithinServiceArea({ lat, lng });
  const place = await currentProvider().reverseGeocode(lat, lng);
  assertBangladeshCountry(place.countryCode);
  return { address: place.address };
}

export function route(from, to) {
  assertWithinServiceArea(from, to);
  return currentProvider().route(from, to);
}
