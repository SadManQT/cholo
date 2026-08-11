import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as tripsApi from '../../api/trips.api';
import { MapView } from '../../components/map/MapView';
import { ChatSheet } from '../../components/ride/ChatSheet';
import { ConfirmSheet } from '../../components/ride/ConfirmSheet';
import { ConnectionPill } from '../../components/ride/ConnectionPill';
import { SlideToConfirm } from '../../components/ride/SlideToConfirm';
import { TripStatusStepper } from '../../components/ride/TripStatusStepper';
import { BottomSheet, Button, Card, EmptyState, Skeleton, StatusBadge, toast } from '../../components/ui';
import type { SnapPoint } from '../../components/ui/BottomSheet';
import { useAuth } from '../../context/auth';
import { useSocket } from '../../context/socket';
import { useGeolocation } from '../../hooks/useGeolocation';
import { useRideTracking } from '../../hooks/useRideTracking';
import type { TripDetail, TripStatus } from '../../types/ride.types';
import { getApiErrorMessage } from '../../utils/apiError';

function actionFor(status: TripStatus) {
  if (status === 'assigned') return { label: 'mark arrived', next: 'arrived' as const };
  if (status === 'arrived') return { label: 'start trip', next: 'in_progress' as const };
  if (status === 'in_progress') return { label: 'complete trip', next: 'completed' as const };
  return null;
}

