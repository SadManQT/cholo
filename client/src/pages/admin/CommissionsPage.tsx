import { useCallback, useEffect, useState } from 'react';
import * as adminApi from '../../api/admin.api';
import type { CommissionMeasures, CommissionReport } from '../../api/admin.api';
import * as referenceApi from '../../api/reference.api';
import { Card, EmptyState, Skeleton } from '../../components/ui';
import type { City } from '../../types/ride.types';
import { getApiErrorMessage } from '../../utils/apiError';
import { dhakaDate, formatBDT, formatDate } from '../../utils/format';

const PRESETS = [
  { label: 'Today', from: 0, to: 0 },
  { label: 'Yesterday', from: -1, to: -1 },
  { label: 'Last 7 days', from: -6, to: 0 },
  { label: 'Last 30 days', from: -29, to: 0 },
  { label: 'This month', from: null, to: 0 },
] as const;

const monthStart = () => `${dhakaDate().slice(0, 8)}01`;
const pct = (part: number, whole: number) => (whole > 0 ? `${((part / whole) * 100).toFixed(1)}%` : '—');
const inputClass = 'h-11 rounded-xl border border-border bg-surface px-3 text-sm focus:border-cholo-700 focus:outline-none focus:ring-2 focus:ring-cholo-700/20';

function Stat({ label, value, hint, tone = '' }: { label: string; value: string; hint?: string; tone?: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium text-ink-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${tone}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-ink-500">{hint}</p>}
    </Card>
  );
}

function Row({ label, sub, m }: { label: string; sub?: string; m: CommissionMeasures }) {
  return (
    <tr className="border-t border-border">
      <td className="py-2.5 pr-3"><p className="font-medium">{label}</p>{sub && <p className="text-xs text-ink-500">{sub}</p>}</td>
      <td className="py-2.5 pr-3 text-right tabular-nums">{m.rides}</td>
      <td className="py-2.5 pr-3 text-right tabular-nums">{formatBDT(m.grossTotal)}</td>
      <td className="py-2.5 pr-3 text-right font-semibold tabular-nums text-cholo-700">{formatBDT(m.commissionTotal)}</td>
      <td className="hidden py-2.5 pr-3 text-right tabular-nums sm:table-cell">{formatBDT(m.avgFare)}</td>
      <td className="hidden py-2.5 text-right tabular-nums sm:table-cell">{formatBDT(m.avgCommission)}</td>
    </tr>
  );
}

function Table({ title, rows }: { title: string; rows: { key: string; label: string; sub?: string; m: CommissionMeasures }[] }) {
  return (
    <Card className="overflow-x-auto p-4">
      <h2 className="mb-2 font-semibold">{title}</h2>
      <table className="w-full text-sm sm:min-w-[420px]">
        <thead className="text-left text-xs uppercase tracking-wide text-ink-500">
          <tr>
            <th className="pb-2 pr-3 font-semibold">&nbsp;</th>
            <th className="pb-2 pr-3 text-right font-semibold">Rides</th>
            <th className="pb-2 pr-3 text-right font-semibold">Ride cost</th>
            <th className="pb-2 pr-3 text-right font-semibold">Commission</th>
            <th className="hidden pb-2 pr-3 text-right font-semibold sm:table-cell">Avg ride</th>
            <th className="hidden pb-2 text-right font-semibold sm:table-cell">Avg comm.</th>
          </tr>
        </thead>
        <tbody>{rows.map((row) => <Row key={row.key} label={row.label} sub={row.sub} m={row.m} />)}</tbody>
      </table>
    </Card>
  );
}

