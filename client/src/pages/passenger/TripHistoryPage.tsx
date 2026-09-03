import { useCallback, useEffect, useRef, useState } from 'react';
import * as tripsApi from '../../api/trips.api';
import { TripRow } from '../../components/ride/TripRow';
import { Button, EmptyState, Skeleton } from '../../components/ui';
import type { TripStatus, TripSummary } from '../../types/ride.types';
import { getApiErrorMessage } from '../../utils/apiError';
import { staggerStyle } from '../../utils/stagger';

type HistoryFilter = 'all' | 'active' | 'completed' | 'cancelled';

const FILTERS: Array<{ value: HistoryFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

export function TripHistoryPage({ driverMode = false }: { driverMode?: boolean }) {
  const [filter, setFilter] = useState<HistoryFilter>('all');
  const [trips, setTrips] = useState<TripSummary[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const requestIdRef = useRef(0);

  const loadPage = useCallback(async (nextPage: number, replace = false) => {
    const requestId = ++requestIdRef.current;
    if (replace) setLoading(true);
    else setLoadingMore(true);
    setError(null);
    try {
      const status = filter === 'all' ? undefined : filter as TripStatus | 'active';
      const result = await tripsApi.listTrips({
        page: nextPage,
        limit: 12,
        status,
        role: driverMode ? 'driver' : 'passenger',
      });
      // Switching the filter chip fires a new loadPage(1, true) while an
      // older filter's request may still be in flight; if that older one
      // resolves second it must not overwrite the newer filter's results.
      if (requestId !== requestIdRef.current) return;
      setTrips((current) => replace ? result.data : [
        ...current,
        ...result.data.filter((next) => !current.some((item) => item.publicCode === next.publicCode)),
      ]);
      setPage(nextPage);
      setTotal(result.meta?.total ?? result.data.length);
    } catch (thrown) {
      if (requestId !== requestIdRef.current) return;
      setError(getApiErrorMessage(thrown, 'Could not load your trips.'));
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [driverMode, filter]);

  useEffect(() => {
    setTrips([]);
    setPage(1);
    void loadPage(1, true);
  }, [loadPage]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || loading || loadingMore || trips.length >= total) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) void loadPage(page + 1);
    }, { rootMargin: '160px' });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadPage, loading, loadingMore, page, total, trips.length]);

  const detailPath = driverMode ? '/driver/trips' : '/trips';

  return (
    <main className="mx-auto min-h-[calc(100dvh-4rem)] max-w-3xl px-4 py-5 md:px-6">
      <div className="mb-5">
        <h1 className="text-2xl font-bold">Your trips</h1>
        <p className="text-sm text-ink-500">Active rides and past receipts in one place.</p>
      </div>

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Filter trips">
        {FILTERS.map((item) => (
          <Button
            key={item.value}
            variant={filter === item.value ? 'primary' : 'secondary'}
            onClick={() => setFilter(item.value)}
            className="shrink-0"
          >
            {item.label}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3"><Skeleton variant="card" /><Skeleton variant="card" /><Skeleton variant="card" /></div>
      ) : error && trips.length === 0 ? (
        <EmptyState title="Trips did not load" hint={error} action={{ label: 'Retry', onClick: () => loadPage(1, true) }} />
      ) : trips.length === 0 ? (
        <EmptyState
          title={filter === 'all' ? 'No trips yet' : `No ${filter} trips`}
          hint={driverMode ? 'Completed jobs will appear here.' : 'Book your first ride from the Book tab.'}
        />
      ) : (
        <div className="space-y-3">
          {trips.map((trip, index) => (
            <div key={trip.publicCode} className="animate-stagger-in" style={staggerStyle(index)}>
              <TripRow trip={trip} to={`${detailPath}/${trip.publicCode}`} />
            </div>
          ))}
          {error && (
            <EmptyState title="More trips did not load" hint={error} action={{ label: 'Retry', onClick: () => loadPage(page + 1) }} className="py-6" />
          )}
          {loadingMore && <><Skeleton variant="card" /><Skeleton variant="card" /></>}
          <div ref={sentinelRef} className="h-1" aria-hidden="true" />
        </div>
      )}
    </main>
  );
}
