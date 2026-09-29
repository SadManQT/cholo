import type { LatLng } from '../types/geo.types';

export const DHAKA_CENTER: [number, number] = [23.7806, 90.4079];

const CITY_CENTERS: Record<string, [number, number]> = {
  dhaka: DHAKA_CENTER,
  chattogram: [22.3569, 91.7832],
  chittagong: [22.3569, 91.7832],
  sylhet: [24.8949, 91.8687],
  khulna: [22.8456, 89.5403],
  rajshahi: [24.3745, 88.6042],
  barishal: [22.701, 90.3535],
  barisal: [22.701, 90.3535],
  rangpur: [25.7439, 89.2752],
  mymensingh: [24.7471, 90.4203],
  cumilla: [23.4607, 91.1809],
  comilla: [23.4607, 91.1809],
  gazipur: [23.9999, 90.4203],
  narayanganj: [23.6238, 90.5],
};

export function cityCenter(name: string | undefined): [number, number] | null {
  return name ? CITY_CENTERS[name.trim().toLowerCase()] ?? null : null;
}

function distanceKm(a: [number, number], b: [number, number]) {
  const rad = Math.PI / 180;
  const dLat = (b[0] - a[0]) * rad;
  const dLng = (b[1] - a[1]) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLng / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

export function pickCityId(cities: { id: number; name: string }[], point: LatLng | null | undefined): number | undefined {
  if (!cities.length) return undefined;
  if (point) {
    let best: { id: number; km: number } | null = null;
    for (const city of cities) {
      const center = cityCenter(city.name);
      if (!center) continue;
      const km = distanceKm(center, [point.lat, point.lng]);
      if (!best || km < best.km) best = { id: city.id, km };
    }
    if (best) return best.id;
  }
  return (cities.find((city) => city.name.trim().toLowerCase() === 'dhaka') ?? cities[0]).id;
}
