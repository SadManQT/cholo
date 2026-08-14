import { readFileSync } from 'node:fs';

import { haversineDistanceKm } from './haversine.js';

// OSM relation 184640 (Bangladesh), exported through Nominatim as GeoJSON
// with polygon_threshold=0.002. The checked-in snapshot keeps routing
// deterministic and avoids a boundary-network call per quote. See
// server/src/data/README.md for source/licence details.
const geometry = JSON.parse(readFileSync(
  new URL('../data/bangladesh-boundary.json', import.meta.url),
  'utf8',
));

const polygons = geometry.type === 'MultiPolygon'
  ? geometry.coordinates
  : [geometry.coordinates];

// A small tolerance absorbs simplification/road-centreline differences at
// the border. It is deliberately far smaller than a meaningful transit
// through India, which will put many route points kilometres outside.
const BORDER_TOLERANCE_KM = 0.35;
const SEGMENT_SAMPLE_KM = 0.25;

function pointInRing({ lat, lng }, ring) {
  let inside = false;

  for (let current = 0, previous = ring.length - 1; current < ring.length; previous = current, current += 1) {
    const [currentLng, currentLat] = ring[current];
    const [previousLng, previousLat] = ring[previous];
    const intersects = (currentLat > lat) !== (previousLat > lat)
      && lng < ((previousLng - currentLng) * (lat - currentLat)) / (previousLat - currentLat) + currentLng;
    if (intersects) inside = !inside;
  }

  return inside;
}

function pointInPolygon(point, polygon) {
  if (!pointInRing(point, polygon[0])) return false;
  return polygon.slice(1).every((hole) => !pointInRing(point, hole));
}

function distanceToSegmentKm(point, start, end) {
  const latitudeScale = 111.32;
  const longitudeScale = 111.32 * Math.cos((point.lat * Math.PI) / 180);
  const startX = (start[0] - point.lng) * longitudeScale;
  const startY = (start[1] - point.lat) * latitudeScale;
  const endX = (end[0] - point.lng) * longitudeScale;
  const endY = (end[1] - point.lat) * latitudeScale;
  const deltaX = endX - startX;
  const deltaY = endY - startY;
  const lengthSquared = deltaX ** 2 + deltaY ** 2;
  const projection = lengthSquared === 0
    ? 0
    : Math.max(0, Math.min(1, -(startX * deltaX + startY * deltaY) / lengthSquared));
  return Math.hypot(startX + projection * deltaX, startY + projection * deltaY);
}

function isNearBoundary(point) {
  for (const polygon of polygons) {
    for (const ring of polygon) {
      for (let index = 1; index < ring.length; index += 1) {
        if (distanceToSegmentKm(point, ring[index - 1], ring[index]) <= BORDER_TOLERANCE_KM) {
          return true;
        }
      }
    }
  }

  return false;
}

export function isPointInsideBangladesh(point) {
  return polygons.some((polygon) => pointInPolygon(point, polygon)) || isNearBoundary(point);
}

// Validate both OSRM vertices and interpolated points between them. That
// closes the edge case where a sparse polyline exits and re-enters the
// country between two individually valid vertices.
export function isRouteInsideBangladesh(path) {
  if (!Array.isArray(path) || path.length < 2) return false;

  for (let index = 0; index < path.length; index += 1) {
    const point = path[index];
    if (!isPointInsideBangladesh(point)) return false;
    if (index === 0) continue;

    const previous = path[index - 1];
    const segmentKm = haversineDistanceKm(previous.lat, previous.lng, point.lat, point.lng);
    const sampleCount = Math.ceil(segmentKm / SEGMENT_SAMPLE_KM);
    for (let sample = 1; sample < sampleCount; sample += 1) {
      const ratio = sample / sampleCount;
      if (!isPointInsideBangladesh({
        lat: previous.lat + (point.lat - previous.lat) * ratio,
        lng: previous.lng + (point.lng - previous.lng) * ratio,
      })) return false;
    }
  }

  return true;
}
