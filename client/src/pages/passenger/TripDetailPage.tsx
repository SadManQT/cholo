import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import * as tripsApi from '../../api/trips.api';
import { MapView } from '../../components/map/MapView';
import { TripStatusStepper } from '../../components/ride/TripStatusStepper';
import { Button, Card, EmptyState, Skeleton, StatusBadge, toast } from '../../components/ui';
import type { TripDetail } from '../../types/ride.types';
import { getApiErrorMessage } from '../../utils/apiError';
import { formatBDT, formatDateTime, formatDistance } from '../../utils/format';

const FARE_ROWS: Array<{ key: keyof TripDetail['fare']; label: string }> = [
  { key: 'base', label: 'Base fare' },
  { key: 'distance', label: 'Distance' },
  { key: 'time', label: 'Time' },
  { key: 'waiting', label: 'Waiting' },
  { key: 'surge', label: 'Surge' },
  { key: 'bookingFee', label: 'Booking fee' },
  { key: 'discount', label: 'Discount' },
];

export function TripDetailPage({ driverMode = false }: { driverMode?: boolean }) {
  const { code } = useParams();
  const [trip, setTrip] = useState<TripDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  async function shareReceipt() {
    if (!trip) return;
    const receiptSuffix = trip.receipt ? ` (Receipt ${trip.receipt.receiptNo})` : '';
    const text = `Cholo trip ${trip.publicCode}: ${trip.pickup.address} → ${trip.dropoff.address}, ${formatBDT(trip.fare.total)}${receiptSuffix}.`;
    const share = (navigator as unknown as { share?: (data: ShareData) => Promise<void> }).share;
    try {
      if (share) await share.call(navigator, { title: `Cholo receipt ${trip.publicCode}`, text });
      else await navigator.clipboard.writeText(text);
      toast.success(share ? 'Receipt shared.' : 'Receipt copied.');
    } catch {
      // Cancelling the native share sheet is not a product error.
    }
  }

  if (loading) return <main className="mx-auto max-w-3xl space-y-4 p-4"><Skeleton variant="map-placeholder" /><Skeleton variant="card" /><Skeleton lines={5} /></main>;
  if (error || !trip) return <EmptyState title="Trip did not load" hint={error ?? 'Trip not found.'} action={{ label: 'Retry', onClick: loadTrip }} />;

  const counterparty = trip.participantRole === 'passenger' ? trip.driver : trip.passenger;
  const backPath = driverMode ? '/driver/trips' : '/trips';
  const displayFare = trip.status === 'completed' ? trip.fare.total : trip.estimate.fare;

  return (
    <main className="mx-auto min-h-screen max-w-3xl bg-surface px-4 py-5 md:px-6 print:max-w-none">
      <div className="mb-4 flex items-center justify-between gap-3 print:hidden">
        <Link to={backPath} className="font-semibold text-cholo-700">← Trips</Link>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={shareReceipt}>Share</Button>
          <Button variant="secondary" onClick={() => window.print()}>Print</Button>
        </div>
      </div>

      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-ink-500">{trip.publicCode}</p>
          <h1 className="text-2xl font-bold">Trip receipt</h1>
        </div>
        <StatusBadge status={trip.status} />
      </div>

      <MapView pickup={trip.pickup} dropoff={trip.dropoff} className="mb-5 h-56 rounded-2xl" />

      <Card className="mb-4">
        <TripStatusStepper status={trip.status} />
        <div className="mt-4 border-t border-border pt-4">
          <p className="text-sm font-semibold">{counterparty.name} · ★ {counterparty.rating}</p>
          <p className="text-sm text-ink-500">
            {trip.categoryName}
            {trip.participantRole === 'passenger' && ` · ${trip.vehicle.registrationNo}`}
          </p>
        </div>
      </Card>

      <Card className="mb-4 space-y-3">
        <div><p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Pickup</p><p>{trip.pickup.address || 'Pickup location'}</p></div>
        <div><p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Dropoff</p><p>{trip.dropoff.address || 'Dropoff location'}</p></div>
        <div className="grid grid-cols-2 gap-3 border-t border-border pt-3 text-sm">
          <div><p className="text-ink-500">Assigned</p><p>{formatDateTime(trip.timeline.assignedAt)}</p></div>
          <div><p className="text-ink-500">Distance</p><p>{formatDistance(trip.actual.distanceKm ?? trip.estimate.distanceKm)}</p></div>
        </div>
      </Card>

      <Card className="mb-4">
        <div className="mb-3 flex items-end justify-between border-b border-border pb-3">
          <div><p className="text-sm text-ink-500">{trip.status === 'completed' ? 'Final fare' : 'Estimated fare'}</p><p className="text-4xl font-bold tabular-nums">{formatBDT(displayFare)}</p></div>
          <p className="text-sm font-medium uppercase text-ink-500">{trip.fare.paymentStatus}</p>
        </div>
        {trip.status === 'completed' ? (
          <div className="space-y-2 text-sm">
            {FARE_ROWS.map(({ key, label }) => (
              <div key={key} className="flex justify-between gap-4">
                <span className="text-ink-500">{label}</span>
                <span className="tabular-nums">{key === 'discount' && Number(trip.fare[key]) > 0 ? '−' : ''}{formatBDT(trip.fare[key] as string)}</span>
              </div>
            ))}
            <div className="flex justify-between gap-4 border-t border-border pt-2 font-bold"><span>Total</span><span>{formatBDT(trip.fare.total)}</span></div>
          </div>
        ) : (
          <p className="text-sm text-ink-500">The final fare is calculated by the server when the trip completes.</p>
        )}
        {trip.receipt && (
          <p className="mt-3 border-t border-border pt-3 text-xs text-ink-500">Receipt {trip.receipt.receiptNo}</p>
        )}
      </Card>

      {trip.cancellation && (
        <Card className="mb-4 border-danger-600/30 bg-danger-600/5">
          <h2 className="font-semibold text-danger-600">Cancellation details</h2>
          <p className="mt-1 text-sm">Reason: {trip.cancellation.reasonCode.replaceAll('_', ' ')}</p>
          <p className="text-sm">Fee: {formatBDT(trip.cancellation.fee)}</p>
        </Card>
      )}

      <Card>
        <h2 className="mb-3 font-semibold">Status history</h2>
        <ol className="space-y-3">
          {trip.history.map((entry, index) => (
            <li key={`${entry.toStatus}-${entry.changedAt}-${index}`} className="flex gap-3 text-sm">
              <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-cholo-700" aria-hidden="true" />
              <div><p className="font-medium capitalize">{entry.toStatus.replace('_', ' ')}</p><p className="text-ink-500">{formatDateTime(entry.changedAt)}</p></div>
            </li>
          ))}
        </ol>
      </Card>
    </main>
  );
}
