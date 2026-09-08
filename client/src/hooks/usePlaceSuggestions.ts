import { useEffect, useState } from 'react';
import * as geoApi from '../api/geo.api';
import type { Place } from '../types/geo.types';

const MIN_QUERY_LENGTH = 3;
const DEBOUNCE_MS = 400;

// Pickup/dropoff search-as-you-type (docs 11-12 §5.1). `enabled` is how the
// caller silences this right after a suggestion is picked or "Find" is
// pressed — without it, setting the input's text to the resolved place's
// own address would immediately re-trigger a search for that same address.
export function usePlaceSuggestions(query: string, enabled: boolean) {
  const [suggestions, setSuggestions] = useState<Place[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled || query.trim().length < MIN_QUERY_LENGTH) {
      setSuggestions([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    const timer = window.setTimeout(() => {
      geoApi.search(query, controller.signal)
        .then(setSuggestions)
        .catch(() => {
          // A cancelled (superseded-by-newer-keystroke) request is not a
          // real failure — only clear suggestions for a genuine error.
          if (!controller.signal.aborted) setSuggestions([]);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, enabled]);

  return { suggestions, loading, clear: () => setSuggestions([]) };
}
