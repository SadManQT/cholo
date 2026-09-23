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

export function stripAdminSuffix(name) {
  return name?.replace(/\s+(Metropolitan|District)$/i, '');
}
