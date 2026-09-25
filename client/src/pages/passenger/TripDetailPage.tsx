import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import * as meApi from '../../api/me.api';
import * as tripsApi from '../../api/trips.api';
import { MapView } from '../../components/map/MapView';
import { PayTripCard } from '../../components/payment/PayTripCard';
import { RateTripCard } from '../../components/ride/RateTripCard';
import { ReportDialog } from '../../components/ride/ReportDialog';
import { TripStatusStepper } from '../../components/ride/TripStatusStepper';
import { Button, Card, EmptyState, Skeleton, StatusBadge, toast } from '../../components/ui';
import type { TripDetail } from '../../types/ride.types';
import { getApiErrorMessage } from '../../utils/apiError';
import { formatBDT, formatDateTime, formatDistance } from '../../utils/format';
import { staggerStyle } from '../../utils/stagger';
import { t } from '../../i18n';

const FARE_ROWS: Array<{ key: keyof TripDetail['fare']; label: string }> = [
  { key: 'base', label: t('Base fare') },
  { key: 'distance', label: t('Distance') },
  { key: 'time', label: t('Time') },
  { key: 'waiting', label: t('Waiting') },
  { key: 'surge', label: t('Surge') },
  { key: 'bookingFee', label: t('Booking fee') },
  { key: 'discount', label: t('Discount') },
];

