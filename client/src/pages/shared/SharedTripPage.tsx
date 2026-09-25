import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import * as tripsApi from '../../api/trips.api';
import { MapView } from '../../components/map/MapView';
import { Card, EmptyState, Skeleton, StatusBadge } from '../../components/ui';
import type { SharedTrip } from '../../types/ride.types';
import { getApiErrorCode, getApiErrorMessage } from '../../utils/apiError';
import { formatDateTime } from '../../utils/format';
import { t } from '../../i18n';

const POLL_MS = 5_000;

const HEADLINES: Record<SharedTrip['status'], string> = {
  assigned: 'Driver is heading to the pickup',
  arrived: 'Driver is at the pickup',
  in_progress: 'On the way',
  completed: 'Arrived safely',
  cancelled: 'This trip was cancelled',
};

/** Public: what a rider's family sees from a share link. No login, no phone numbers. */
export function SharedTripPage() {
  const { token } = useParams();
  const [trip, setTrip] = useState<SharedTrip | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setTrip(await tripsApi.getSharedTrip(token));
      setError(null);
    } catch (thrown) {
      const code = getApiErrorCode(thrown);
      setError(code === 'SHARE_LINK_INVALID' ? t('This link has expired or is not valid.') : getApiErrorMessage(thrown, t('Could not load this trip.')));
    }
  }, [token]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  const finished = trip?.status === 'completed' || trip?.status === 'cancelled';
  const vehicleName = trip ? [trip.vehicle.color, trip.vehicle.brand, trip.vehicle.model].filter(Boolean).join(' ') : '';

  return (
    <div className="min-h-dvh bg-surface-alt">
      <header className="flex items-center justify-between border-b border-border bg-surface px-4 py-3">
        <span className="text-lg font-extrabold text-cholo-700">{t('Cholo')}</span>
        <span className="text-sm text-ink-500">{t('Live trip')}</span>
      </header>
      {!trip && !error && <div className="p-4"><Skeleton variant="map-placeholder" className="h-72" /><Skeleton variant="card" className="mt-4" /></div>}
      {!trip && error && <EmptyState title={t('Trip not available')} hint={error} />}
      {trip && (
        <main className="mx-auto max-w-3xl space-y-4 p-4">
          <MapView pickup={trip.pickup} dropoff={trip.dropoff} stops={trip.stops} driver={finished ? null : trip.location} className="h-80 rounded-2xl" />
          <Card>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="text-xl font-bold">{t(HEADLINES[trip.status])}</h1>
                <p className="text-sm text-ink-500">
                  {trip.location?.at && !finished ? t('Position updated {0}', formatDateTime(trip.location.at)) : trip.endedAt ? t('Ended {0}', formatDateTime(trip.endedAt)) : t('Updates every few seconds')}
                </p>
              </div>
              <StatusBadge status={trip.status} />
            </div>
            <div className="mt-4 flex items-center gap-3 border-t border-border pt-4">
              {trip.driver.photoUrl
                ? <img src={trip.driver.photoUrl} alt="" className="h-12 w-12 rounded-full object-cover" />
                : <span className="flex h-12 w-12 items-center justify-center rounded-full bg-cholo-50 text-lg font-bold text-cholo-700">{trip.driver.firstName.charAt(0)}</span>}
              <div>
                <p className="font-semibold">{trip.driver.firstName} · ★ {Number(trip.driver.rating).toFixed(1)}</p>
                <p className="text-sm text-ink-500">{vehicleName}</p>
                <p className="text-sm font-semibold">{trip.vehicle.registrationNo}</p>
              </div>
            </div>
          </Card>
          <Card className="space-y-2 text-sm">
            <p><span className="font-semibold">{t('From')}</span> {trip.pickup.address || t('Pickup')}</p>
            {trip.stops.map((stop, index) => (
              <p key={index}><span className="font-semibold">{t('Stop {0}', index + 1)}</span> {stop.address || t('Pinned on the map')}</p>
            ))}
            <p><span className="font-semibold">{t('To')}</span> {trip.dropoff.address || t('Dropoff')}</p>
          </Card>
          <p className="text-center text-xs text-ink-500">{t('Worried? Call the rider first. In an emergency, call 999.')}</p>
        </main>
      )}
    </div>
  );
}
