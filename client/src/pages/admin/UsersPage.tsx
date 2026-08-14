import { useCallback, useEffect, useState } from 'react';
import * as adminApi from '../../api/admin.api';
import { Button, Card, EmptyState, Input, Skeleton, StatePill, toast } from '../../components/ui';
import type { AdminUserRow } from '../../types/admin.types';
import { getApiErrorMessage } from '../../utils/apiError';
import { formatBDT, formatDateTime } from '../../utils/format';

export function UsersPage() {
  const [rows, setRows] = useState<AdminUserRow[]>([]); const [search, setSearch] = useState(''); const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null); const [busy, setBusy] = useState<string | null>(null);
  const load = useCallback(async () => { setError(null); try { setRows((await adminApi.listUsers({ search, status: status || undefined, limit: 100 })).data); } catch (thrown) { setError(getApiErrorMessage(thrown, 'Could not load users.')); } finally { setLoading(false); } }, [search, status]);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 250); return () => window.clearTimeout(timer); }, [load]);
  async function decide(row: AdminUserRow) {
    const action = row.status === 'suspended' ? 'reinstate' : 'suspend'; const reason = window.prompt(`Reason to ${action} ${row.fullName}?`)?.trim(); if (!reason) return;
    setBusy(row.id); try { await adminApi.decideUser(row.id, action, reason); toast.success(`User ${action}d.`); await load(); } catch (thrown) { toast.error(getApiErrorMessage(thrown, `Could not ${action} user.`)); } finally { setBusy(null); }
  }
  return <main className="mx-auto max-w-6xl space-y-5"><div><h1 className="text-2xl font-bold">Users</h1><p className="text-sm text-ink-500">Search accounts and enforce access with an audited reason.</p></div>
    <div className="grid gap-3 md:grid-cols-[1fr_220px]"><Input aria-label="Search users" placeholder="Name, phone, or email" value={search} onChange={(e) => setSearch(e.target.value)} /><select value={status} onChange={(e) => setStatus(e.target.value)} className="h-11 rounded-xl border border-border bg-surface px-3"><option value="">Every status</option><option value="active">Active</option><option value="suspended">Suspended</option><option value="deleted">Deleted</option></select></div>
    {loading ? <div className="space-y-3"><Skeleton variant="card" /><Skeleton variant="card" /></div> : error && rows.length === 0 ? <EmptyState title="Users did not load" hint={error} action={{ label: 'Retry', onClick: load }} /> : rows.length === 0 ? <EmptyState title="No users found" hint="Try a broader search." /> : <div className="space-y-3">{rows.map((row) => <Card key={row.id}><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold">{row.fullName}</h2><StatePill state={row.status} /></div><p className="text-sm text-ink-500">{row.phone}{row.email ? ` · ${row.email}` : ''}</p><p className="text-xs text-ink-500">{row.roles.join(', ')} · {row.tripCount} trips · Wallet {formatBDT(row.walletBalance)} · Joined {formatDateTime(row.createdAt)}</p></div>{row.status !== 'deleted' && <Button variant={row.status === 'suspended' ? 'primary' : 'danger'} loading={busy === row.id} onClick={() => void decide(row)}>{row.status === 'suspended' ? 'Reinstate' : 'Suspend'}</Button>}</div></Card>)}</div>}
  </main>;
}
