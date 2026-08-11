import { useCallback, useEffect, useState } from 'react';
import type { LocationUpdate } from '../types/ride.types';

export type GeolocationState = 'idle' | 'loading' | 'granted' | 'denied' | 'unavailable';

function toLocation(position: GeolocationPosition): LocationUpdate {
  return {
    lat: position.coords.latitude,
    lng: position.coords.longitude,
    ...(position.coords.heading == null ? {} : { heading: position.coords.heading }),
    ...(position.coords.speed == null ? {} : { speedKmh: position.coords.speed * 3.6 }),
  };
}

function stateForError(error: GeolocationPositionError): GeolocationState {
  return error.code === error.PERMISSION_DENIED ? 'denied' : 'unavailable';
}

const GEO_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 12_000,
  maximumAge: 5_000,
};

export function useGeolocation({ watch = false }: { watch?: boolean } = {}) {
  const [position, setPosition] = useState<LocationUpdate | null>(null);
  const [state, setState] = useState<GeolocationState>('idle');
  const [error, setError] = useState<string | null>(null);

  const request = useCallback(() => new Promise<LocationUpdate>((resolve, reject) => {
    if (!navigator.geolocation) {
      const unsupported = new Error('Location is not supported by this browser.');
      setState('unavailable');
      setError(unsupported.message);
      reject(unsupported);
      return;
    }

    setState('loading');
    navigator.geolocation.getCurrentPosition(
      (nextPosition) => {
        const location = toLocation(nextPosition);
        setPosition(location);
        setState('granted');
        setError(null);
        resolve(location);
      },
      (geolocationError) => {
        setState(stateForError(geolocationError));
        setError(geolocationError.message || 'Could not read your location.');
        reject(geolocationError);
      },
      GEO_OPTIONS,
    );
  }), []);

  useEffect(() => {
    if (!watch || !navigator.geolocation) return;

    setState('loading');
    const watchId = navigator.geolocation.watchPosition(
      (nextPosition) => {
        setPosition(toLocation(nextPosition));
        setState('granted');
        setError(null);
      },
      (geolocationError) => {
        setState(stateForError(geolocationError));
        setError(geolocationError.message || 'Could not read your location.');
      },
      GEO_OPTIONS,
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [watch]);

  return { position, state, error, request };
}
