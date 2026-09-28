const EARTH_RADIUS_KM = 6371;

function toRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

export function haversineDistanceKm(lat1, lng1, lat2, lng2) {
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_KM * c;
}

// GPS drifts a few metres even when the car is parked; steps shorter than this are treated as standing still.
const GPS_JITTER_KM = 0.015;

/** Length of a driven path (ordered points), ignoring GPS jitter. */
export function pathDistanceKm(points) {
  let total = 0;
  let last = points[0];
  for (const point of points.slice(1)) {
    const step = haversineDistanceKm(last.lat, last.lng, point.lat, point.lng);
    if (step < GPS_JITTER_KM) continue;
    total += step;
    last = point;
  }
  return total;
}
