import { useCallback, useEffect, useState } from 'react';
import * as adminApi from '../../api/admin.api';
import { DisputeTimeline } from '../../components/support/DisputeTimeline';
import { Button, Card, EmptyState, Input, Skeleton, StatePill, toast } from '../../components/ui';
import type { AdminDispute } from '../../types/admin.types';
import { getApiErrorMessage } from '../../utils/apiError';
import { formatBDT } from '../../utils/format';
import { staggerStyle } from '../../utils/stagger';

type Resolution = 'resolved_refunded' | 'resolved_no_action' | 'rejected';

export function DisputesPage() {
  const [rows, setRows] = useState<AdminDispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [refund, setRefund] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setRows((await adminApi.listDisputes()).data);
    } catch (thrown) {
      setError(getApiErrorMessage(thrown, 'Could not load disputes.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function startReview(row: AdminDispute) {
    setBusy(`review-${row.id}`);
    try {
      await adminApi.startDisputeReview(row.id);
      toast.success(`${row.disputeNo} is under review. ${row.raisedByName} was notified.`);
      await load();
    } catch (thrown) {
      toast.error(getApiErrorMessage(thrown, 'Could not start the review.'));
    } finally {
      setBusy(null);
    }
  }

  async function resolve(row: AdminDispute, status: Resolution) {
    if (note.trim().length < 3) return toast.error('Add a resolution note of at least 3 characters. The rider will see it.');
    if (status === 'resolved_refunded' && !(Number(refund) > 0)) return toast.error('Enter a positive refund amount.');
    setBusy(`resolve-${row.id}`);
    try {
      await adminApi.resolveDispute(row.id, {
        status,
        resolutionNote: note.trim(),
        ...(status === 'resolved_refunded' ? { refundAmount: Number(refund) } : {}),
      });
      toast.success('Dispute resolved and the rider was notified.');
      setSelected(null);
      setNote('');
      setRefund('');
      await load();
    } catch (thrown) {
      toast.error(getApiErrorMessage(thrown, 'Could not resolve dispute.'));
    } finally {
      setBusy(null);
    }
  }

  const isOpen = (row: AdminDispute) => ['open', 'under_review'].includes(row.status);

  return (
    <main className="mx-auto max-w-5xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Disputes</h1>
        <p className="text-sm text-ink-500">Each dispute moves Opened → Under review → Resolved. The rider sees every step.</p>
      </div>
      {loading ? (
        <div className="space-y-3"><Skeleton variant="card" /><Skeleton variant="card" /></div>
      ) : error && rows.length === 0 ? (
        <EmptyState title="Disputes did not load" hint={error} action={{ label: 'Retry', onClick: () => void load() }} />
      ) : rows.length === 0 ? (
        <EmptyState title="No disputes" hint="Customer disputes will appear here." />
      ) : (
        <div className="space-y-3">
          {rows.map((row, index) => (
            <Card key={row.id} className="animate-stagger-in" style={staggerStyle(index)}>
              <div className="flex flex-wrap justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold">{row.disputeNo} · {row.tripCode}</h2>
                    <StatePill state={row.status} />
                  </div>
                  <p className="text-sm text-ink-500">{row.raisedByName} · {row.raisedByPhone} · {row.disputeType.replaceAll('_', ' ')}</p>
                  <p className="mt-2 text-sm">{row.description}</p>
                  <p className="mt-1 text-xs text-ink-500">Claim {row.disputedAmount ? formatBDT(row.disputedAmount) : 'not specified'} · Trip {formatBDT(row.tripTotal)} · Payment {row.paymentStatus}</p>
                  <DisputeTimeline className="mt-3" dispute={row} />
                </div>
                <div className="flex flex-col gap-2">
                  {row.status === 'open' && <Button loading={busy === `review-${row.id}`} onClick={() => void startReview(row)}>Start review</Button>}
                  {isOpen(row) && (
                    <Button variant="secondary" onClick={() => { setSelected(selected === row.id ? null : row.id); setNote(''); setRefund(row.disputedAmount ?? row.tripTotal); }}>
                      {selected === row.id ? 'Close' : 'Resolve'}
                    </Button>
                  )}
                </div>
              </div>
              {selected === row.id && (
                <div className="mt-4 grid gap-3 border-t border-border pt-4 md:grid-cols-2">
                  <Input label="Resolution note (shown to the rider)" value={note} onChange={(event) => setNote(event.target.value)} />
                  <Input label="Refund amount (only if refunding)" inputMode="decimal" value={refund} onChange={(event) => setRefund(event.target.value)} />
                  <div className="flex flex-wrap gap-2 md:col-span-2">
                    <Button variant="secondary" disabled={busy !== null} onClick={() => void resolve(row, 'rejected')}>Reject claim</Button>
                    <Button variant="secondary" disabled={busy !== null} onClick={() => void resolve(row, 'resolved_no_action')}>Resolve, no refund</Button>
                    <Button loading={busy === `resolve-${row.id}`} disabled={busy !== null && busy !== `resolve-${row.id}`} onClick={() => void resolve(row, 'resolved_refunded')}>Refund to wallet</Button>
                  </div>
                </div>
              )}
              {row.resolutionNote && <p className="mt-3 rounded-xl bg-surface-alt p-3 text-sm"><strong>Resolution:</strong> {row.resolutionNote}</p>}
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
