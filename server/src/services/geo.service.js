import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import { isRouteInsideBangladesh } from '../utils/bangladeshBoundary.js';
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

// These are routing waypoints, not service cities. They sit well inside the
// national boundary and give a global OSRM graph domestic alternatives when
// its direct recommendation takes a shorter-looking shortcut through India.
const DOMESTIC_ROUTING_HUBS = Object.freeze([
  { lat: 23.8103, lng: 90.4125 }, // Dhaka
  { lat: 24.8465, lng: 89.3773 }, // Bogura
  { lat: 24.7471, lng: 90.4203 }, // Mymensingh
  { lat: 23.4607, lng: 91.1809 }, // Cumilla
]);

function routeOptions(result) {
  return [
    { distanceKm: result.distanceKm, durationMin: result.durationMin, path: result.path },
    ...(result.alternatives ?? []),
  ];
}

function selectShortestDomestic(options) {
  const domestic = options
    .filter((option) => isRouteInsideBangladesh(option.path))
    .sort((left, right) => left.distanceKm - right.distanceKm || left.durationMin - right.durationMin);
  const [shortest, ...alternatives] = domestic;
  return shortest ? { ...shortest, alternatives } : null;
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

export async function route(from, to) {
  assertWithinServiceArea(from, to);
  const provider = currentProvider();
  const direct = await provider.route(from, to);
  const directOptions = routeOptions(direct);
  const directShortestIsDomestic = isRouteInsideBangladesh(directOptions[0].path);

  // If the provider's own shortest route is domestic, no constrained route
  // can be shorter. Keep its valid alternatives and avoid extra network work.
  if (directShortestIsDomestic) return selectShortestDomestic(directOptions);

  // Otherwise ask for inland-via candidates. A global OSRM graph has no
  // country exclusion flag, so the geometry validator—not provider ranking—
  // is the final authority. Failed hubs do not hide a valid candidate.
  const fallbackResults = await Promise.allSettled(
    DOMESTIC_ROUTING_HUBS.map((hub) => provider.route(from, to, { via: [hub] })),
  );
  const fallbackOptions = fallbackResults.flatMap((result) => (
    result.status === 'fulfilled' ? routeOptions(result.value) : []
  ));
  const selected = selectShortestDomestic([...directOptions, ...fallbackOptions]);
  if (!selected) throw new AppError(422, 'DOMESTIC_ROUTE_NOT_FOUND');
  return selected;
}
