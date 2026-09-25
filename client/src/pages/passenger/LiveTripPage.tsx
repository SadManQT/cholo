import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';
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
import { useSocket } from '../../context/socket';
import { useGeolocation } from '../../hooks/useGeolocation';
import { useRideTracking } from '../../hooks/useRideTracking';
import type { SocketTripStatus, TripDetail } from '../../types/ride.types';
import type { LatLng } from '../../types/geo.types';
import { getApiErrorMessage } from '../../utils/apiError';
import { formatBDT } from '../../utils/format';
import { EASE_OUT } from '../../utils/motion';
import { t } from '../../i18n';

export function LiveTripPage() {
  const { code } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { socket } = useSocket();
  const geolocation = useGeolocation();
  const [trip, setTrip] = useState<TripDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [snapPoint, setSnapPoint] = useState<SnapPoint>('half');
  const [chatOpen, setChatOpen] = useState(false);
  const [confirmation, setConfirmation] = useState<'cancel' | 'sos' | null>(null);
  const [mutating, setMutating] = useState(false);
  const [sharing, setSharing] = useState(false);
  const tracking = useRideTracking(code, trip?.status ?? 'assigned');

  const loadTrip = useCallback(async () => {
    if (!code) return;
    setLoading(true);
    setError(null);
    try {
      setTrip(await tripsApi.getTrip(code));
    } catch (thrown) {
      setError(getApiErrorMessage(thrown, t('Could not load this trip.')));
    } finally {
      setLoading(false);
    }
  }, [code]);

  useEffect(() => {
    void loadTrip();
  }, [loadTrip]);

  useEffect(() => {
    if (!socket) return;
    const onStatus = (payload: SocketTripStatus) => {
      if (!payload.stopReached) return;
      const reachedAt = new Date().toISOString();
      setTrip((current) => current && {
        ...current,
        stops: current.stops.map((stop) => (stop.order === payload.stopReached ? { ...stop, arrivedAt: reachedAt } : stop)),
      });
    };
    socket.on('trip:status', onStatus);
    return () => {
      socket.off('trip:status', onStatus);
    };
  }, [socket]);

  // Follow server-pushed status changes only; also reacting to `trip` made the page and the tracking hook
  // correct each other forever when it opened on a trip already past "assigned".
  const lastTrackedStatus = useRef(tracking.status);
  useEffect(() => {
    if (lastTrackedStatus.current === tracking.status) return;
    lastTrackedStatus.current = tracking.status;
    setTrip((current) => (current && current.status !== tracking.status ? { ...current, status: tracking.status } : current));
    if (tracking.status === 'completed' || tracking.status === 'cancelled') {
      toast.info(tracking.status === 'completed' ? t('Trip completed. Opening your receipt.') : t('This trip was cancelled.'));
    }
  }, [tracking.status]);

  useEffect(() => {
    if (tracking.status !== 'completed' && tracking.status !== 'cancelled') return;
    const timer = window.setTimeout(() => navigate(`/trips/${code}`, { replace: true }), 1_200);
    return () => window.clearTimeout(timer);
  }, [code, navigate, tracking.status]);

  async function cancelTrip() {
    if (!code) return;
    setMutating(true);
    try {
      await tripsApi.cancelTrip(code, 'changed_mind');
      setConfirmation(null);
      toast.info(t('Trip cancelled.'));
      navigate(`/trips/${code}`, { replace: true });
    } catch (thrown) {
      toast.error(getApiErrorMessage(thrown, t('Could not cancel this trip.')));
    } finally {
      setMutating(false);
    }
  }

  // Family can follow the trip without an account. The share sheet on phones, the clipboard elsewhere.
  async function shareTrip() {
    if (!code || !trip) return;
    setSharing(true);
    try {
      const { url } = await tripsApi.createShareLink(code);
      const text = `I'm on a Cholo ride with ${trip.driver.name} (${trip.vehicle.registrationNo}). Follow it live:`;
      if (navigator.share) {
        await navigator.share({ title: t('Follow my Cholo ride'), text, url }).catch(() => {});
      } else {
        await navigator.clipboard.writeText(`${text} ${url}`);
        toast.success(t('Trip link copied. Send it to someone you trust.'));
      }
    } catch (thrown) {
      toast.error(getApiErrorMessage(thrown, t('Could not create a share link.')));
    } finally {
      setSharing(false);
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
      toast.success(t('SOS sent. The safety team has been alerted.'));
    } catch (thrown) {
      toast.error(getApiErrorMessage(thrown, t('SOS could not be sent. Call emergency services now.')));
    } finally {
      setMutating(false);
    }
  }

  if (!code) return <EmptyState title={t('Invalid trip link')} hint={t('This trip code is missing.')} />;
  if (loading) return <div className="h-[calc(100dvh-4rem)]"><Skeleton variant="map-placeholder" className="h-2/3" /><div className="space-y-3 p-4"><Skeleton variant="card" /><Skeleton lines={3} /></div></div>;
  if (error || !trip) return <EmptyState title={t('Trip did not load')} hint={error ?? t('Trip not found.')} action={{ label: t('Retry'), onClick: loadTrip }} />;

  const driverPosition = tracking.driverPosition ?? trip.pickup;
  const canCancel = tracking.status === 'assigned' || tracking.status === 'arrived';
  const vehicleName = [trip.vehicle.color, trip.vehicle.brand, trip.vehicle.model].filter(Boolean).join(' ') || trip.categoryName;

  return (
    <main className="relative h-[calc(100dvh-4rem)] overflow-hidden lg:pr-[420px]">
      <ConnectionPill state={tracking.connectionState} />
      <MapView pickup={trip.pickup} dropoff={trip.dropoff} stops={trip.stops} driver={driverPosition} className="h-full" />

      <Button
        variant="danger"
        onClick={() => setConfirmation('sos')}
        className="fixed right-4 top-4 z-[500] h-14 w-14 rounded-full px-0 shadow-lg lg:right-[436px]"
        aria-label={t('Send SOS alert')}
      >
        {t('SOS')}
      </Button>

      <BottomSheet
        open
        snapPoint={snapPoint}
        onSnapPointChange={setSnapPoint}
        className="lg:!top-0 lg:!left-auto lg:!right-0 lg:!h-auto lg:!w-[420px] lg:rounded-none lg:border-l lg:border-border"
      >
        <div className="space-y-4 pb-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-ink-500">{t('Trip')} {trip.publicCode}</p>
              <AnimatePresence mode="wait">
                <motion.h1
                  key={tracking.status}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2, ease: EASE_OUT }}
                  className="text-xl font-bold"
                >
                  {tracking.status === 'assigned' && t('Driver is on the way')}
                  {tracking.status === 'arrived' && t('Driver has arrived')}
                  {tracking.status === 'in_progress' && t('You are on your way')}
                  {tracking.status === 'completed' && t('Trip complete')}
                  {tracking.status === 'cancelled' && t('Trip cancelled')}
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
                {t('Call')}
              </a>
            </div>
          </Card>

          <div className="rounded-xl bg-surface-alt p-3 text-sm">
            <p><span className="font-semibold">{t('A')}</span> {trip.pickup.address || t('Pickup')}</p>
            {trip.stops.map((stop) => (
              <p key={stop.order} className={`mt-2 ${stop.arrivedAt ? 'text-ink-500 line-through' : ''}`}>
                <span className="font-semibold">{stop.order}</span> {stop.address || t('Stop {0}', stop.order)}
              </p>
            ))}
            <p className="mt-2"><span className="font-semibold">{t('B')}</span> {trip.dropoff.address || t('Dropoff')}</p>
            <p className="mt-3 border-t border-border pt-3 font-semibold">{t('Estimated {0}', formatBDT(trip.estimate.fare))}</p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Button variant="secondary" onClick={() => setChatOpen(true)}>{t('Chat')}</Button>
            <Button variant="secondary" loading={sharing} onClick={() => void shareTrip()}>{t('Share trip')}</Button>
            {canCancel ? (
              <Button variant="danger" onClick={() => setConfirmation('cancel')}>{t('Cancel trip')}</Button>
            ) : (
              <Button variant="secondary" onClick={() => navigate(`/trips/${code}`)}>{t('Trip details')}</Button>
            )}
          </div>
        </div>
      </BottomSheet>

      {user && <ChatSheet open={chatOpen} tripCode={code} currentUserId={user.id} onClose={() => setChatOpen(false)} />}
      <ConfirmSheet
        open={confirmation === 'cancel'}
        title={t('Cancel this trip?')}
        hint={t('A cancellation fee may apply after the grace period or once your driver arrives.')}
        confirmLabel={t('Cancel trip')}
        danger
        loading={mutating}
        onConfirm={cancelTrip}
        onClose={() => setConfirmation(null)}
      />
      <ConfirmSheet
        open={confirmation === 'sos'}
        title={t('Send an emergency SOS?')}
        hint={t('This immediately records your location and alerts the Cholo safety team. Use it only for a real safety concern.')}
        confirmLabel={t('Send SOS')}
        danger
        loading={mutating}
        onConfirm={triggerSos}
        onClose={() => setConfirmation(null)}
      />
    </main>
  );
}
