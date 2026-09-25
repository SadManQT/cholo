import { useCallback, useEffect, useState } from 'react';
import * as adminApi from '../../api/admin.api';
import * as referenceApi from '../../api/reference.api';
import type { ExportKind } from '../../api/admin.api';
import { DownloadIcon } from '../../components/layout/icons';
import { Button, Card, EmptyState, Skeleton, toast } from '../../components/ui';
import type { DashboardStats } from '../../types/admin.types';
import type { City } from '../../types/ride.types';
import { getApiErrorMessage } from '../../utils/apiError';
import { dhakaDate, formatBDT, formatDate } from '../../utils/format';

const EXPORTS: Array<{ kind: ExportKind; label: string }> = [
  { kind: 'trips', label: 'Trips' },
  { kind: 'payments', label: 'Payments' },
  { kind: 'withdrawals', label: 'Withdrawals' },
];

/** CSV downloads for finance and university reporting. The API allows super and finance admins only. */
function ExportsCard() {
  const [from, setFrom] = useState(dhakaDate(-29));
  const [to, setTo] = useState(dhakaDate());
  const [busy, setBusy] = useState<ExportKind | null>(null);

  async function download(kind: ExportKind) {
    setBusy(kind);
    try {
      await adminApi.downloadExport(kind, from, to);
    } catch (thrown) {
      toast.error(getApiErrorMessage(thrown, 'Could not export. Finance or super admin access is required.'));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card>
      <h2 className="font-semibold">Export to spreadsheet</h2>
      <p className="text-sm text-ink-500">CSV files open in Excel and Google Sheets. Dates are Dhaka days, up to one year at a time.</p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="text-sm font-medium">From
          <input type="date" value={from} max={to} onChange={(event) => setFrom(event.target.value)} className="mt-1 block h-11 rounded-xl border border-border bg-surface px-3" />
        </label>
        <label className="text-sm font-medium">To
          <input type="date" value={to} min={from} max={dhakaDate()} onChange={(event) => setTo(event.target.value)} className="mt-1 block h-11 rounded-xl border border-border bg-surface px-3" />
        </label>
        {EXPORTS.map((item) => (
          <Button key={item.kind} variant="secondary" loading={busy === item.kind} onClick={() => void download(item.kind)}>
            <DownloadIcon className="h-4 w-4" /> {item.label}
          </Button>
        ))}
      </div>
    </Card>
  );
}

export function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [cities, setCities] = useState<City[]>([]);
  const [cityId, setCityId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [nextStats, nextCities] = await Promise.all([
        adminApi.getStats(cityId ? Number(cityId) : undefined),
        cities.length ? Promise.resolve(cities) : referenceApi.listCities(),
      ]);
      setStats(nextStats);
      setCities(nextCities);
    } catch (thrown) {
      setError(getApiErrorMessage(thrown, 'Could not load dashboard metrics.'));
    } finally {
      setLoading(false);
    }
  }, [cities, cityId]);

  useEffect(() => {
    setLoading(true);
    void load();
    const timer = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(timer);
  }, [load]);

  if (loading && !stats) return <div className="grid gap-3 md:grid-cols-3"><Skeleton variant="card" /><Skeleton variant="card" /><Skeleton variant="card" /></div>;
  if (error && !stats) return <EmptyState title="Dashboard did not load" hint={error} action={{ label: 'Retry', onClick: load }} />;
  if (!stats) return <EmptyState title="No dashboard data" hint="Metrics will appear after the first trip." />;

  const maxGross = Math.max(...stats.trend.map((row) => Number(row.grossRevenue)), 1);
  const kpis = [
    ['Trips today', stats.tripsToday], ['Active drivers', stats.activeDrivers],
    ['Gross this month', formatBDT(stats.grossRevenueMonth)], ['Platform revenue', formatBDT(stats.platformRevenueMonth)],
    ['Pending drivers', stats.pendingDrivers], ['Open disputes', stats.openDisputes],
    ['Live SOS', stats.openSos], ['Payout requests', stats.requestedWithdrawals],
  ];

  return (
    <main className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-2xl font-bold">Operations dashboard</h1><p className="text-sm text-ink-500">Auto-refreshes every 60 seconds.</p></div>
        <label className="text-sm font-medium">City
          <select value={cityId} onChange={(event) => setCityId(event.target.value)} className="ml-2 h-11 rounded-xl border border-border bg-surface px-3">
            <option value="">All cities</option>{cities.map((city) => <option key={city.id} value={city.id}>{city.name}</option>)}
          </select>
        </label>
      </div>
      {error && <p className="rounded-xl bg-danger-600/10 p-3 text-sm text-danger-600">Latest refresh failed: {error}</p>}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map(([label, value]) => <Card key={label}><p className="text-sm text-ink-500">{label}</p><p className="mt-1 text-2xl font-bold tabular-nums">{value}</p></Card>)}
      </section>
      <Card>
        <h2 className="font-semibold">Six-month gross revenue</h2>
        <div className="mt-5 flex h-56 items-end gap-3" aria-label="Revenue trend">
          {stats.trend.map((row) => (
            <div key={row.month} className="flex min-w-0 flex-1 flex-col items-center gap-2">
              <span className="text-xs font-semibold tabular-nums">{formatBDT(row.grossRevenue)}</span>
              {}
              <div className="h-40 w-full">
                <div
                  className="h-full w-full origin-bottom rounded-t-lg bg-cholo-700 transition-transform duration-300 ease-cholo-out"
                  style={{ transform: `scaleY(${Math.max(0.025, Number(row.grossRevenue) / maxGross)})` }}
                  title={`${row.completedTrips} completed trips`}
                />
              </div>
              <span className="text-xs text-ink-500">{formatDate(row.month).split(',')[0]}</span>
            </div>
          ))}
        </div>
      </Card>
      <ExportsCard />
    </main>
  );
}
