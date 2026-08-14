import { env } from '../../config/env.js';
import { AppError } from '../../utils/AppError.js';

// Nominatim's usage policy requires a descriptive User-Agent on every
// request (https://operations.osmfoundation.org/policies/nominatim/) — the
// public demo server silently blocks requests without one.
const USER_AGENT = 'Cholo/0.1 (learning project; docs/05-06-07 §8 geo adapter)';

async function fetchJson(url, { headers } = {}) {
  let response;

  try {
    response = await fetch(url, { headers });
  } catch {
    throw new AppError(503, 'GEO_PROVIDER_UNAVAILABLE');
  }

  if (!response.ok) {
    throw new AppError(503, 'GEO_PROVIDER_UNAVAILABLE');
  }

  return response.json();
}

// route() — OSRM Directions API. distance/duration are what the fare quote
// is built from (doc 08-09-10 §6 educational skeleton).
export async function route(from, to) {
  const coordinates = `${from.lng},${from.lat};${to.lng},${to.lat}`;
  // OSRM ranks routes for its driving profile, but the product requirement
  // here is specifically shortest-by-distance. Ask for alternatives, keep
  // their real road geometry, then sort by distance ourselves. OSRM may
  // legitimately return fewer alternatives when the road network has none.
  const url = `${env.OSRM_BASE_URL}/route/v1/driving/${coordinates}?alternatives=3&steps=false&overview=full&geometries=geojson`;
  const data = await fetchJson(url);

  if (data.code !== 'Ok' || !data.routes?.length) {
    throw new AppError(422, 'ROUTE_NOT_FOUND');
  }

  const options = data.routes
    .filter((candidate) => Number.isFinite(candidate.distance) && Number.isFinite(candidate.duration))
    .sort((left, right) => left.distance - right.distance || left.duration - right.duration)
    .map((candidate) => ({
      distanceKm: Math.round((candidate.distance / 1000) * 100) / 100,
      durationMin: Math.max(1, Math.round(candidate.duration / 60)),
      path: Array.isArray(candidate.geometry?.coordinates)
        ? candidate.geometry.coordinates.map(([lng, lat]) => ({ lat: Number(lat), lng: Number(lng) }))
        : [],
    }));

  const [shortest, ...alternatives] = options;
  if (!shortest) throw new AppError(422, 'ROUTE_NOT_FOUND');

  return {
    ...shortest,
    alternatives,
  };
}

// geocode() / reverseGeocode() — Nominatim. Not called by the quote
// endpoint (which already receives lat/lng), but part of the doc 05-06-07
// §8 interface for address search and pin-drop-to-address screens later.
export async function geocode(text) {
  // countrycodes is Nominatim's hard country-boundary filter (unlike a
  // fuzzy "Bangladesh" search term), so a foreign result cannot win merely
  // because it has a more popular name.
  const url = `${env.NOMINATIM_BASE_URL}/search?q=${encodeURIComponent(text)}&format=jsonv2&limit=1&accept-language=en&addressdetails=1&countrycodes=bd`;
  const results = await fetchJson(url, { headers: { 'User-Agent': USER_AGENT } });

  const match = results[0];
  if (!match) {
    throw new AppError(422, 'ADDRESS_NOT_FOUND');
  }

  return {
    lat: Number(match.lat),
    lng: Number(match.lon),
    address: match.display_name,
    countryCode: match.address?.country_code ?? null,
  };
}

export async function reverseGeocode(lat, lng) {
  const url = `${env.NOMINATIM_BASE_URL}/reverse?lat=${lat}&lon=${lng}&format=jsonv2&accept-language=en&addressdetails=1`;
  const result = await fetchJson(url, { headers: { 'User-Agent': USER_AGENT } });

  if (!result || result.error) {
    throw new AppError(422, 'ADDRESS_NOT_FOUND');
  }

  return {
    address: result.display_name,
    countryCode: result.address?.country_code ?? null,
  };
}