export function TripDetailPage({ driverMode = false }: { driverMode?: boolean }) {
  const { code } = useParams();
  const [trip, setTrip] = useState<TripDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [favoriteBusy, setFavoriteBusy] = useState(false);

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

  async function shareReceipt() {
    if (!trip) return;
    const receiptSuffix = trip.receipt ? ` (Receipt ${trip.receipt.receiptNo})` : '';
    const text = `Cholo trip ${trip.publicCode}: ${trip.pickup.address} → ${trip.dropoff.address}, ${formatBDT(trip.fare.total)}${receiptSuffix}.`;
    const share = (navigator as unknown as { share?: (data: ShareData) => Promise<void> }).share;
    try {
      if (share) await share.call(navigator, { title: t('Cholo receipt {0}', trip.publicCode), text });
      else await navigator.clipboard.writeText(text);
      toast.success(share ? t('Receipt shared.') : t('Receipt copied.'));
    } catch {
    }
  }

  async function toggleFavorite() {
    if (!trip) return;
    const next = !trip.driverIsFavorite;
    setFavoriteBusy(true);
    try {
      await meApi.setFavoriteDriver(trip.driver.id, next);
      setTrip({ ...trip, driverIsFavorite: next });
      toast.success(next ? t('{0} gets your ride requests first when nearby.', trip.driver.name) : t('Removed from favourite drivers.'));
    } catch (thrown) {
      toast.error(getApiErrorMessage(thrown, t('Could not update favourite drivers.')));
    } finally {
      setFavoriteBusy(false);
    }
  }

  if (loading) return <main className="mx-auto max-w-3xl space-y-4 p-4"><Skeleton variant="map-placeholder" /><Skeleton variant="card" /><Skeleton lines={5} /></main>;
  if (error || !trip) return <EmptyState title={t('Trip did not load')} hint={error ?? t('Trip not found.')} action={{ label: t('Retry'), onClick: loadTrip }} />;

  const counterparty = trip.participantRole === 'passenger' ? trip.driver : trip.passenger;
  const backPath = driverMode ? '/driver/trips' : '/trips';
  const displayFare = trip.status === 'completed' ? trip.fare.total : trip.estimate.fare;

  return (
    <main className="mx-auto min-h-screen max-w-3xl bg-surface px-4 py-5 md:px-6 print:max-w-none">
      <div className="mb-4 flex items-center justify-between gap-3 print:hidden">
        <Link to={backPath} className="font-semibold text-cholo-700">{t('← Trips')}</Link>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={shareReceipt}>{t('Share')}</Button>
          <Button variant="secondary" onClick={() => window.print()}>{t('Print')}</Button>
        </div>
      </div>

      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-ink-500">{trip.publicCode}</p>
          <h1 className="text-2xl font-bold">{t('Trip receipt')}</h1>
        </div>
        <StatusBadge status={trip.status} />
      </div>

      <MapView pickup={trip.pickup} dropoff={trip.dropoff} stops={trip.stops} className="mb-5 h-56 rounded-2xl" />

      <Card className="mb-4">
        <TripStatusStepper status={trip.status} />
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-4">
          <div>
            <p className="text-sm font-semibold">{counterparty.name} · ★ {counterparty.rating}</p>
            <p className="text-sm text-ink-500">
              {trip.categoryName}
              {trip.participantRole === 'passenger' && ` · ${trip.vehicle.registrationNo}`}
            </p>
          </div>
          {trip.participantRole === 'passenger' && trip.status === 'completed' && (
            <button
              type="button"
              aria-pressed={trip.driverIsFavorite}
              disabled={favoriteBusy}
              onClick={() => void toggleFavorite()}
              className={`flex min-h-11 items-center gap-1.5 rounded-xl border px-3 text-sm font-semibold transition-colors print:hidden ${trip.driverIsFavorite ? 'border-danger-600/40 bg-danger-600/5 text-danger-600' : 'border-border text-ink-900 hover:border-cholo-700'}`}
            >
              <span aria-hidden="true">{trip.driverIsFavorite ? '♥' : '♡'}</span>
              {trip.driverIsFavorite ? t('Favourite') : t('Add to favourites')}
            </button>
          )}
        </div>
      </Card>

      {trip.status === 'completed' && trip.participantRole === 'passenger' && trip.fare.paymentStatus === 'unpaid' && (
        <PayTripCard tripCode={trip.publicCode} total={trip.fare.total} preferred={trip.estimate.paymentIntent} onPaid={() => void loadTrip()} />
      )}
      {trip.status === 'completed' && <RateTripCard tripCode={trip.publicCode} counterpartyName={counterparty.name} existing={trip.myRating} />}

      <Card className="mb-4 space-y-3">
        <div><p className="text-xs font-semibold uppercase tracking-wide text-ink-500">{t('Pickup')}</p><p>{trip.pickup.address || t('Pickup location')}</p></div>
        {trip.stops.map((stop) => (
          <div key={stop.order}><p className="text-xs font-semibold uppercase tracking-wide text-ink-500">{t('Stop {0}', stop.order)}</p><p>{stop.address || t('Pinned on the map')}</p></div>
        ))}
        <div><p className="text-xs font-semibold uppercase tracking-wide text-ink-500">{t('Dropoff')}</p><p>{trip.dropoff.address || t('Dropoff location')}</p></div>
        <div className="grid grid-cols-2 gap-3 border-t border-border pt-3 text-sm">
          <div><p className="text-ink-500">{t('Assigned')}</p><p>{formatDateTime(trip.timeline.assignedAt)}</p></div>
          <div><p className="text-ink-500">{t('Distance')}</p><p>{formatDistance(trip.actual.distanceKm ?? trip.estimate.distanceKm)}</p></div>
        </div>
      </Card>

      <Card className="mb-4">
        <div className="mb-3 flex items-end justify-between border-b border-border pb-3">
          <div><p className="text-sm text-ink-500">{trip.status === 'completed' ? t('Final fare') : t('Estimated fare')}</p><p className="text-4xl font-bold tabular-nums">{formatBDT(displayFare)}</p></div>
          <p className="text-sm font-medium uppercase text-ink-500">{t(trip.fare.paymentStatus)}</p>
        </div>
        {trip.status === 'completed' ? (
          <div className="space-y-2 text-sm">
            {FARE_ROWS.map(({ key, label }) => (
              <div key={key} className="flex justify-between gap-4">
                <span className="text-ink-500">{label}</span>
                <span className="tabular-nums">{key === 'discount' && Number(trip.fare[key]) > 0 ? '−' : ''}{formatBDT(trip.fare[key] as string)}</span>
              </div>
            ))}
            <div className="flex justify-between gap-4 border-t border-border pt-2 font-bold"><span>{t('Total')}</span><span>{formatBDT(trip.fare.total)}</span></div>
          </div>
        ) : (
          <p className="text-sm text-ink-500">{t('The final fare is calculated by the server when the trip completes.')}</p>
        )}
        {trip.receipt && (
          <p className="mt-3 border-t border-border pt-3 text-xs text-ink-500">{t('Receipt')} {trip.receipt.receiptNo}</p>
        )}
      </Card>

      {trip.endedEarly && (
        <Card className="mb-4 border-marigold-500/40 bg-marigold-500/10">
          <h2 className="font-semibold">{t('Ended before the planned drop-off')}</h2>
          <p className="mt-1 text-sm">{t('The trip ended at {0}. The fare covers the distance driven. If you did not ask to get out, report it below.', formatDateTime(trip.endedEarly.at))}</p>
        </Card>
      )}
      {trip.cancellation && (
        <Card className="mb-4 border-danger-600/30 bg-danger-600/5">
          <h2 className="font-semibold text-danger-600">{t('Cancellation details')}</h2>
          <p className="mt-1 text-sm">{t('Reason:')} {trip.cancellation.reasonCode.replaceAll('_', ' ')}</p>
          <p className="text-sm">{t('Fee: {0}', formatBDT(trip.cancellation.fee))}</p>
        </Card>
      )}

      <Card>
        <h2 className="mb-3 font-semibold">{t('Status history')}</h2>
        <ol className="space-y-3">
          {trip.history.map((entry, index) => (
            <li
              key={`${entry.toStatus}-${entry.changedAt}-${index}`}
              className="flex gap-3 text-sm animate-stagger-in"
              style={staggerStyle(index)}
            >
              <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-cholo-700" aria-hidden="true" />
              <div><p className="font-medium capitalize">{t(entry.toStatus.replace('_', ' '))}</p><p className="text-ink-500">{formatDateTime(entry.changedAt)}</p></div>
            </li>
          ))}
        </ol>
      </Card>

      <div className="mt-4 text-center print:hidden">
        {trip.reportedByMe ? (
          <p className="text-sm text-ink-500">{t('You reported this trip. Our safety team is reviewing it.')}</p>
        ) : (
          <button type="button" className="text-sm font-medium text-danger-600 hover:underline" onClick={() => setReportOpen(true)}>
            {t('Report {0}', counterparty.name)}
          </button>
        )}
      </div>
      <ReportDialog
        open={reportOpen}
        tripCode={trip.publicCode}
        personName={counterparty.name}
        onClose={() => setReportOpen(false)}
        onReported={() => setTrip({ ...trip, reportedByMe: true })}
      />
    </main>
  );
}
