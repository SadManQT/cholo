import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as adminApi from '../../api/admin.api';
import type { ReportStatus, UserReport } from '../../api/admin.api';
import { Button, Card, EmptyState, Skeleton, StatePill, toast } from '../../components/ui';
import { getApiErrorMessage } from '../../utils/apiError';
import { formatDateTime } from '../../utils/format';

const FILTERS: Array<{ value: ReportStatus | 'all'; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'investigating', label: 'Investigating' },
  { value: 'action_taken', label: 'Action taken' },
  { value: 'dismissed', label: 'Dismissed' },
];

const CATEGORY_LABELS: Record<UserReport['category'], string> = {
  safety: 'Felt unsafe', harassment: 'Harassment', behavior: 'Rude or unprofessional', fraud: 'Fraud or overcharging', other: 'Other',
};

export function ReportsPage() {
  const [filter, setFilter] = useState<ReportStatus | 'all'>('open');
  const [reports, setReports] = useState<UserReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setReports((await adminApi.listReports(filter === 'all' ? undefined : filter)).data);
    } catch (thrown) {
      setError(getApiErrorMessage(thrown, 'Could not load reports.'));
    } finally {
      setLoading(false);
    }
  }, [filter]);
  useEffect(() => { setLoading(true); void load(); }, [load]);

  async function decide(report: UserReport, status: Exclude<ReportStatus, 'open'>) {
    setBusy(`${report.id}-${status}`);
    try {
      await adminApi.updateReport(report.id, status);
      toast.success(status === 'investigating' ? 'Marked as investigating.' : 'Report closed. The reporter was told.');
      await load();
    } catch (thrown) {
      toast.error(getApiErrorMessage(thrown, 'Could not update this report.'));
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="mx-auto max-w-5xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold">User reports</h1>
        <p className="text-sm text-ink-500">Riders and drivers report behaviour from the trip receipt. Safety and harassment reports also alert every admin. To suspend someone, open Users.</p>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Filter reports">
        {FILTERS.map((item) => (
          <Button key={item.value} variant={filter === item.value ? 'primary' : 'secondary'} className="shrink-0" onClick={() => setFilter(item.value)}>{item.label}</Button>
        ))}
      </div>
      {loading ? (
        <div className="space-y-3"><Skeleton variant="card" /><Skeleton variant="card" /></div>
      ) : error && reports.length === 0 ? (
        <EmptyState title="Reports did not load" hint={error} action={{ label: 'Retry', onClick: load }} />
      ) : reports.length === 0 ? (
        <EmptyState title="No reports here" hint="Nothing needs attention in this list." />
      ) : (
        <div className="space-y-3">
          {reports.map((report) => {
            const closed = report.status === 'action_taken' || report.status === 'dismissed';
            return (
              <Card key={report.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold">{CATEGORY_LABELS[report.category]} · {report.reported.name}</p>
                    <p className="text-sm text-ink-500">
                      Reported by {report.reporter.name} · {formatDateTime(report.createdAt)}{report.tripCode ? ` · ${report.tripCode}` : ''}
                    </p>
                  </div>
                  <StatePill state={report.status} urgent={!closed && (report.category === 'safety' || report.category === 'harassment')} />
                </div>
                {report.description && <p className="mt-3 whitespace-pre-line rounded-xl bg-surface-alt p-3 text-sm">{report.description}</p>}
                <p className="mt-3 text-sm">
                  {report.reported.name} ({report.reported.phone}) has <strong>{report.reported.openReports}</strong> open report{report.reported.openReports === 1 ? '' : 's'}
                  {report.reported.status !== 'active' && <> · account {report.reported.status}</>}
                  {' · '}<Link to={`/admin/users?search=${encodeURIComponent(report.reported.phone)}`} className="font-medium text-cholo-700 hover:underline">Open in Users</Link>
                </p>
                {!closed && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {report.status === 'open' && <Button variant="secondary" loading={busy === `${report.id}-investigating`} onClick={() => void decide(report, 'investigating')}>Investigate</Button>}
                    <Button loading={busy === `${report.id}-action_taken`} onClick={() => void decide(report, 'action_taken')}>Action taken</Button>
                    <Button variant="ghost" loading={busy === `${report.id}-dismissed`} onClick={() => void decide(report, 'dismissed')}>Dismiss</Button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </main>
  );
}
