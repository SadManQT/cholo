import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import * as adminApi from '../../api/admin.api';
import type { SuspensionDuration } from '../../api/admin.api';
import { Button, Card, Dialog, EmptyState, Input, Skeleton, StatePill, toast } from '../../components/ui';
import type { AdminUserRow } from '../../types/admin.types';
import { getApiErrorMessage, getApiFieldErrors } from '../../utils/apiError';
import { dhakaDate, formatBDT, formatDate, formatDateTime } from '../../utils/format';
import { staggerStyle } from '../../utils/stagger';

const DURATIONS: { value: SuspensionDuration; label: string }[] = [
  { value: '1w', label: '1 week' },
  { value: '1m', label: '1 month' },
  { value: 'custom', label: 'Until a date' },
  { value: 'permanent', label: 'Permanent' },
];

function DecisionDialog({ user, onClose, onDone }: { user: AdminUserRow; onClose: () => void; onDone: () => void }) {
  const suspending = user.status !== 'suspended';
  const [reason, setReason] = useState('');
  const [duration, setDuration] = useState<SuspensionDuration>('1w');
  const [until, setUntil] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function submit() {
    const next: Record<string, string> = {};
    if (reason.trim().length < 3) next.reason = 'Write a reason of at least 3 characters. The user will see it.';
    if (suspending && duration === 'custom' && !until) next.until = 'Choose the last day of the suspension';
    setErrors(next);
    if (Object.keys(next).length) return;

    setBusy(true);
    try {
      await adminApi.decideUser(user.id, suspending ? 'suspend' : 'reinstate', reason.trim(), suspending
        ? { duration, ...(duration === 'custom' ? { until: new Date(`${until}T23:59:59`).toISOString() } : {}) }
        : undefined);
      toast.success(suspending ? `${user.fullName} is suspended.` : `${user.fullName} is active again.`);
      onDone();
    } catch (thrown) {
      const fields = getApiFieldErrors(thrown);
      if (Object.keys(fields).length) setErrors(fields);
      else toast.error(getApiErrorMessage(thrown, 'Could not update this account.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={suspending ? `Suspend ${user.fullName}?` : `Reinstate ${user.fullName}?`}
      description={suspending ? 'They are signed out everywhere immediately and see the reason when they try to log in.' : 'They can log in again right away.'}
      footer={<>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant={suspending ? 'danger' : 'primary'} loading={busy} onClick={() => void submit()}>{suspending ? 'Suspend account' : 'Reinstate account'}</Button>
      </>}
    >
      {suspending && (
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Duration</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {DURATIONS.map((option) => (
              <label key={option.value} className={`flex cursor-pointer items-center justify-center rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${duration === option.value ? 'border-cholo-700 bg-cholo-50 text-cholo-800' : 'border-border text-ink-500 hover:text-ink-900'}`}>
                <input type="radio" name="duration" value={option.value} checked={duration === option.value} onChange={() => setDuration(option.value)} className="sr-only" />
                {option.label}
              </label>
            ))}
          </div>
          {duration === 'custom' && (
            <label className="mt-3 flex flex-col gap-1.5 text-sm font-medium">Suspended through
              <input type="date" value={until} min={dhakaDate(1)} onChange={(event) => setUntil(event.target.value)} className={`h-11 rounded-xl border bg-surface px-3.5 ${errors.until ? 'border-danger-600' : 'border-border'}`} />
              {errors.until && <span className="font-normal text-danger-600">{errors.until}</span>}
            </label>
          )}
        </fieldset>
      )}
      <label className="flex flex-col gap-1.5 text-sm font-medium">Reason
        <textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} maxLength={255} placeholder={suspending ? 'e.g. Repeated no-shows after accepting rides' : 'e.g. Appeal reviewed and accepted'} className={`resize-none rounded-xl border bg-surface px-3.5 py-2.5 text-base font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cholo-700 ${errors.reason ? 'border-danger-600' : 'border-border'}`} />
        {errors.reason && <span className="font-normal text-danger-600">{errors.reason}</span>}
      </label>
    </Dialog>
  );
}

export function UsersPage() {
  const [rows, setRows] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const [status, setStatus] = useState('');
  const [deciding, setDeciding] = useState<AdminUserRow | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setRows((await adminApi.listUsers({ search, status: status || undefined, limit: 100 })).data);
    } catch (thrown) {
      setError(getApiErrorMessage(thrown, 'Could not load users.'));
    } finally {
      setLoading(false);
    }
  }, [search, status]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 250);
    return () => window.clearTimeout(timer);
  }, [load]);

  return (
    <main className="mx-auto max-w-5xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Users</h1>
        <p className="text-sm text-ink-500">Search riders, drivers and staff. Suspensions sign the account out immediately.</p>
      </div>
      <div className="grid gap-3 md:grid-cols-[1fr_220px]">
        <Input aria-label="Search users" placeholder="Name, phone, or email" value={search} onChange={(event) => setSearch(event.target.value)} />
        <select aria-label="Filter by status" value={status} onChange={(event) => setStatus(event.target.value)} className="h-11 rounded-xl border border-border bg-surface px-3">
          <option value="">Every status</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="deleted">Deleted</option>
        </select>
      </div>
      {loading ? (
        <div className="space-y-3"><Skeleton variant="card" /><Skeleton variant="card" /></div>
      ) : error && rows.length === 0 ? (
        <EmptyState title="Users did not load" hint={error} action={{ label: 'Retry', onClick: () => void load() }} />
      ) : rows.length === 0 ? (
        <EmptyState title="No users found" hint="Try a broader search." />
      ) : (
        <div className="space-y-3">
          {rows.map((row, index) => (
            <Card key={row.id} className="animate-stagger-in" style={staggerStyle(index)}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold">{row.fullName}</h2>
                    <StatePill state={row.status} />
                    {row.roles.map((role) => <span key={role} className="rounded-md bg-surface-alt px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-ink-500">{role}</span>)}
                  </div>
                  <p className="text-sm text-ink-500">{row.phone}{row.email ? ` · ${row.email}` : ''}</p>
                  <p className="text-xs text-ink-500">{row.tripCount} trips · Wallet {formatBDT(row.walletBalance)} · Joined {formatDate(row.createdAt)}</p>
                  {row.status === 'suspended' && (
                    <p className="mt-2 rounded-lg bg-danger-600/5 px-3 py-2 text-sm text-danger-600">
                      {row.suspendedUntil ? `Suspended until ${formatDateTime(row.suspendedUntil)}` : 'Suspended permanently'}
                      {row.suspensionReason ? ` · ${row.suspensionReason}` : ''}
                    </p>
                  )}
                </div>
                {row.status !== 'deleted' && (
                  <Button variant={row.status === 'suspended' ? 'primary' : 'danger'} onClick={() => setDeciding(row)}>
                    {row.status === 'suspended' ? 'Reinstate' : 'Suspend'}
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
      {deciding && <DecisionDialog user={deciding} onClose={() => setDeciding(null)} onDone={() => { setDeciding(null); void load(); }} />}
    </main>
  );
}
