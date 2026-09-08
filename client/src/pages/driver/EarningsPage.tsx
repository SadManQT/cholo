import { useCallback, useEffect, useRef, useState } from 'react';
import * as driverApi from '../../api/driver.api';
import { Card, EmptyState, Skeleton } from '../../components/ui';
import type { DailyEarning, EarningTripRow } from '../../types/earnings.types';
import { getApiErrorMessage } from '../../utils/apiError';
import { formatBDT, formatDate, formatDateTime } from '../../utils/format';
import { staggerStyle } from '../../utils/stagger';

// doc 12 §7: "date-range chips" — three fixed presets rather than a full
// date picker; the backend query is just ?from&to (server/src/validators/
// driver.schema.js's earningsQuerySchema), so a chip just picks how far
// back `from` goes.
const RANGE_OPTIONS = [
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
];

function isoDaysAgo(days: number) {
  return new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function EarningsPage() {
  const [rangeDays, setRangeDays] = useState(30);
  const [daily, setDaily] = useState<DailyEarning[]>([]);
  const [trips, setTrips] = useState<EarningTripRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const load = useCallback(async (days: number) => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const result = await driverApi.getEarnings({ from: isoDaysAgo(days), to: new Date().toISOString().slice(0, 10) });
      // Clicking a range chip while the previous range's request is still
      // in flight must not let that older response overwrite the numbers
      // for the chip the user actually has selected now.
      if (requestId !== requestIdRef.current) return;
      setDaily(result.daily);
      setTrips(result.trips);
    } catch (thrown) {
      if (requestId !== requestIdRef.current) return;
      setError(getApiErrorMessage(thrown, 'Could not load your earnings.'));
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(rangeDays);
  }, [load, rangeDays]);

  const totals = daily.reduce(
    (sum, row) => ({
      gross: sum.gross + Number(row.grossTotal),
      commission: sum.commission + Number(row.commissionTotal),
      net: sum.net + Number(row.netTotal),
      trips: sum.trips + row.tripsCount,
    }),
    { gross: 0, commission: 0, net: 0, trips: 0 },
  );

  return (
    <main className="mx-auto min-h-[calc(100dvh-4rem)] max-w-3xl px-4 py-5 md:px-6">
      <div className="mb-5">
        <h1 className="text-2xl font-bold">Earnings</h1>
        <p className="text-sm text-ink-500">What you've made, by day and by trip.</p>
      </div>

      <div className="mb-5 flex gap-2" role="group" aria-label="Date range">
        {RANGE_OPTIONS.map((option) => (
          <button
            key={option.days}
            type="button"
            onClick={() => setRangeDays(option.days)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-[color,background-color,transform] duration-150 ease-cholo-out active:scale-[0.97] ${
              rangeDays === option.days ? 'bg-cholo-700 text-white' : 'bg-surface-alt text-ink-500 hover:text-ink-900'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <Skeleton variant="card" className="h-20" />
            <Skeleton variant="card" className="h-20" />
            <Skeleton variant="card" className="h-20" />
          </div>
          <Skeleton variant="card" /><Skeleton variant="card" />
        </div>
      ) : error && trips.length === 0 && daily.length === 0 ? (
        <EmptyState title="Earnings did not load" hint={error} action={{ label: 'Retry', onClick: () => load(rangeDays) }} />
      ) : (
        <>
          <div className="mb-5 grid grid-cols-3 gap-3">
            <Card className="p-4">
              <p className="text-xs text-ink-500">Gross</p>
              <p className="mt-1 text-xl font-bold tabular-nums">{formatBDT(totals.gross)}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-ink-500">Commission</p>
              <p className="mt-1 text-xl font-bold tabular-nums text-danger-600">−{formatBDT(totals.commission)}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-ink-500">Net</p>
              <p className="mt-1 text-xl font-bold tabular-nums text-cholo-700">{formatBDT(totals.net)}</p>
            </Card>
          </div>

          <h2 className="mb-3 font-semibold">By day</h2>
          {daily.length === 0 ? (
            <EmptyState title="No earnings in this range" hint="Completed, paid trips will show up here." />
          ) : (
            <div className="mb-6 space-y-2">
              {daily.map((row, index) => (
                <Card key={row.earningDate} className="flex items-center justify-between p-3 animate-stagger-in" style={staggerStyle(index)}>
                  <div>
                    <p className="text-sm font-medium">{formatDate(row.earningDate)}</p>
                    <p className="text-xs text-ink-500">{row.tripsCount} trip{row.tripsCount === 1 ? '' : 's'}</p>
                  </div>
                  <p className="font-semibold tabular-nums">{formatBDT(row.netTotal)}</p>
                </Card>
              ))}
            </div>
          )}

          <h2 className="mb-3 font-semibold">Per trip</h2>
          {trips.length === 0 ? (
            <EmptyState title="No trips in this range" />
          ) : (
            <div className="space-y-2">
              {trips.map((row, index) => (
                <Card key={row.id} className="p-3 animate-stagger-in" style={staggerStyle(index)}>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{row.tripCode}</p>
                    <p className="font-semibold tabular-nums">{formatBDT(row.netEarning)}</p>
                  </div>
                  <p className="mt-1 text-xs text-ink-500">
                    {formatDateTime(row.earnedAt)} · gross {formatBDT(row.grossFare)} · commission {row.commissionPct}%
                  </p>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </main>
  );
}
