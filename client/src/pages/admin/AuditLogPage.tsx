import { useCallback, useEffect, useState } from 'react';
import * as adminApi from '../../api/admin.api';
import { Button, Card, EmptyState, Input, Skeleton } from '../../components/ui';
import type { AuditLog } from '../../types/admin.types';
import { getApiErrorMessage } from '../../utils/apiError';
import { formatDateTime } from '../../utils/format';

function JsonBlock({ label, value }: { label: string; value: unknown }) {
  if (value == null) return null;
  return <div><p className="mb-1 text-xs font-semibold uppercase text-ink-500">{label}</p><pre className="max-h-56 overflow-auto rounded-lg bg-surface-alt p-3 text-xs">{JSON.stringify(value, null, 2)}</pre></div>;
}

export function AuditLogPage() {
  const [rows, setRows] = useState<AuditLog[]>([]); const [entityType, setEntityType] = useState(''); const [action, setAction] = useState(''); const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => { setError(null); try { setRows((await adminApi.listAuditLogs({ entityType: entityType || undefined, action: action || undefined, limit: 100 })).data); } catch (thrown) { setError(getApiErrorMessage(thrown, 'Could not load audit records.')); } finally { setLoading(false); } }, [action, entityType]);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 250); return () => window.clearTimeout(timer); }, [load]);
  return <main className="mx-auto max-w-6xl space-y-5"><div><h1 className="text-2xl font-bold">Audit log</h1><p className="text-sm text-ink-500">Append-only governance trail. This screen has no edit or delete action.</p></div><div className="grid gap-3 md:grid-cols-2"><Input placeholder="Entity type, e.g. users" value={entityType} onChange={(e) => setEntityType(e.target.value)} /><Input placeholder="Action contains…" value={action} onChange={(e) => setAction(e.target.value)} /></div>{loading ? <div className="space-y-3"><Skeleton variant="card" /><Skeleton variant="card" /></div> : error && rows.length === 0 ? <EmptyState title="Audit log did not load" hint={error} action={{ label: 'Retry', onClick: load }} /> : rows.length === 0 ? <EmptyState title="No matching audit records" hint="Clear the filters to see the full trail." /> : <div className="space-y-2">{rows.map((row) => <Card key={row.id}><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold">{row.action}</h2><p className="text-sm text-ink-500">{row.entityType} #{row.entityId ?? '—'} · {row.actorName ?? 'System'} ({row.actorRole ?? 'SYSTEM'})</p><p className="text-xs text-ink-500">{formatDateTime(row.createdAt)} · IP {row.ipAddress ?? '—'}</p></div><Button variant="secondary" onClick={() => setExpanded(expanded === row.id ? null : row.id)}>{expanded === row.id ? 'Hide diff' : 'View diff'}</Button></div>{expanded === row.id && <div className="mt-4 grid gap-3 border-t border-border pt-4 md:grid-cols-2"><JsonBlock label="Before" value={row.oldValue} /><JsonBlock label="After" value={row.newValue} /></div>}</Card>)}</div>}</main>;
}
