import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import * as tripsApi from '../../api/trips.api';
import { MapView } from '../../components/map/MapView';
import { ChatSheet } from '../../components/ride/ChatSheet';
import { ConfirmSheet } from '../../components/ride/ConfirmSheet';
import { ConnectionPill } from '../../components/ride/ConnectionPill';
import { TripStatusStepper } from '../../components/ride/TripStatusStepper';
import { BottomSheet, Button, Card, EmptyState, Skeleton, StatusBadge, toast } from '../../components/ui';
import type { SnapPoint } from '../../components/ui/BottomSheet';
import { useAuth } from '../../context/auth';
import { useGeolocation } from '../../hooks/useGeolocation';
import { useRideTracking } from '../../hooks/useRideTracking';
import type { TripDetail } from '../../types/ride.types';
import type { LatLng } from '../../types/geo.types';
import { getApiErrorMessage } from '../../utils/apiError';
import { formatBDT } from '../../utils/format';
import { EASE_OUT } from '../../utils/motion';

export function LiveTripPage() {
  const { code } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const geolocation = useGeolocation();
  const [trip, setTrip] = useState<TripDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [snapPoint, setSnapPoint] = useState<SnapPoint>('half');
  const [chatOpen, setChatOpen] = useState(false);
  const [confirmation, setConfirmation] = useState<'cancel' | 'sos' | null>(null);
  const [mutating, setMutating] = useState(false);
  const tracking = useRideTracking(code, trip?.status ?? 'assigned');

  const loadTrip = useCallback(async () => {
    if (!code) return;
    setLoading(true);
    setError(null);
    try {
      setTrip(await tripsApi.getTrip(code));
    } catch (thrown) {
      setError(getApiErrorMessage(thrown, 'Could not load this trip.'));
    } finally {
      setLoading(false);
    }
  }, [code]);

  useEffect(() => {
    void loadTrip();
  }, [loadTrip]);

  useEffect(() => {
    if (!trip) return;
    if (tracking.status !== trip.status) {
      setTrip((current) => current ? { ...current, status: tracking.status } : current);
      if (tracking.status === 'completed' || tracking.status === 'cancelled') {
        toast.info(tracking.status === 'completed' ? 'Trip completed. Opening your receipt.' : 'This trip was cancelled.');
      }
    }
    if (tracking.status === 'completed' || tracking.status === 'cancelled') {
      const timer = window.setTimeout(() => navigate(`/trips/${code}`, { replace: true }), 1_200);
      return () => window.clearTimeout(timer);
    }
  }, [code, navigate, tracking.status, trip]);

  async function cancelTrip() {
    if (!code) return;
    setMutating(true);
    try {
      await tripsApi.cancelTrip(code, 'changed_mind');
      setConfirmation(null);
      toast.info('Trip cancelled.');
      navigate(`/trips/${code}`, { replace: true });
    } catch (thrown) {
      toast.error(getApiErrorMessage(thrown, 'Could not cancel this trip.'));
    } finally {
      setMutating(false);
    }
  }

  async function triggerSos() {
    if (!code || !trip) return;
    setMutating(true);
    try {
      let point: LatLng | null = geolocation.position
        ? { lat: geolocation.position.lat, lng: geolocation.position.lng }
        : null;
      if (!point) {
        try {
          const current = await geolocation.request();
          point = { lat: current.lat, lng: current.lng };
        } catch {
          const fallback = tracking.driverPosition ?? trip.pickup;
          point = { lat: fallback.lat, lng: fallback.lng };
        }
      }
      await tripsApi.triggerSos(code, point.lat, point.lng);
      setConfirmation(null);
      toast.success('SOS sent. The safety team has been alerted.');
    } catch (thrown) {
      toast.error(getApiErrorMessage(thrown, 'SOS could not be sent. Call emergency services now.'));
    } finally {
      setMutating(false);
    }
  }

  if (!code) return <EmptyState title="Invalid trip link" hint="This trip code is missing." />;
  if (loading) return <div className="h-[calc(100dvh-4rem)]"><Skeleton variant="map-placeholder" className="h-2/3" /><div className="space-y-3 p-4"><Skeleton variant="card" /><Skeleton lines={3} /></div></div>;
  if (error || !trip) return <EmptyState title="Trip did not load" hint={error ?? 'Trip not found.'} action={{ label: 'Retry', onClick: loadTrip }} />;

  const driverPosition = tracking.driverPosition ?? trip.pickup;
  const canCancel = tracking.status === 'assigned' || tracking.status === 'arrived';
  const vehicleName = [trip.vehicle.color, trip.vehicle.brand, trip.vehicle.model].filter(Boolean).join(' ') || trip.categoryName;

  return (
    <main className="relative h-[calc(100dvh-4rem)] overflow-hidden lg:pr-[420px]">
      <ConnectionPill state={tracking.connectionState} />
      <MapView pickup={trip.pickup} dropoff={trip.dropoff} driver={driverPosition} className="h-full" />

      <Button
        variant="danger"
        onClick={() => setConfirmation('sos')}
        className="fixed right-4 top-4 z-[500] h-14 w-14 rounded-full px-0 shadow-lg lg:right-[436px]"
        aria-label="Send SOS alert"
      >
        SOS
      </Button>

      <BottomSheet
        open
        snapPoint={snapPoint}
        onSnapPointChange={setSnapPoint}
        className="lg:!inset-y-0 lg:!left-auto lg:!right-0 lg:!h-auto lg:!w-[420px] lg:rounded-none lg:border-l lg:border-border"
      >
        <div className="space-y-4 pb-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-ink-500">Trip {trip.publicCode}</p>
              <AnimatePresence mode="wait">
                <motion.h1
                  key={tracking.status}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2, ease: EASE_OUT }}
                  className="text-xl font-bold"
                >
                  {tracking.status === 'assigned' && 'Driver is on the way'}
                  {tracking.status === 'arrived' && 'Driver has arrived'}
                  {tracking.status === 'in_progress' && 'You are on your way'}
                  {tracking.status === 'completed' && 'Trip complete'}
                  {tracking.status === 'cancelled' && 'Trip cancelled'}
                </motion.h1>
              </AnimatePresence>
            </div>
            <StatusBadge status={tracking.status} />
          </div>

          <TripStatusStepper status={tracking.status} />

          <Card>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-cholo-50 text-lg font-bold text-cholo-700">
                {trip.driver.name.charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{trip.driver.name} · ★ {trip.driver.rating}</p>
                <p className="truncate text-sm text-ink-500">{vehicleName}</p>
                <p className="text-sm font-semibold text-ink-900">{trip.vehicle.registrationNo}</p>
              </div>
              <a
                href={`tel:${trip.driver.phone}`}
                className="flex h-11 min-w-11 items-center justify-center rounded-xl border border-border px-3 font-semibold text-cholo-700"
              >
                Call
              </a>
            </div>
          </Card>

          <div className="rounded-xl bg-surface-alt p-3 text-sm">
            <p><span className="font-semibold">A</span> {trip.pickup.address || 'Pickup'}</p>
            <p className="mt-2"><span className="font-semibold">B</span> {trip.dropoff.address || 'Dropoff'}</p>
            <p className="mt-3 border-t border-border pt-3 font-semibold">Estimated {formatBDT(trip.estimate.fare)}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button variant="secondary" onClick={() => setChatOpen(true)}>Chat</Button>
            {canCancel ? (
              <Button variant="danger" onClick={() => setConfirmation('cancel')}>Cancel trip</Button>
            ) : (
              <Button variant="secondary" onClick={() => navigate(`/trips/${code}`)}>Trip details</Button>
            )}
          </div>
        </div>
      </BottomSheet>

      {user && <ChatSheet open={chatOpen} tripCode={code} currentUserId={user.id} onClose={() => setChatOpen(false)} />}
      <ConfirmSheet
        open={confirmation === 'cancel'}
        title="Cancel this trip?"
        hint="A cancellation fee may apply after the grace period or once your driver arrives."
        confirmLabel="Cancel trip"
        danger
        loading={mutating}
        onConfirm={cancelTrip}
        onClose={() => setConfirmation(null)}
      />
      <ConfirmSheet
        open={confirmation === 'sos'}
        title="Send an emergency SOS?"
        hint="This immediately records your location and alerts the Cholo safety team. Use it only for a real safety concern."
        confirmLabel="Send SOS"
        danger
        loading={mutating}
        onConfirm={triggerSos}
        onClose={() => setConfirmation(null)}
      />
    </main>
  );
}
