import type { LatLng } from '../types/geo.types';

// Keep this cheap client-side check aligned with geo.service.js. The API is
// still authoritative; Nominatim verifies the exact country for searched or
// reverse-geocoded places.
export const BANGLADESH_BOUNDS = Object.freeze({
  south: 20.34,
  north: 26.64,
  west: 88.01,
  east: 92.68,
});

export const SERVICE_AREA_NOTICE = 'Cholo rides are currently available only within Bangladesh. Choose a location inside Bangladesh.';

export function isWithinBangladeshBounds({ lat, lng }: LatLng) {
  return lat >= BANGLADESH_BOUNDS.south
    && lat <= BANGLADESH_BOUNDS.north
    && lng >= BANGLADESH_BOUNDS.west
    && lng <= BANGLADESH_BOUNDS.east;
}