export function CommissionsPage() {
  const [from, setFrom] = useState(dhakaDate());
  const [to, setTo] = useState(dhakaDate());
  const [cityId, setCityId] = useState('');
  const [cities, setCities] = useState<City[]>([]);
  const [report, setReport] = useState<CommissionReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    referenceApi.listCities().then(setCities).catch(() => setCities([]));
  }, []);

  const load = useCallback(async () => {
    if (!from || !to || from > to) {
      setError('Choose a start date on or before the end date.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setReport(await adminApi.getCommissionReport({ from, to, ...(cityId ? { cityId: Number(cityId) } : {}) }));
    } catch (thrown) {
      setReport(null);
      setError(getApiErrorMessage(thrown, 'Could not load the commission report.'));
    } finally {
      setLoading(false);
    }
  }, [from, to, cityId]);

  useEffect(() => {
    void load();
  }, [load]);

  function applyPreset(preset: typeof PRESETS[number]) {
    setFrom(preset.from === null ? monthStart() : dhakaDate(preset.from));
    setTo(dhakaDate(preset.to));
  }

  const activePreset = PRESETS.find((preset) => (preset.from === null ? monthStart() : dhakaDate(preset.from)) === from && dhakaDate(preset.to) === to);
  const totals = report?.totals;
  const cash = report?.byMethod.find((row) => row.method === 'cash');
  const app = report?.byMethod.find((row) => row.method === 'app');
  const rangeLabel = from === to ? formatDate(from) : `${formatDate(from)} – ${formatDate(to)}`;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-4">
        <h1 className="text-2xl font-bold">Commissions</h1>
        <p className="text-sm text-ink-500">What Cholo earned from completed rides, for any day or date range.</p>
      </div>

      <Card className="mb-5 p-4">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Quick ranges">
          {PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => applyPreset(preset)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${activePreset?.label === preset.label ? 'bg-cholo-700 text-white' : 'bg-surface-alt text-ink-500 hover:text-ink-900'}`}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <label className="flex flex-col gap-1 text-sm font-medium">From
            <input type="date" value={from} max={dhakaDate()} onChange={(event) => setFrom(event.target.value)} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">To
            <input type="date" value={to} max={dhakaDate()} onChange={(event) => setTo(event.target.value)} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">City
            <select value={cityId} onChange={(event) => setCityId(event.target.value)} className={inputClass}>
              <option value="">All cities</option>
              {cities.map((city) => <option key={city.id} value={city.id}>{city.name}</option>)}
            </select>
          </label>
        </div>
      </Card>

      {loading && !report ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} variant="card" className="h-24" />)}</div>
      ) : error ? (
        <EmptyState title="Report did not load" hint={error} action={{ label: 'Retry', onClick: () => void load() }} />
      ) : totals && totals.rides === 0 ? (
        <EmptyState title="No completed rides" hint={`Nothing was settled on ${rangeLabel}.`} />
      ) : totals && report ? (
        <div className={`space-y-5 transition-opacity ${loading ? 'opacity-60' : ''}`}>
          <p className="text-sm font-medium text-ink-500">{rangeLabel}{cityId ? ` · ${cities.find((city) => String(city.id) === cityId)?.name ?? ''}` : ''}</p>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Total commission" value={formatBDT(totals.commissionTotal)} hint={`${pct(totals.commissionTotal, totals.grossTotal)} of ride cost`} tone="text-cholo-700" />
            <Stat label="Rides" value={String(totals.rides)} hint={`${totals.drivers} driver${totals.drivers === 1 ? '' : 's'}`} />
            <Stat label="Total ride cost" value={formatBDT(totals.grossTotal)} hint="What riders' trips were worth" />
            <Stat label="Paid to drivers" value={formatBDT(totals.driverTotal)} hint={pct(totals.driverTotal, totals.grossTotal)} />
            <Stat label="Avg commission / ride" value={formatBDT(totals.avgCommission)} />
            <Stat label="Avg ride cost" value={formatBDT(totals.avgFare)} />
            <Stat label="Avg distance" value={totals.rides ? `${(totals.distanceKm / totals.rides).toFixed(1)} km` : '—'} hint={`${totals.distanceKm.toFixed(0)} km in total`} />
            <Stat label="Promo discounts" value={formatBDT(totals.promoTotal)} hint="Paid by Cholo" />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Card className="p-4">
              <p className="text-xs font-medium text-ink-500">Cash rides</p>
              <p className="mt-1 text-lg font-bold tabular-nums">{cash?.rides ?? 0} {(cash?.rides ?? 0) === 1 ? 'ride' : 'rides'} · {formatBDT(cash?.commissionTotal ?? 0)}</p>
              <p className="text-xs text-ink-500">Commission is taken from the driver's wallet; the driver kept the cash.</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs font-medium text-ink-500">In-app rides (wallet, bKash, Nagad, card)</p>
              <p className="mt-1 text-lg font-bold tabular-nums">{app?.rides ?? 0} {(app?.rides ?? 0) === 1 ? 'ride' : 'rides'} · {formatBDT(app?.commissionTotal ?? 0)}</p>
              <p className="text-xs text-ink-500">Cholo collected the fare and credited the driver's share.</p>
            </Card>
          </div>

          <Table title="By day" rows={report.daily.map((row) => ({ key: row.day, label: formatDate(row.day), m: row }))} />
          <Table title="By vehicle type" rows={report.byCategory.map((row) => ({ key: row.category, label: row.category, sub: `${pct(row.commissionTotal, totals.commissionTotal)} of commission`, m: row }))} />
          <p className="text-xs text-ink-500">Counted when a ride is settled: at drop-off for cash and wallet rides, at payment for bKash, Nagad and card.</p>
        </div>
      ) : null}
    </div>
  );
}
