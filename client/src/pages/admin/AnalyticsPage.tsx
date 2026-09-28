import { useCallback, useEffect, useState, type ReactNode } from 'react';
import * as adminApi from '../../api/admin.api';
import { Card, EmptyState, Skeleton } from '../../components/ui';
import type { AnalyticsReport } from '../../types/admin.types';
import { getApiErrorMessage } from '../../utils/apiError';
import { dhakaDate, formatBDT, formatDate, formatMonth } from '../../utils/format';

type Row = AnalyticsReport['rows'][number];

// Validated pair (CVD-safe on the white surface): blue = drivers' share, green = Cholo's commission.
const DRIVER_COLOR = '#2a78d6';
const PLATFORM_COLOR = '#1baf7a';

const num = (value: Row[string] | undefined) => Number(value ?? 0);
const hourLabel = (value: Row[string]) => {
  const hour = num(value);
  return `${hour % 12 || 12} ${hour < 12 ? 'AM' : 'PM'}`;
};
const trips = (count: number) => `${count} ${count === 1 ? 'trip' : 'trips'}`;
const compactTaka = (value: number) => `৳${new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(value)}`;
const shortMonth = (month: string) =>
  new Date(`${month}-01T00:00:00+06:00`).toLocaleDateString('en-GB', { month: 'short', year: '2-digit', timeZone: 'Asia/Dhaka' });

