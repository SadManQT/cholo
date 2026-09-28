import { useCallback, useEffect, useState } from 'react';
import * as adminApi from '../../api/admin.api';
import { Card, EmptyState, Skeleton } from '../../components/ui';
import type { AnalyticsReport } from '../../types/admin.types';
import { getApiErrorMessage } from '../../utils/apiError';
import { dhakaDate } from '../../utils/format';

// "hour_of_day" → "Hour of day"
const heading = (column: string) => column.charAt(0).toUpperCase() + column.slice(1).replace(/_/g, ' ');

function cell(column: string, value: string | number | null) {
  if (value === null) return '—';
  if (column === 'hour_of_day') return `${String(value).padStart(2, '0')}:00`;
  return String(value);
}

function ReportCard({ report }: { report: AnalyticsReport }) {
  const columns = report.rows[0] ? Object.keys(report.rows[0]) : [];
  return (
    <Card>
      <p className="text-xs font-semibold uppercase tracking-wide text-cholo-700">Query #{report.number}</p>
      <h2 className="mt-1 text-lg font-bold">{report.title}</h2>
      <p className="text-sm text-ink-500">{report.question}</p>
      <div className="mt-2 flex flex-wrap gap-1">
        {report.concepts.map((concept) => (
          <span key={concept} className="rounded-full bg-surface-alt px-2 py-0.5 font-mono text-xs">{concept}</span>
        ))}
      </div>

      {report.rows.length === 0 ? (
        <p className="mt-3 rounded-xl bg-surface-alt p-3 text-sm text-ink-500">No rows. There is no matching data yet.</p>
      ) : (
        <div className="mt-3 overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-alt text-xs uppercase tracking-wide text-ink-500">
              <tr>{columns.map((column) => <th key={column} className="whitespace-nowrap p-2">{heading(column)}</th>)}</tr>
            </thead>
            <tbody>
              {report.rows.map((row, index) => (
                <tr key={index} className="border-t border-border">
                  {columns.map((column) => <td key={column} className="whitespace-nowrap p-2 tabular-nums">{cell(column, row[column])}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <details className="mt-3">
        <summary className="cursor-pointer text-sm font-semibold text-cholo-700">Show SQL</summary>
        <pre className="mt-2 overflow-x-auto rounded-xl bg-ink-900 p-3 font-mono text-xs leading-relaxed text-white">{report.sql}</pre>
      </details>
    </Card>
  );
}

/** Ten reports written in plain SQL. Each card shows the question, the answer, and the SQL behind it. */
export function AnalyticsPage() {
  const [month, setMonth] = useState(dhakaDate().slice(0, 7));
  const [minTrips, setMinTrips] = useState(2);
  const [reports, setReports] = useState<AnalyticsReport[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setReports(await adminApi.getAnalytics({ month, minTrips }));
    } catch (thrown) {
      setError(getApiErrorMessage(thrown, 'Could not load the reports.'));
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
          <p className="text-sm text-ink-500">Ten reports, each answered by one SQL query. Open "Show SQL" to see how.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <label className="text-sm font-medium" htmlFor="analytics-month">Month (query #11)
            <input id="analytics-month" type="month" value={month} max={dhakaDate().slice(0, 7)} onChange={(event) => event.target.value && setMonth(event.target.value)} className="mt-1 block h-11 rounded-xl border border-border bg-surface px-3" />
          </label>
          <label className="text-sm font-medium" htmlFor="analytics-min-trips">Minimum trips (query #3)
            <input id="analytics-min-trips" type="number" min={1} max={1000} value={minTrips} onChange={(event) => setMinTrips(Math.max(1, Number(event.target.value) || 1))} className="mt-1 block h-11 w-28 rounded-xl border border-border bg-surface px-3" />
          </label>
        </div>
      </div>

      {error && !reports && <EmptyState title="Reports did not load" hint={error} action={{ label: 'Retry', onClick: load }} />}
      {error && reports && <p className="rounded-xl bg-danger-600/10 p-3 text-sm text-danger-600">{error}</p>}
      {!reports && !error && <div className="grid gap-4 lg:grid-cols-2"><Skeleton variant="card" /><Skeleton variant="card" /><Skeleton variant="card" /><Skeleton variant="card" /></div>}
      {reports && (
        <div className="grid gap-4 lg:grid-cols-2">
          {reports.map((report) => <ReportCard key={report.id} report={report} />)}
        </div>
      )}
    </main>
  );
}
