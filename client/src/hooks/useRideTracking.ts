import { useCallback, useEffect, useState } from 'react';
import * as tripsApi from '../api/trips.api';
import { useSocket } from '../context/socket';
import type { PickupHandshake, SocketLocation, SocketTripStatus, TripStatus } from '../types/ride.types';

const NO_HANDSHAKE: PickupHandshake = { startRequestedAt: null, pickupConfirmedAt: null, arrivalDisputedAt: null };

export function useRideTracking(tripCode: string | undefined, initialStatus: TripStatus = 'assigned') {
  const { socket, connectionState } = useSocket();
  const [driverPosition, setDriverPosition] = useState<SocketLocation | null>(null);
  const [status, setStatus] = useState<TripStatus>(initialStatus);
  const [earlyStopRequestedAt, setEarlyStopRequestedAt] = useState<string | null>(null);
  const [handshake, setHandshake] = useState<PickupHandshake | null>(null);

  useEffect(() => setStatus(initialStatus), [initialStatus]);

  const patchHandshake = useCallback((patch: Partial<PickupHandshake>) => {
    setHandshake((current) => ({ ...(current ?? NO_HANDSHAKE), ...patch }));
  }, []);

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
        setEarlyStopRequestedAt(trip.earlyStopRequestedAt ?? null);
        setHandshake({
          startRequestedAt: trip.startRequestedAt ?? null,
          pickupConfirmedAt: trip.pickupConfirmedAt ?? null,
          arrivalDisputedAt: trip.arrivalDisputedAt ?? null,
        });
      } catch {
      }
    }

    const onLocation = (payload: SocketLocation) => setDriverPosition(payload);
    const onStatus = (payload: SocketTripStatus) => {
      if (payload.tripCode && payload.tripCode !== tripCode) return;
      setStatus(payload.status);
      if (payload.earlyStopRequestedAt) setEarlyStopRequestedAt(payload.earlyStopRequestedAt);
      setHandshake((current) => {
        const next = { ...(current ?? NO_HANDSHAKE) };
        if (payload.arrivedAt || payload.status === 'assigned') {
          next.startRequestedAt = null;
          next.pickupConfirmedAt = null;
        }
        if (payload.startRequestedAt) next.startRequestedAt = payload.startRequestedAt;
        if (payload.pickupConfirmedAt) next.pickupConfirmedAt = payload.pickupConfirmedAt;
        if (payload.arrivalDisputedAt) next.arrivalDisputedAt = payload.arrivalDisputedAt;
        return next;
      });
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

  return { driverPosition, status, earlyStopRequestedAt, handshake, patchHandshake, connectionState };
}
