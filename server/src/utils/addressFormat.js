// Shared by every geo provider's own field-extraction (osm.provider.js,
// photon.provider.js) — "pick a primary label + area + city, dedupe, join"
// is a product decision (passengers don't want postcode/district/division/
// country cluttering every suggestion), not something that should vary
// depending on which geocoder happens to be active behind the adapter.
export function formatCompactAddress({ primary, area, city, fallback }) {
  const seen = new Set();
  const parts = [primary, area, city].filter((part) => {
    if (!part) return false;
    const key = part.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return parts.length > 0 ? parts.join(', ') : fallback;
}

// "Dhaka Metropolitan" / "Dhaka District" (every provider's own admin-unit
// naming) read as noise once they're the ONLY thing standing in for a
// missing city — stripped down to the plain "Dhaka" a passenger expects.
export function stripAdminSuffix(name) {
  return name?.replace(/\s+(Metropolitan|District)$/i, '');
}
