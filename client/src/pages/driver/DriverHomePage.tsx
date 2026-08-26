import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as driverApi from '../../api/driver.api';
import * as tripsApi from '../../api/trips.api';
import { MapView } from '../../components/map/MapView';
import { ConnectionPill } from '../../components/ride/ConnectionPill';
import { OfferSheet } from '../../components/ride/OfferSheet';
import { Button, Card, EmptyState, Skeleton, StatusBadge, toast } from '../../components/ui';
import { useSocket } from '../../context/socket';
import { useGeolocation } from '../../hooks/useGeolocation';
import type { DriverStatus, RideOffer, SocketTripStatus, TripSummary } from '../../types/ride.types';
import { getApiErrorCode, getApiErrorMessage } from '../../utils/apiError';

export function DriverHomePage() {
  const navigate = useNavigate();
  const { socket, connectionState } = useSocket();
  const geolocation = useGeolocation();
  const [status, setStatus] = useState<DriverStatus | null>(null);
  const [activeTrip, setActiveTrip] = useState<TripSummary | null>(null);
  const [offers, setOffers] = useState<RideOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [switching, setSwitching] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [rejecting, setRejecting] = useState(false);

  const refreshOffers = useCallback(async () => {
    try {
      setOffers(await driverApi.listOffers());
    } catch {
      // The main page status remains usable; socket/poll retries shortly.
    }
  }, []);

  const loadHome = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [driverStatus, trips] = await Promise.all([
        driverApi.getStatus(),
        tripsApi.listTrips({ status: 'active', role: 'driver', limit: 1 }),
      ]);
      setStatus(driverStatus);
      setActiveTrip(trips.data[0] ?? null);
      await refreshOffers();
    } catch (thrown) {
      setError(getApiErrorMessage(thrown, 'Could not load driver home.'));
    } finally {
      setLoading(false);
    }
  }, [refreshOffers]);

  useEffect(() => {
    void loadHome();
  }, [loadHome]);

  useEffect(() => {
    if (!socket) return;
    const onOffer = () => void refreshOffers();
    const onTripStatus = (payload: SocketTripStatus) => {
      if (payload.status === 'assigned') void loadHome();
    };
    socket.on('offer:new', onOffer);
    socket.on('trip:status', onTripStatus);
    return () => {
      socket.off('offer:new', onOffer);
      socket.off('trip:status', onTripStatus);
    };
  }, [loadHome, refreshOffers, socket]);

  useEffect(() => {
    if (status?.availabilityStatus !== 'online') return;
    const interval = window.setInterval(refreshOffers, 5_000);
    return () => window.clearInterval(interval);
  }, [refreshOffers, status?.availabilityStatus]);

  async function toggleOnline() {
    if (!status) return;
    setSwitching(true);
    try {
      if (status.availabilityStatus === 'online' || status.availabilityStatus === 'break') {
        const updated = await driverApi.setAvailability('offline');
        setStatus((current) => current ? { ...current, ...updated, availabilityStatus: 'offline' } : current);
        setOffers([]);
        toast.info('You are offline.');
      } else {
        const location = await geolocation.request();
        const updated = await driverApi.setAvailability('online', location);
        setStatus((current) => current ? { ...current, ...updated, availabilityStatus: 'online' } : current);
        toast.success('You are online and ready for offers.');
        void refreshOffers();
      }
    } catch (thrown) {
      toast.error(getApiErrorMessage(thrown, 'Availability could not be changed.'));
    } finally {
      setSwitching(false);
    }
  }

  const currentOffer = offers[0] ?? null;

  const dismissCurrentOffer = useCallback(() => {
    if (!currentOffer) return;
    setOffers((current) => current.filter((offer) => offer.id !== currentOffer.id));
    void refreshOffers();
  }, [currentOffer, refreshOffers]);

  async function acceptOffer() {
    if (!currentOffer) return;
    setAccepting(true);
    try {
      const result = await driverApi.respondToOffer(currentOffer.id, 'accepted');
      if ('trip' in result) {
        setOffers([]);
        toast.success('Ride accepted. Head to the pickup.');
        navigate('/driver/trip');
      }
    } catch (thrown) {
      const code = getApiErrorCode(thrown);
      if (code === 'ALREADY_TAKEN' || code === 'OFFER_EXPIRED') {
        toast.info(code === 'ALREADY_TAKEN' ? 'Too late — another driver accepted it.' : 'This offer expired.');
        dismissCurrentOffer();
      } else {
        toast.error(getApiErrorMessage(thrown, 'Could not accept this ride.'));
      }
    } finally {
      setAccepting(false);
    }
  }

  async function rejectOffer() {
    if (!currentOffer) return;
    setRejecting(true);
    try {
      await driverApi.respondToOffer(currentOffer.id, 'rejected');
      dismissCurrentOffer();
      toast.info('Offer declined.');
    } catch (thrown) {
      toast.error(getApiErrorMessage(thrown, 'Could not decline this offer.'));
    } finally {
      setRejecting(false);
    }
  }

  const mapPosition = useMemo(() => {
    if (geolocation.position) return geolocation.position;
    if (status?.currentLat != null && status.currentLng != null) {
      return { lat: Number(status.currentLat), lng: Number(status.currentLng) };
    }
    return null;
  }, [geolocation.position, status]);

  if (loading) return <div className="h-[calc(100dvh-4rem)]"><Skeleton variant="map-placeholder" className="h-2/3" /><div className="space-y-3 p-4"><Skeleton variant="card" /><Skeleton lines={2} /></div></div>;
  if (error || !status) return <EmptyState title="Driver home did not load" hint={error ?? 'Driver profile not found.'} action={{ label: 'Retry', onClick: loadHome }} />;

  const online = status.availabilityStatus === 'online';

  return (
    <main className="relative h-[calc(100dvh-4rem)] overflow-hidden">
      <ConnectionPill state={connectionState} />
      <MapView user={mapPosition} className="h-full" />

      <div className="absolute inset-x-3 top-3 z-[500] mx-auto max-w-xl space-y-3">
        <Card className="bg-surface/95 shadow-lg">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-ink-500">Driver mode</p>
              <p className="text-xl font-bold">{online ? 'You are online' : status.availabilityStatus === 'on_trip' ? 'Trip in progress' : 'You are offline'}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={online}
              disabled={switching || status.availabilityStatus === 'on_trip'}
              onClick={toggleOnline}
              className={`relative h-12 w-24 rounded-full p-1 text-xs font-bold transition-[background-color,color] duration-200 ease-cholo-out active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cholo-700 ${online ? 'bg-cholo-700 text-white' : 'bg-ink-500/20 text-ink-900'} disabled:opacity-60 disabled:active:scale-100`}
            >
              <span className={`absolute top-1 h-10 w-10 rounded-full bg-surface shadow transition-transform duration-200 ease-cholo-in-out ${online ? 'translate-x-12' : 'translate-x-0'}`} />
              <span className="relative">{switching ? '…' : online ? 'ON' : 'OFF'}</span>
            </button>
          </div>
          <p className="mt-3 border-t border-border pt-3 text-sm text-ink-500">
            {status.activeVehicle ? `${status.activeVehicle.registrationNo} is active` : 'Activate an approved vehicle before going online.'}
          </p>
        </Card>

        {activeTrip && (
          <Card className="border-info-600/30 bg-surface/95 shadow-lg">
            <div className="flex items-center justify-between gap-3">
              <div><StatusBadge status={activeTrip.status} /><p className="mt-1 font-semibold">Active trip · {activeTrip.publicCode}</p></div>
              <Button onClick={() => navigate('/driver/trip')}>Resume</Button>
            </div>
          </Card>
        )}
      </div>

      {!activeTrip && !currentOffer && (
        <div className="absolute inset-x-4 bottom-5 z-[500] mx-auto max-w-md rounded-2xl bg-surface/95 p-4 text-center shadow-lg">
          <p className="font-semibold">{online ? 'Waiting for nearby ride offers' : 'Go online to receive offers'}</p>
          <p className="mt-1 text-sm text-ink-500">Keep this screen open. New offers appear automatically.</p>
        </div>
      )}

      <OfferSheet
        offer={currentOffer}
        accepting={accepting}
        rejecting={rejecting}
        onAccept={acceptOffer}
        onReject={rejectOffer}
        onExpired={dismissCurrentOffer}
      />
    </main>
  );
}
