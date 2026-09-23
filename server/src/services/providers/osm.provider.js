import { env } from '../../config/env.js';
import { AppError } from '../../utils/AppError.js';
import { formatCompactAddress, stripAdminSuffix } from '../../utils/addressFormat.js';

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

export async function route(from, to, { via = [] } = {}) {
  const coordinates = [from, ...via, to]
    .map((point) => `${point.lng},${point.lat}`)
    .join(';');
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

function compactAddress(match) {
  const addr = match.address ?? {};
  const houseAndRoad = addr.house_number && addr.road ? `${addr.house_number} ${addr.road}` : null;
  const primary = match.name || houseAndRoad || addr.road || addr.suburb || addr.city;
  const area = addr.suburb || addr.quarter || addr.neighbourhood;
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

async function nominatimSearch(text, limit) {
  const url = `${env.NOMINATIM_BASE_URL}/search?q=${encodeURIComponent(text)}&format=jsonv2&limit=${limit}&accept-language=en&addressdetails=1&countrycodes=bd`;
  return fetchJson(url, { headers: { 'User-Agent': USER_AGENT } });
}

export async function geocode(text) {
  const results = await nominatimSearch(text, 1);
  const match = results[0];
  if (!match) {
    throw new AppError(422, 'ADDRESS_NOT_FOUND');
  }

  return toPlace(match);
}

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
