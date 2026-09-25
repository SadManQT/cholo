import { useCallback, useEffect, useState } from 'react';
import * as ridesApi from '../../api/rides.api';
import type { RideRequest } from '../../types/ride.types';
import { getApiErrorMessage } from '../../utils/apiError';
import { formatBDT, formatDateTime } from '../../utils/format';
import { Button, Card, toast } from '../ui';

/** Scheduled rides that haven't started searching yet, with a cancel button. Renders nothing when empty. */
export function UpcomingRides() {
  const [upcoming, setUpcoming] = useState<RideRequest[]>([]);
  const [cancelling, setCancelling] = useState<string | null>(null);

  const load = useCallback(() => {
    ridesApi.listActiveRequests()
      .then((requests) => setUpcoming(requests.filter((request) => request.scheduledFor && request.status === 'pending')))
      .catch(() => {});
  }, []);
  useEffect(load, [load]);

  async function cancel(request: RideRequest) {
    setCancelling(request.publicId);
    try {
      await ridesApi.cancelRequest(request.publicId);
      setUpcoming((current) => current.filter((item) => item.publicId !== request.publicId));
      toast.info('Scheduled ride cancelled.');
    } catch (thrown) {
      toast.error(getApiErrorMessage(thrown, 'Could not cancel this ride.'));
      load();
    } finally {
      setCancelling(null);
    }
  }

  if (upcoming.length === 0) return null;

  return (
    <section className="mb-6" aria-labelledby="upcoming-heading">
      <h2 id="upcoming-heading" className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-500">Upcoming</h2>
      <div className="space-y-3">
        {upcoming.map((request) => (
          <Card key={request.publicId} className="flex flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{formatDateTime(request.scheduledFor!)}</p>
              <p className="truncate text-sm text-ink-500">{request.pickup?.address} → {request.dropoff?.address}</p>
              <p className="text-sm text-ink-500">
                {request.categoryName} · {formatBDT(request.quote.estFare)} estimated
                {request.stops?.length ? ` · ${request.stops.length} stop${request.stops.length > 1 ? 's' : ''}` : ''}
              </p>
            </div>
            <Button variant="secondary" loading={cancelling === request.publicId} onClick={() => void cancel(request)}>Cancel</Button>
          </Card>
        ))}
      </div>
    </section>
  );
}
