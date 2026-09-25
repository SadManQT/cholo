import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as driverApi from '../../api/driver.api';
import type { StatementMonth } from '../../api/driver.api';
import { Card, EmptyState, Skeleton } from '../../components/ui';
import { getApiErrorMessage } from '../../utils/apiError';
import { formatBDT, formatMonth } from '../../utils/format';

export function StatementsPage() {
  const [months, setMonths] = useState<StatementMonth[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setMonths(await driverApi.listStatements());
    } catch (thrown) {
      setError(getApiErrorMessage(thrown, 'Could not load statements.'));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  return (
    <main className="mx-auto max-w-3xl space-y-5 p-4 md:p-6">
      <div>
        <Link to="/driver/earnings" className="text-sm font-semibold text-cholo-700">← Earnings</Link>
        <h1 className="mt-2 text-2xl font-bold">Monthly statements</h1>
        <p className="text-sm text-ink-500">What you earned, and the commission Cholo kept, month by month. Open one to print or save it as a PDF.</p>
      </div>
      {loading ? (
        <div className="space-y-3"><Skeleton variant="card" /><Skeleton variant="card" /></div>
      ) : error ? (
        <EmptyState title="Statements did not load" hint={error} action={{ label: 'Retry', onClick: load }} />
      ) : months.length === 0 ? (
        <EmptyState title="No statements yet" hint="Your first statement appears after your first completed trip." />
      ) : (
        <div className="space-y-3">
          {months.map((month) => (
            <Link key={month.month} to={`/driver/statements/${month.month}`} className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cholo-700">
              <Card className="flex items-center justify-between gap-3 hover:border-cholo-700/50">
                <div>
                  <p className="font-semibold">{formatMonth(month.month)}</p>
                  <p className="text-sm text-ink-500">{month.tripsCount} trip{month.tripsCount === 1 ? '' : 's'} · {formatBDT(month.commissionTotal)} commission</p>
                </div>
                <p className="text-lg font-bold tabular-nums">{formatBDT(month.netTotal)}</p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