function Panel({ title, subtitle, children, className = '' }: { title: string; subtitle?: string; children: ReactNode; className?: string }) {
  return (
    <Card className={`min-w-0 ${className}`}>
      <h2 className="font-semibold">{title}</h2>
      {subtitle && <p className="text-sm text-ink-500">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </Card>
  );
}

function NoData() {
  return <p className="rounded-xl bg-surface-alt p-4 text-center text-sm text-ink-500">No data yet.</p>;
}

function Kpi({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <Card>
      <p className="text-sm text-ink-500">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-ink-500">{hint}</p>
    </Card>
  );
}

/** Ranked horizontal bars: label on the left, value on the right, bar underneath. */
function BarList({ items }: { items: Array<{ key: string; label: string; value: number; display: string; detail?: string }> }) {
  if (items.length === 0) return <NoData />;
  const max = Math.max(...items.map((item) => item.value), 1);
  return (
    <ol className="space-y-3">
      {items.map((item) => (
        <li key={item.key} className="group">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate font-medium">{item.label}</span>
            <span className="shrink-0 font-semibold tabular-nums">{item.display}</span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-surface-alt">
            <div
              className="h-2 origin-left rounded-full bg-cholo-700 transition-transform duration-500 ease-cholo-out group-hover:bg-cholo-800"
              style={{ transform: `scaleX(${Math.max(0.02, item.value / max)})` }}
            />
          </div>
          {item.detail && <p className="mt-0.5 text-xs text-ink-500">{item.detail}</p>}
        </li>
      ))}
    </ol>
  );
}

/** Vertical columns over time. Each column may be split into stacked segments (bottom first). */
function ColumnChart({ columns, label }: {
  label: string;
  columns: Array<{ key: string; label: string; value: string; segments: Array<{ value: number; color: string }>; tooltip: string[] }>;
}) {
  const [active, setActive] = useState<string | null>(null);
  if (columns.length === 0) return <NoData />;
  const max = Math.max(...columns.map((column) => column.segments.reduce((sum, segment) => sum + segment.value, 0)), 1);
  return (
    <div className="flex h-56 items-end gap-2 border-b border-border" role="img" aria-label={label}>
      {columns.map((column) => {
        const total = column.segments.reduce((sum, segment) => sum + segment.value, 0);
        return (
          <div
            key={column.key}
            className="relative flex h-full min-w-0 flex-1 flex-col items-center justify-end"
            onMouseEnter={() => setActive(column.key)}
            onMouseLeave={() => setActive(null)}
            onFocus={() => setActive(column.key)}
            onBlur={() => setActive(null)}
            tabIndex={0}
          >
            {active === column.key && (
              <div className="pointer-events-none absolute bottom-full z-10 mb-2 whitespace-nowrap rounded-lg bg-ink-900 px-3 py-2 text-xs text-white shadow-lg">
                <p className="font-semibold">{column.label}</p>
                {column.tooltip.map((line) => <p key={line} className="tabular-nums">{line}</p>)}
              </div>
            )}
            <span className="mb-1 text-xs font-semibold tabular-nums">{column.value}</span>
            <div
              className="flex w-full max-w-12 flex-col-reverse gap-[2px] transition-opacity"
              style={{ height: `${Math.max(2, (total / max) * 88)}%`, opacity: active && active !== column.key ? 0.55 : 1 }}
            >
              {column.segments.map((segment, index) => (
                <div
                  key={index}
                  className={index === column.segments.length - 1 ? 'rounded-t' : ''}
                  style={{ flexGrow: segment.value, flexBasis: 0, background: segment.color, minHeight: segment.value > 0 ? 2 : 0 }}
                />
              ))}
            </div>
            <span className="absolute -bottom-6 truncate text-xs text-ink-500">{column.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function Legend({ items }: { items: Array<{ label: string; color: string }> }) {
  return (
    <div className="mt-8 flex flex-wrap gap-4 text-xs text-ink-500">
      {items.map((item) => (
        <span key={item.label} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: item.color }} />{item.label}
        </span>
      ))}
    </div>
  );
}

function PeopleList({ rows, empty, detail }: { rows: Row[]; empty: string; detail: (row: Row) => string }) {
  if (rows.length === 0) return <p className="rounded-xl bg-surface-alt p-3 text-sm text-ink-500">{empty}</p>;
  return (
    <ul className="divide-y divide-border">
      {rows.map((row, index) => (
        <li key={index} className="flex items-center justify-between gap-3 py-2 text-sm">
          <span className="min-w-0">
            <span className="block truncate font-medium">{row.driver_name}</span>
            <span className="text-xs text-ink-500 tabular-nums">{row.phone}</span>
          </span>
          <span className="shrink-0 text-xs text-ink-500">{detail(row)}</span>
        </li>
      ))}
    </ul>
  );
}

function Dashboard({ reports, month }: { reports: Record<string, Row[]>; month: string }) {
  const trend = [...(reports['monthly-trend'] ?? [])].reverse();
  const commission = [...(reports['monthly-commission'] ?? [])].reverse();
  const current = (reports['monthly-trend'] ?? []).find((row) => row.month === month);
  const currentCommission = (reports['monthly-commission'] ?? []).find((row) => row.month === month);
  const monthName = formatMonth(month);

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Revenue" value={formatBDT(num(current?.gross_revenue))} hint={monthName} />
        <Kpi label="Completed trips" value={num(current?.completed_trips).toLocaleString('en')} hint={`${num(current?.different_riders)} different riders`} />
        <Kpi label="Average fare" value={formatBDT(num(current?.average_fare))} hint={monthName} />
        <Kpi label="Platform commission" value={formatBDT(num(currentCommission?.platform_commission))} hint={monthName} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Monthly revenue" subtitle="Completed trips, last 12 months">
          <ColumnChart
            label="Monthly revenue"
            columns={trend.map((row) => ({
              key: String(row.month),
              label: shortMonth(String(row.month)),
              value: compactTaka(num(row.gross_revenue)),
              segments: [{ value: num(row.gross_revenue), color: '#0E7A5F' }],
              tooltip: [formatBDT(num(row.gross_revenue)), trips(num(row.completed_trips)), `Avg fare ${formatBDT(num(row.average_fare))}`],
            }))}
          />
          <div className="h-8" />
        </Panel>
        <Panel title="Where the money goes" subtitle="What riders paid, split between drivers and Cholo">
          <ColumnChart
            label="Revenue split between drivers and platform"
            columns={commission.map((row) => ({
              key: String(row.month),
              label: shortMonth(String(row.month)),
              value: compactTaka(num(row.riders_paid)),
              segments: [
                { value: num(row.drivers_kept), color: DRIVER_COLOR },
                { value: num(row.platform_commission), color: PLATFORM_COLOR },
              ],
              tooltip: [`Riders paid ${formatBDT(num(row.riders_paid))}`, `Drivers kept ${formatBDT(num(row.drivers_kept))}`, `Cholo earned ${formatBDT(num(row.platform_commission))}`],
            }))}
          />
          <Legend items={[{ label: 'Drivers kept', color: DRIVER_COLOR }, { label: 'Cholo commission', color: PLATFORM_COLOR }]} />
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Busiest hours" subtitle="Ride requests by hour of day">
          <BarList items={(reports['peak-hour'] ?? []).map((row) => ({
            key: String(row.hour_of_day), label: hourLabel(row.hour_of_day), value: num(row.total_requests), display: `${num(row.total_requests)} requests`,
          }))} />
        </Panel>
        <Panel title="Highest-earning hours" subtitle="Revenue from completed trips">
          <BarList items={(reports['revenue-hour'] ?? []).map((row) => ({
            key: String(row.hour_of_day), label: hourLabel(row.hour_of_day), value: num(row.total_revenue), display: formatBDT(num(row.total_revenue)), detail: trips(num(row.completed_trips)),
          }))} />
        </Panel>
        <Panel title="Best days" subtitle={`Trip payments in ${monthName}`}>
          <BarList items={(reports['revenue-day'] ?? []).map((row) => ({
            key: String(row.payment_day), label: formatDate(String(row.payment_day)), value: num(row.total_amount), display: formatBDT(num(row.total_amount)), detail: `${num(row.payments)} payments`,
          }))} />
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Top-rated drivers" subtitle="Average rider rating out of 5">
          <BarList items={(reports['top-rated-drivers'] ?? []).map((row, index) => ({
            key: `${index}`, label: String(row.driver_name), value: num(row.average_rating),
            display: row.average_rating === null ? 'No ratings' : `★ ${num(row.average_rating).toFixed(2)}`, detail: trips(num(row.completed_trips)),
          }))} />
        </Panel>
        <Panel title="Top riders" subtitle="Total spent on completed trips">
          <BarList items={(reports['rider-lifetime-value'] ?? []).slice(0, 5).map((row, index) => ({
            key: `${index}`, label: String(row.rider_name), value: num(row.total_spent), display: formatBDT(num(row.total_spent)),
            detail: `${trips(num(row.total_trips))} · avg ${formatBDT(num(row.average_fare))} · since ${formatDate(String(row.first_trip))}`,
          }))} />
        </Panel>
        <Panel title="Regular pairs" subtitle="Driver and rider with the most trips together">
          <BarList items={(reports['frequent-pairs'] ?? []).map((row, index) => ({
            key: `${index}`, label: `${row.driver_name} → ${row.rider_name}`, value: num(row.trips_together), display: trips(num(row.trips_together)),
          }))} />
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Online but idle today" subtitle="Drivers online now with no trip today">
          <PeopleList rows={reports['idle-online-drivers'] ?? []} empty="Every online driver has had a trip today." detail={(row) => (row.last_seen ? `Last seen ${row.last_seen}` : 'No location yet')} />
        </Panel>
        <Panel title="Inactive drivers" subtitle="Approved, but no completed trip in 30 days">
          <PeopleList rows={reports['inactive-drivers'] ?? []} empty="All approved drivers have been active." detail={(row) => (row.last_trip ? `Last trip ${formatDate(String(row.last_trip))}` : 'Never completed a trip')} />
        </Panel>
      </div>
    </>
  );
}

export function AnalyticsPage() {
  const [month, setMonth] = useState(dhakaDate().slice(0, 7));
  const [minTrips, setMinTrips] = useState(2);
  const [reports, setReports] = useState<Record<string, Row[]> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const list = await adminApi.getAnalytics({ month, minTrips });
      setReports(Object.fromEntries(list.map((report) => [report.id, report.rows])));
    } catch (thrown) {
      setError(getApiErrorMessage(thrown, 'Could not load analytics.'));
    }
  }, [month, minTrips]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Analytics</h1>
          <p className="text-sm text-ink-500">Revenue, demand and driver performance.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <label className="text-sm font-medium" htmlFor="analytics-month">Month
            <input id="analytics-month" type="month" value={month} min={dhakaDate(-10 * 365).slice(0, 7)} max={dhakaDate().slice(0, 7)} onChange={(event) => event.target.value && setMonth(event.target.value)} className="mt-1 block h-11 rounded-xl border border-border bg-surface px-3" />
          </label>
          <label className="text-sm font-medium" htmlFor="analytics-min-trips">Min. trips to rank a driver
            <input id="analytics-min-trips" type="number" min={1} max={1000} value={minTrips} onChange={(event) => setMinTrips(Math.max(1, Number(event.target.value) || 1))} className="mt-1 block h-11 w-28 rounded-xl border border-border bg-surface px-3" />
          </label>
        </div>
      </div>

      {error && !reports && <EmptyState title="Analytics did not load" hint={error} action={{ label: 'Retry', onClick: load }} />}
      {error && reports && <p className="rounded-xl bg-danger-600/10 p-3 text-sm text-danger-600">{error}</p>}
      {!reports && !error && (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Skeleton variant="card" /><Skeleton variant="card" /><Skeleton variant="card" /><Skeleton variant="card" /></div>
          <div className="grid gap-4 lg:grid-cols-2"><Skeleton variant="card" /><Skeleton variant="card" /></div>
        </div>
      )}
      {reports && <Dashboard reports={reports} month={month} />}
    </main>
  );
}
