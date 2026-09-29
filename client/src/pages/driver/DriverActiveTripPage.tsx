import { AnimatePresence, motion } from 'motion/react';
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
import { EASE_OUT } from '../../utils/motion';
import { formatBDT } from '../../utils/format';
import { distanceKm, formatMeters } from '../../utils/geo';
import { t } from '../../i18n';

function completionMessage(result: tripsApi.TripCompletion) {
  const amount = formatBDT(result.fare.total);
  if (result.payment.method === 'cash') {
    return result.endedEarly
      ? t('Trip ended early. Collect {0} in cash, for the distance driven.', amount)
      : t('Trip completed. Collect {0} in cash.', amount);
  }
  if (result.payment.status === 'paid') return t('Trip completed. {0} was paid in the app.', amount);
  return t('Trip completed. The rider pays {0} in the app.', amount);
}

function actionFor(status: TripStatus) {
  if (status === 'assigned') return { label: t('mark arrived'), next: 'arrived' as const };
  if (status === 'arrived') return { label: t('start trip'), next: 'in_progress' as const };
  if (status === 'in_progress') return { label: t('complete trip'), next: 'completed' as const };
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
  const [endEarlyOpen, setEndEarlyOpen] = useState(false);
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
      setError(getApiErrorMessage(thrown, t('Could not load the active trip.')));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTrip();
  }, [loadTrip]);

  const lastTrackedStatus = useRef(tracking.status);
  useEffect(() => {
    if (lastTrackedStatus.current === tracking.status) return;
    lastTrackedStatus.current = tracking.status;
    setTrip((current) => (current && current.status !== tracking.status ? { ...current, status: tracking.status } : current));
    if (tracking.status === 'cancelled') toast.info(t('The trip was cancelled. Opening its details.'));
  }, [tracking.status]);

  const stopRequestedAt = trip?.earlyStopRequestedAt ?? tracking.earlyStopRequestedAt;
  const announcedStop = useRef(stopRequestedAt);
  useEffect(() => {
    if (!stopRequestedAt || announcedStop.current) return;
    announcedStop.current = stopRequestedAt;
    toast.info(t('Your rider wants to get out here. You can end the trip where you are.'));
  }, [stopRequestedAt]);

  const handshake = tracking.handshake ?? (trip && {
    startRequestedAt: trip.startRequestedAt, pickupConfirmedAt: trip.pickupConfirmedAt, arrivalDisputedAt: trip.arrivalDisputedAt,
  });
  const riderConfirmed = trip?.status === 'arrived' && Boolean(handshake?.pickupConfirmedAt);
  const awaitingRider = trip?.status === 'arrived' && !riderConfirmed && Boolean(handshake?.startRequestedAt);

  const loaded = Boolean(trip);
  const announcedConfirm = useRef<boolean | undefined>(undefined);
  useEffect(() => {
    if (!loaded) return;
    if (riderConfirmed && announcedConfirm.current === false) toast.success(t('Your rider confirmed they are in the car.'));
    announcedConfirm.current = riderConfirmed;
  }, [loaded, riderConfirmed]);
  const arrivalDisputed = trip?.status === 'assigned' && Boolean(handshake?.arrivalDisputedAt);

  const tripCode = trip?.publicCode;
  useEffect(() => {
    if (!tripCode || (tracking.status !== 'completed' && tracking.status !== 'cancelled')) return;
    const timer = window.setTimeout(() => navigate(`/driver/trips/${tripCode}`, { replace: true }), 1_200);
    return () => window.clearTimeout(timer);
  }, [navigate, tracking.status, tripCode]);

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
    let completion: tripsApi.TripCompletion | null = null;
    try {
      if (trip.status === 'arrived') {
        const result = await tripsApi.startTrip(trip.publicCode);
        if (result.status !== 'in_progress') {
          tracking.patchHandshake({ startRequestedAt: result.startRequestedAt ?? new Date().toISOString() });
          toast.info(t('Asked {0} to confirm they are in the car. The trip starts when they do.', trip.passenger.name));
          return;
        }
      } else if (trip.status === 'assigned') await tripsApi.markArrived(trip.publicCode, geolocation.position);
      else completion = await tripsApi.completeTrip(trip.publicCode, 0, geolocation.position);

      if (action.next === 'arrived') tracking.patchHandshake({ startRequestedAt: null, pickupConfirmedAt: null });
      toast.success(
        completion ? completionMessage(completion)
          : action.next === 'in_progress' ? t('Trip started.')
            : t('Marked as arrived. Your rider will confirm when they are in the car.'),
      );
      if (action.next === 'completed') {
        navigate(`/driver/trips/${trip.publicCode}`, { replace: true });
      } else {
        setTrip({ ...trip, status: action.next });
      }
    } catch (thrown) {
      toast.error(getApiErrorMessage(thrown, t('Trip status could not be updated.')));
      void loadTrip();
    } finally {
      setMutating(false);
    }
  }

  async function reachStop(order: number) {
    if (!trip) return;
    setMutating(true);
    try {
      const reached = await tripsApi.markStopReached(trip.publicCode, order, geolocation.position);
      setTrip({ ...trip, stops: trip.stops.map((stop) => (stop.order === order ? { ...stop, arrivedAt: reached.arrivedAt } : stop)) });
      toast.success(t('Stop {0} reached.', order));
    } catch (thrown) {
      toast.error(getApiErrorMessage(thrown, t('Could not mark this stop.')));
      void loadTrip();
    } finally {
      setMutating(false);
    }
  }

  async function endTripHere() {
    if (!trip) return;
    setMutating(true);
    try {
      const result = await tripsApi.completeTrip(trip.publicCode, 0, geolocation.position, { endEarly: true });
      toast.success(completionMessage(result));
      navigate(`/driver/trips/${trip.publicCode}`, { replace: true });
    } catch (thrown) {
      toast.error(getApiErrorMessage(thrown, t('Trip status could not be updated.')));
    } finally {
      setMutating(false);
      setEndEarlyOpen(false);
    }
  }

  async function cancelTrip() {
    if (!trip) return;
    setMutating(true);
    try {
      await tripsApi.cancelTrip(trip.publicCode, 'vehicle_issue');
      toast.info(t('Trip cancelled.'));
      navigate(`/driver/trips/${trip.publicCode}`, { replace: true });
    } catch (thrown) {
      toast.error(getApiErrorMessage(thrown, t('Could not cancel this trip.')));
    } finally {
      setMutating(false);
      setCancelOpen(false);
    }
  }

  if (loading) return <div className="h-[calc(100dvh-var(--app-chrome))]"><Skeleton variant="map-placeholder" className="h-2/3" /><div className="space-y-3 p-4"><Skeleton variant="card" /><Skeleton lines={2} /></div></div>;
  if (error) return <EmptyState title={t('Active trip did not load')} hint={error} action={{ label: t('Retry'), onClick: loadTrip }} />;
  if (!trip) return <EmptyState title={t('No active trip')} hint={t('Accept a ride offer from Driver Home to start.')} action={{ label: t('Driver home'), onClick: () => navigate('/driver') }} />;

  const action = actionFor(trip.status);
  const driverPosition = geolocation.position ?? trip.pickup;
  const nextStop = trip.status === 'in_progress' ? trip.stops.find((stop) => !stop.arrivedAt) : undefined;
  const heading = trip.status === 'arrived' ? t('At the pickup') : trip.status !== 'in_progress' ? t('Head to pickup') : nextStop ? t('Drive to stop {0}', nextStop.order) : t('Drive to dropoff');
  const destination = trip.status !== 'in_progress' ? trip.pickup.address : nextStop ? nextStop.address : trip.dropoff.address;

  const target = trip.status === 'assigned' ? trip.pickup : trip.status === 'in_progress' ? (nextStop ?? trip.dropoff) : null;
  const metersLeft = target && geolocation.position && trip.arrivalRadiusMeters
    ? Math.round(distanceKm(geolocation.position, target) * 1000)
    : null;
  const lockedReason = metersLeft != null && metersLeft > trip.arrivalRadiusMeters
    ? t(trip.status === 'assigned' ? '{0} to the pickup' : nextStop ? '{0} to stop {1}' : '{0} to the drop-off', formatMeters(metersLeft), nextStop?.order)
    : null;
  const startLockedReason = awaitingRider ? t('Waiting for {0} to confirm…', trip.passenger.name) : null;

  return (
    <main className="relative h-[calc(100dvh-var(--app-chrome))] overflow-hidden lg:pr-[420px]">
      <ConnectionPill state={tracking.connectionState} />
      <MapView pickup={trip.pickup} dropoff={trip.dropoff} stops={trip.stops} driver={driverPosition} className="h-full" />

      <BottomSheet
        open
        snapPoint={snapPoint}
        onSnapPointChange={setSnapPoint}
        className="lg:!top-[var(--app-chrome)] lg:!left-auto lg:!right-0 lg:!h-auto lg:!w-[420px] lg:rounded-none lg:border-l lg:border-border"
      >
        <div className="space-y-4 pb-2">
          <div className="flex items-start justify-between gap-3">
            <div><p className="text-sm text-ink-500">{trip.publicCode}</p><AnimatePresence mode="wait"><motion.h1 key={trip.status} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2, ease: EASE_OUT }} className="text-xl font-bold">{heading}</motion.h1></AnimatePresence></div>
            <StatusBadge status={trip.status} />
          </div>
          <TripStatusStepper status={trip.status} />

          <Card>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-cholo-50 text-lg font-bold text-cholo-700">{trip.passenger.name.charAt(0)}</div>
              <div className="min-w-0 flex-1"><p className="font-semibold">{trip.passenger.name} · ★ {trip.passenger.rating}</p><p className="truncate text-sm text-ink-500">{destination}</p></div>
              <a href={`tel:${trip.passenger.phone}`} className="flex h-11 items-center rounded-xl border border-border px-3 font-semibold text-cholo-700">{t('Call')}</a>
            </div>
          </Card>

          {trip.status === 'in_progress' && stopRequestedAt ? (
            <div role="status" className="space-y-2 rounded-xl bg-marigold-500/15 p-3 text-sm">
              <p><span className="font-semibold">{t('The rider asked to stop here.')}</span> {t('They pay for the distance driven so far.')}</p>
              <Button onClick={() => setEndEarlyOpen(true)} className="w-full">{t('End trip here')}</Button>
            </div>
          ) : nextStop
            ? <SlideToConfirm key={`stop-${nextStop.order}`} label={t('reached stop {0}', nextStop.order)} loading={mutating} lockedReason={lockedReason} onConfirm={() => void reachStop(nextStop.order)} />
            : action && <SlideToConfirm key={trip.status} label={action.label} loading={mutating} lockedReason={trip.status === 'arrived' ? startLockedReason : lockedReason} onConfirm={advanceTrip} />}
          {trip.status === 'arrived' && (
            <p role="status" className={`rounded-xl p-3 text-sm ${riderConfirmed ? 'bg-cholo-50 font-medium text-ink-900' : 'bg-surface-alt text-ink-500'}`}>
              {riderConfirmed
                ? t('{0} confirmed they are in the car. Slide to start the trip.', trip.passenger.name)
                : awaitingRider
                  ? t('{0} needs to confirm in their app that they are in the car. The trip starts as soon as they do.', trip.passenger.name)
                  : t('The trip starts only after {0} confirms in their app that they are in the car.', trip.passenger.name)}
            </p>
          )}
          {trip.status === 'in_progress' && !stopRequestedAt && (nextStop || lockedReason) && (
            <p className="text-center text-sm text-ink-500">{t('Rider wants to get out early? They need to tap "Stop here" in their app first.')}</p>
          )}
          {arrivalDisputed && (
            <p role="alert" className="rounded-xl bg-danger-600/10 p-3 text-sm text-danger-600">
              {t('Your rider says you are not at the pickup. Go to the pickup point and mark arrival again.')}
            </p>
          )}

          {geolocation.state === 'denied' && (
            <p className="rounded-xl bg-danger-600/10 p-3 text-sm text-danger-600">{t('Location permission is required for live passenger tracking.')}</p>
          )}

          <Button variant="secondary" onClick={() => setChatOpen(true)} className="w-full">{t('Chat with passenger')}</Button>
          {trip.stops.length > 0 && (
            <ol className="space-y-1 rounded-xl bg-surface-alt p-3 text-sm">
              {trip.stops.map((stop) => (
                <li key={stop.order} className={stop.arrivedAt ? 'text-ink-500 line-through' : ''}>
                  <span className="font-semibold">{t('Stop {0}', stop.order)}</span> · {stop.address || t('Pinned on the map')}
                </li>
              ))}
            </ol>
          )}
          {(trip.status === 'assigned' || trip.status === 'arrived') && (
            <Button variant="ghost" onClick={() => setCancelOpen(true)} className="w-full text-danger-600">{t('Cancel trip')}</Button>
          )}
        </div>
      </BottomSheet>

      {user && <ChatSheet open={chatOpen} tripCode={trip.publicCode} currentUserId={user.id} onClose={() => setChatOpen(false)} />}
      <ConfirmSheet
        open={endEarlyOpen}
        title={t('End the trip here?')}
        hint={t('The rider asked to get out. They pay for the distance driven so far, any stops not reached are dropped, and the trip is recorded as ended early.')}
        confirmLabel={t('End trip here')}
        loading={mutating}
        onConfirm={endTripHere}
        onClose={() => setEndEarlyOpen(false)}
      />
      <ConfirmSheet
        open={cancelOpen}
        title={t('Cancel this trip?')}
        hint={t('The passenger will be notified and the trip will close immediately.')}
        confirmLabel={t('Cancel trip')}
        danger
        loading={mutating}
        onConfirm={cancelTrip}
        onClose={() => setCancelOpen(false)}
      />
    </main>
  );
}
