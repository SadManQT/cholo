import { env } from '../../config/env.js';
import { AppError } from '../../utils/AppError.js';
import { formatCompactAddress, stripAdminSuffix } from '../../utils/addressFormat.js';
import { route } from './osm.provider.js';

// Photon (komoot) indexes the SAME OpenStreetMap data as Nominatim, but
// through Elasticsearch instead of Postgres full-text search — same free
// public-demo tier and "be reasonable" fair-use policy as Nominatim
// (https://github.com/komoot/photon/discussions/598), but Elasticsearch's
// fuzzy matching means a misspelled "Gulshsn" or "Dhanmodi" still resolves
// correctly, where Nominatim returns nothing at all. It does NOT close the
// coverage gap against Google Maps — same underlying OSM data, so a place
// genuinely missing from OpenStreetMap is still missing here.
//
// Photon has no directions/routing API — route() is re-exported from
// osm.provider.js unchanged, so switching GEO_PROVIDER only ever affects
// geocoding, never OSRM.
const USER_AGENT = 'Cholo/0.1 (learning project; docs/05-06-07 §8 geo adapter)';

// Same rectangle as geo.service.js's BANGLADESH_BOUNDS — narrows Photon's
// global index to the Bangladesh area before the service layer's own
// country-code check runs, the same job Nominatim's countrycodes=bd query
// param does for that provider.
const BD_BBOX = '88.01,20.34,92.68,26.64';

async function fetchJson(url) {
  let response;

  try {
    response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  } catch {
    throw new AppError(503, 'GEO_PROVIDER_UNAVAILABLE');
  }

  if (!response.ok) {
    throw new AppError(503, 'GEO_PROVIDER_UNAVAILABLE');
  }

  return response.json();
}

// Same idea as osm.provider.js's compactAddress, different field names —
// Photon's GeoJSON `properties` object uses street/district/locality where
// Nominatim uses road/suburb/quarter. formatCompactAddress (shared) is
// what keeps the actual dedupe/join/fallback RULE identical between them.
function compactAddress(props) {
  const houseAndStreet = props.housenumber && props.street ? `${props.housenumber} ${props.street}` : null;
  const primary = props.name || houseAndStreet || props.street || props.district || props.city;
  const area = props.district || props.locality;
  const city = props.city || stripAdminSuffix(props.county) || stripAdminSuffix(props.state);
  const fallback = [props.name, props.street, props.city, props.country].filter(Boolean).join(', ');

  return formatCompactAddress({ primary, area, city, fallback });
}

function toPlace(feature) {
  const [lng, lat] = feature.geometry.coordinates;
  return {
    lat,
    lng,
    address: compactAddress(feature.properties),
    countryCode: feature.properties.countrycode?.toLowerCase() ?? null,
  };
}

async function photonSearch(text, limit) {
  const url = `${env.PHOTON_BASE_URL}/api/?q=${encodeURIComponent(text)}&limit=${limit}&lang=en&bbox=${BD_BBOX}`;
  const data = await fetchJson(url);
  return data.features ?? [];
}

export async function geocode(text) {
  const [match] = await photonSearch(text, 1);
  if (!match) {
    throw new AppError(422, 'ADDRESS_NOT_FOUND');
  }

  return toPlace(match);
}

// As-you-type suggestions — an empty array is a normal "nothing yet" state
// while the passenger is still typing, not an error (mirrors osm.provider.
// js's own search()).
export async function search(text) {
  const features = await photonSearch(text, 5);
  return features.map(toPlace);
}

export async function reverseGeocode(lat, lng) {
  const url = `${env.PHOTON_BASE_URL}/reverse?lat=${lat}&lon=${lng}&lang=en`;
  const data = await fetchJson(url);
  const match = data.features?.[0];

  if (!match) {
    throw new AppError(422, 'ADDRESS_NOT_FOUND');
  }

  return {
    address: compactAddress(match.properties),
    countryCode: match.properties.countrycode?.toLowerCase() ?? null,
  };
}

export { route };