export function DriverActiveTripPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { socket } = useSocket();
  const geolocation = useGeolocation({ watch: true });
  const [trip, setTrip] = useState<TripDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mutating, setMutating] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [snapPoint, setSnapPoint] = useState<SnapPoint>('half');
  const lastSentAt = useRef(0);
  const tracking = useRideTracking(trip?.publicCode, trip?.status ?? 'assigned');

  const loadTrip = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await tripsApi.listTrips({ status: 'active', role: 'driver', limit: 1 });
      const summary = result.data[0];
      setTrip(summary ? await tripsApi.getTrip(summary.publicCode) : null);
    } catch (thrown) {
      setError(getApiErrorMessage(thrown, 'Could not load the active trip.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTrip();
  }, [loadTrip]);

  useEffect(() => {
    if (!trip) return;
    if (tracking.status !== trip.status) {
      setTrip((current) => current ? { ...current, status: tracking.status } : current);
      if (tracking.status === 'cancelled') toast.info('The trip was cancelled. Opening its details.');
    }
    if (tracking.status === 'completed' || tracking.status === 'cancelled') {
      const timer = window.setTimeout(
        () => navigate(`/driver/trips/${trip.publicCode}`, { replace: true }),
        1_200,
      );
      return () => window.clearTimeout(timer);
    }
  }, [navigate, tracking.status, trip]);

  useEffect(() => {
    if (!socket || !geolocation.position || !trip) return;
    const now = Date.now();
    if (now - lastSentAt.current < 3_500) return;
    lastSentAt.current = now;
    socket.emit('location:update', geolocation.position);
  }, [geolocation.position, socket, tracking.connectionState, trip]);

  async function advanceTrip() {
    if (!trip) return;
    const action = actionFor(trip.status);
    if (!action) return;
    setMutating(true);
    try {
      if (trip.status === 'assigned') await tripsApi.markArrived(trip.publicCode);
      else if (trip.status === 'arrived') await tripsApi.startTrip(trip.publicCode);
      else await tripsApi.completeTrip(trip.publicCode);

      toast.success(action.next === 'completed' ? 'Trip completed.' : `Trip is now ${action.next.replace('_', ' ')}.`);
      if (action.next === 'completed') {
        navigate(`/driver/trips/${trip.publicCode}`, { replace: true });
      } else {
        setTrip({ ...trip, status: action.next });
      }
    } catch (thrown) {
      toast.error(getApiErrorMessage(thrown, 'Trip status could not be updated.'));
      void loadTrip();
    } finally {
      setMutating(false);
    }
  }

  async function cancelTrip() {
    if (!trip) return;
    setMutating(true);
    try {
      await tripsApi.cancelTrip(trip.publicCode, 'vehicle_issue');
      toast.info('Trip cancelled.');
      navigate(`/driver/trips/${trip.publicCode}`, { replace: true });
    } catch (thrown) {
      toast.error(getApiErrorMessage(thrown, 'Could not cancel this trip.'));
    } finally {
      setMutating(false);
      setCancelOpen(false);
    }
  }

  if (loading) return <div className="h-[calc(100dvh-4rem)]"><Skeleton variant="map-placeholder" className="h-2/3" /><div className="space-y-3 p-4"><Skeleton variant="card" /><Skeleton lines={2} /></div></div>;
  if (error) return <EmptyState title="Active trip did not load" hint={error} action={{ label: 'Retry', onClick: loadTrip }} />;
  if (!trip) return <EmptyState title="No active trip" hint="Accept a ride offer from Driver Home to start." action={{ label: 'Driver home', onClick: () => navigate('/driver') }} />;

  const action = actionFor(trip.status);
  const driverPosition = geolocation.position ?? trip.pickup;

  return (
    <main className="relative h-[calc(100dvh-4rem)] overflow-hidden lg:pr-[420px]">
      <ConnectionPill state={tracking.connectionState} />
      <MapView pickup={trip.pickup} dropoff={trip.dropoff} driver={driverPosition} className="h-full" />

      <BottomSheet
        open
        snapPoint={snapPoint}
        onSnapPointChange={setSnapPoint}
        className="lg:!inset-y-0 lg:!left-auto lg:!right-0 lg:!h-auto lg:!w-[420px] lg:rounded-none lg:border-l lg:border-border"
      >
        <div className="space-y-4 pb-2">
          <div className="flex items-start justify-between gap-3">
            <div><p className="text-sm text-ink-500">{trip.publicCode}</p><h1 className="text-xl font-bold">{trip.status === 'in_progress' ? 'Drive to dropoff' : 'Head to pickup'}</h1></div>
            <StatusBadge status={trip.status} />
          </div>
          <TripStatusStepper status={trip.status} />

          <Card>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-cholo-50 text-lg font-bold text-cholo-700">{trip.passenger.name.charAt(0)}</div>
              <div className="min-w-0 flex-1"><p className="font-semibold">{trip.passenger.name} · ★ {trip.passenger.rating}</p><p className="truncate text-sm text-ink-500">{trip.status === 'in_progress' ? trip.dropoff.address : trip.pickup.address}</p></div>
              <a href={`tel:${trip.passenger.phone}`} className="flex h-11 items-center rounded-xl border border-border px-3 font-semibold text-cholo-700">Call</a>
            </div>
          </Card>

          {geolocation.state === 'denied' && (
            <p className="rounded-xl bg-danger-600/10 p-3 text-sm text-danger-600">Location permission is required for live passenger tracking.</p>
          )}

          <Button variant="secondary" onClick={() => setChatOpen(true)} className="w-full">Chat with passenger</Button>
          {action && <SlideToConfirm key={trip.status} label={action.label} loading={mutating} onConfirm={advanceTrip} />}
          {(trip.status === 'assigned' || trip.status === 'arrived') && (
            <Button variant="ghost" onClick={() => setCancelOpen(true)} className="w-full text-danger-600">Cancel trip</Button>
          )}
        </div>
      </BottomSheet>

      {user && <ChatSheet open={chatOpen} tripCode={trip.publicCode} currentUserId={user.id} onClose={() => setChatOpen(false)} />}
      <ConfirmSheet
        open={cancelOpen}
        title="Cancel this trip?"
        hint="The passenger will be notified and the trip will close immediately."
        confirmLabel="Cancel trip"
        danger
        loading={mutating}
        onConfirm={cancelTrip}
        onClose={() => setCancelOpen(false)}
      />
    </main>
  );
}
