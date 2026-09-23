import { useEffect, useState } from 'react';
import * as geoApi from '../api/geo.api';
import type { Place } from '../types/geo.types';

const MIN_QUERY_LENGTH = 3;
const DEBOUNCE_MS = 400;

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
