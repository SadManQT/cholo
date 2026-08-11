import { useEffect, useState } from 'react';
import * as tripsApi from '../api/trips.api';
import { useSocket } from '../context/socket';
import type { SocketLocation, SocketTripStatus, TripStatus } from '../types/ride.types';

export function useRideTracking(tripCode: string | undefined, initialStatus: TripStatus = 'assigned') {
  const { socket, connectionState } = useSocket();
  const [driverPosition, setDriverPosition] = useState<SocketLocation | null>(null);
  const [status, setStatus] = useState<TripStatus>(initialStatus);

  useEffect(() => setStatus(initialStatus), [initialStatus]);

  useEffect(() => {
    if (!tripCode) return;
    let cancelled = false;

    async function refreshFallback() {
      try {
        const [location, trip] = await Promise.all([
          tripsApi.trackTrip(tripCode as string),
          tripsApi.getTrip(tripCode as string),
        ]);
        if (cancelled) return;
        if (location) setDriverPosition(location);
        setStatus(trip.status);
      } catch {
        // The page's own fetch owns visible error handling. This background
        // fallback simply tries again on the next interval.
      }
    }

    const onLocation = (payload: SocketLocation) => setDriverPosition(payload);
    const onStatus = (payload: SocketTripStatus) => {
      if (!payload.tripCode || payload.tripCode === tripCode) setStatus(payload.status);
    };

    socket?.on('location:update', onLocation);
    socket?.on('trip:status', onStatus);
    void refreshFallback();
    const interval = window.setInterval(refreshFallback, 8_000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      socket?.off('location:update', onLocation);
      socket?.off('trip:status', onStatus);
    };
  }, [socket, tripCode]);

  return { driverPosition, status, connectionState };
}
