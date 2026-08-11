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
  const url = `${env.OSRM_BASE_URL}/route/v1/driving/${coordinates}?overview=false`;
  const data = await fetchJson(url);

  const leg = data.routes?.[0];
  if (data.code !== 'Ok' || !leg) {
    throw new AppError(422, 'ROUTE_NOT_FOUND');
  }

  return {
    distanceKm: Math.round((leg.distance / 1000) * 100) / 100,
    durationMin: Math.round(leg.duration / 60),
  };
}

// geocode() / reverseGeocode() — Nominatim. Not called by the quote
// endpoint (which already receives lat/lng), but part of the doc 05-06-07
// §8 interface for address search and pin-drop-to-address screens later.
export async function geocode(text) {
  const url = `${env.NOMINATIM_BASE_URL}/search?q=${encodeURIComponent(text)}&format=json&limit=1`;
  const results = await fetchJson(url, { headers: { 'User-Agent': USER_AGENT } });

  const match = results[0];
  if (!match) {
    throw new AppError(422, 'ADDRESS_NOT_FOUND');
  }

  return { lat: Number(match.lat), lng: Number(match.lon), address: match.display_name };
}

export async function reverseGeocode(lat, lng) {
  const url = `${env.NOMINATIM_BASE_URL}/reverse?lat=${lat}&lon=${lng}&format=json`;
  const result = await fetchJson(url, { headers: { 'User-Agent': USER_AGENT } });

  if (!result || result.error) {
    throw new AppError(422, 'ADDRESS_NOT_FOUND');
  }

  return { address: result.display_name };
}
