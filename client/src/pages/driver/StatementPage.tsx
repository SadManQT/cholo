import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import * as driverApi from '../../api/driver.api';
import type { Statement } from '../../api/driver.api';
import { Button, EmptyState, Skeleton } from '../../components/ui';
import { getApiErrorMessage } from '../../utils/apiError';
import { formatBDT, formatDateTime, formatMonth } from '../../utils/format';

/** A printable earnings statement; "Print" doubles as "Save as PDF" in every browser. */
export function StatementPage() {
  const { month = '' } = useParams();
  const [statement, setStatement] = useState<Statement | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setStatement(await driverApi.getStatement(month));
    } catch (thrown) {
      setError(getApiErrorMessage(thrown, 'Could not load this statement.'));
    }
  }, [month]);
  useEffect(() => { void load(); }, [load]);

  if (error) return <EmptyState title="Statement did not load" hint={error} action={{ label: 'Retry', onClick: load }} />;
  if (!statement) return <main className="mx-auto max-w-3xl space-y-3 p-4"><Skeleton variant="card" /><Skeleton lines={6} /></main>;

  return (
    <main className="mx-auto max-w-3xl bg-surface p-4 md:p-6 print:max-w-none print:p-0">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link to="/driver/statements" className="font-semibold text-cholo-700">← Statements</Link>
        <Button variant="secondary" onClick={() => window.print()}>Print or save PDF</Button>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-ink-900 pb-4">
        <div>
          <p className="text-2xl font-extrabold text-cholo-700">Cholo</p>
          <h1 className="mt-1 text-xl font-bold">Earnings statement · {formatMonth(statement.month)}</h1>
        </div>
        <dl className="text-right text-sm">
          <dt className="text-ink-500">Statement</dt><dd className="font-mono font-semibold">{statement.statementNo}</dd>
          <dt className="mt-1 text-ink-500">Generated</dt><dd>{formatDateTime(statement.generatedAt)}</dd>
        </dl>
      </header>

      <section className="mt-4 grid gap-1 text-sm">
        <p><span className="text-ink-500">Driver:</span> <strong>{statement.driver.name}</strong></p>
        <p><span className="text-ink-500">Phone:</span> {statement.driver.phone}</p>
        <p><span className="text-ink-500">License:</span> {statement.driver.licenseNumber}</p>
      </section>

      <section className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ['Trips', String(statement.totals.tripsCount)],
          ['Fares collected', formatBDT(statement.totals.grossTotal)],
          ['Cholo commission', formatBDT(statement.totals.commissionTotal)],
          ['Your earnings', formatBDT(statement.totals.netTotal)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-border p-3">
            <p className="text-xs text-ink-500">{label}</p>
            <p className="mt-1 text-lg font-bold tabular-nums">{value}</p>
          </div>
        ))}
      </section>

      <div className="mt-5 overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-border text-ink-500">
            <tr><th className="py-2 pr-3">Trip</th><th className="py-2 pr-3">Date</th><th className="py-2 pr-3">Paid by</th><th className="py-2 pr-3 text-right">Fare</th><th className="py-2 pr-3 text-right">Commission</th><th className="py-2 text-right">You earned</th></tr>
          </thead>
          <tbody className="divide-y divide-border">
            {statement.trips.map((trip) => (
              <tr key={trip.tripCode}>
                <td className="py-2 pr-3 font-mono">{trip.tripCode}</td>
                <td className="py-2 pr-3">{formatDateTime(trip.earnedAt)}</td>
                <td className="py-2 pr-3 capitalize">{trip.paymentMethod}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{formatBDT(trip.grossFare)}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{formatBDT(trip.commissionAmount)} <span className="text-ink-500">({trip.commissionPct}%)</span></td>
                <td className="py-2 text-right font-semibold tabular-nums">{formatBDT(trip.netEarning)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-6 text-xs text-ink-500">Cash trips: you collected the fare and owe the commission, which is deducted from your Cholo wallet. Wallet, bKash, Nagad and card trips: Cholo collected the fare and credited your earnings to your wallet.</p>
    </main>
  );
}
