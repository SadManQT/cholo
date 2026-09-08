import { env } from '../../config/env.js';
import { AppError } from '../../utils/AppError.js';
import { formatCompactAddress, stripAdminSuffix } from '../../utils/addressFormat.js';

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
export async function route(from, to, { via = [] } = {}) {
  const coordinates = [from, ...via, to]
    .map((point) => `${point.lng},${point.lat}`)
    .join(';');
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

// Nominatim's own display_name is built for a global gazetteer, not a
// passenger's eyes — "BUET Shahid Minar, Zahir Raihan Road, Polashi, Khaze
// Dewan, Bokshibazar, Dhaka, Dhaka Metropolitan, Dhaka District, Dhaka
// Division, 1211, Bangladesh" for one landmark. addressdetails=1 (every
// call site already sends it) gives structured fields instead — this picks
// the 2-3 that actually help someone recognize a place at a glance and
// drops the postcode/district/division/country every result already shares
// (this app only serves Bangladesh — that part of the address is never
// the differentiator between two suggestions). formatCompactAddress does
// the dedupe/join/fallback itself — shared with photon.provider.js so the
// two geocoders can never disagree on what "compact" means.
function compactAddress(match) {
  const addr = match.address ?? {};
  const houseAndRoad = addr.house_number && addr.road ? `${addr.house_number} ${addr.road}` : null;
  const primary = match.name || houseAndRoad || addr.road || addr.suburb || addr.city;
  const area = addr.suburb || addr.quarter || addr.neighbourhood;
  // city/town/village cover the normal case; a residential-area result
  // (like a reverse-geocoded road with no separate city tag at all) can
  // lack every one of those, which without a fallback would leave a
  // single-word result like "Lalmatia" with no city alongside it.
  const city = addr.city || addr.town || addr.village
    || stripAdminSuffix(addr.county) || stripAdminSuffix(addr.state_district);

  return formatCompactAddress({ primary, area, city, fallback: match.display_name });
}

function toPlace(match) {
  return {
    lat: Number(match.lat),
    lng: Number(match.lon),
    address: compactAddress(match),
    countryCode: match.address?.country_code ?? null,
  };
}

// Shared by geocode() (limit=1, throws if nothing matches) and search()
// (limit=5, returns whatever it finds, empty array included) — one query
// shape, two callers with different "no match" expectations.
async function nominatimSearch(text, limit) {
  // countrycodes is Nominatim's hard country-boundary filter (unlike a
  // fuzzy "Bangladesh" search term), so a foreign result cannot win merely
  // because it has a more popular name.
  const url = `${env.NOMINATIM_BASE_URL}/search?q=${encodeURIComponent(text)}&format=jsonv2&limit=${limit}&accept-language=en&addressdetails=1&countrycodes=bd`;
  return fetchJson(url, { headers: { 'User-Agent': USER_AGENT } });
}

// geocode() / reverseGeocode() — Nominatim. Not called by the quote
// endpoint (which already receives lat/lng), but part of the doc 05-06-07
// §8 interface for address search and pin-drop-to-address screens later.
export async function geocode(text) {
  const results = await nominatimSearch(text, 1);
  const match = results[0];
  if (!match) {
    throw new AppError(422, 'ADDRESS_NOT_FOUND');
  }

  return toPlace(match);
}

// search() — as-you-type suggestions (doc 11-12 §5.1's pickup/dropoff
// fields). Unlike geocode(), an empty result is a normal "nothing yet"
// state while the passenger is still typing, not an error.
export async function search(text) {
  const results = await nominatimSearch(text, 5);
  return results.map(toPlace);
}

export async function reverseGeocode(lat, lng) {
  const url = `${env.NOMINATIM_BASE_URL}/reverse?lat=${lat}&lon=${lng}&format=jsonv2&accept-language=en&addressdetails=1`;
  const result = await fetchJson(url, { headers: { 'User-Agent': USER_AGENT } });

  if (!result || result.error) {
    throw new AppError(422, 'ADDRESS_NOT_FOUND');
  }

  return {
    address: compactAddress(result),
    countryCode: result.address?.country_code ?? null,
  };
}
