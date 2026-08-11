import { Link } from 'react-router-dom';
import { Card, StatusBadge } from '../ui';
import type { TripSummary } from '../../types/ride.types';
import { formatBDT, formatDateTime } from '../../utils/format';

export function TripRow({ trip, to }: { trip: TripSummary; to: string }) {
  const fare = trip.status === 'completed' ? trip.totalFare : trip.estFare;
  return (
    <Link to={to} className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cholo-700">
      <Card className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold text-ink-900">{trip.categoryName} · {trip.counterpartyName}</p>
            <p className="mt-1 truncate text-sm text-ink-500">{trip.pickupAddress ?? 'Pickup'} → {trip.dropoffAddress ?? 'Dropoff'}</p>
          </div>
          <StatusBadge status={trip.status} className="shrink-0" />
        </div>
        <div className="mt-3 flex items-end justify-between gap-3 border-t border-border pt-3">
          <p className="text-xs text-ink-500">{formatDateTime(trip.assignedAt)}</p>
          <p className="font-bold tabular-nums text-ink-900">{formatBDT(fare)}</p>
        </div>
      </Card>
    </Link>
  );
}
