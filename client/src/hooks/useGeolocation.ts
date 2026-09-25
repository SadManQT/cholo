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

const FALLBACK_GEO_OPTIONS: PositionOptions = {
  enableHighAccuracy: false,
  timeout: 20_000,
  maximumAge: 5 * 60_000,
};

/** What to tell someone whose location could not be read, by the browser's error code. */
export function locationHelp(error: unknown) {
  const code = (error as GeolocationPositionError | undefined)?.code;
  if (code === 1) return 'Location is blocked for Cholo. Click the location icon in the address bar, choose Allow, then try again.';
  if (code === 2 || code === 3) return 'Your device could not find its location. On a Mac, turn on Location Services for your browser in System Settings → Privacy & Security → Location Services, then try again.';
  return 'This browser cannot share its location. Try Chrome or Safari on your phone.';
}

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
    const succeed = (nextPosition: GeolocationPosition) => {
      const location = toLocation(nextPosition);
      setPosition(location);
      setState('granted');
      setError(null);
      resolve(location);
    };
    const fail = (geolocationError: GeolocationPositionError) => {
      setState(stateForError(geolocationError));
      setError(geolocationError.message || 'Could not read your location.');
      reject(geolocationError);
    };
    // Laptops without GPS often time out asking for a precise fix; a Wi-Fi-level fix is plenty for Cholo.
    navigator.geolocation.getCurrentPosition(succeed, (firstError) => {
      if (firstError.code === firstError.PERMISSION_DENIED) return fail(firstError);
      navigator.geolocation.getCurrentPosition(succeed, fail, FALLBACK_GEO_OPTIONS);
    }, GEO_OPTIONS);
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
