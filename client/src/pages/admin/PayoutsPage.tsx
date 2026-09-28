import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useState } from 'react';
import * as adminApi from '../../api/admin.api';
import { Button, Card, EmptyState, Input, Skeleton, toast } from '../../components/ui';
import type { WithdrawalQueueRow } from '../../types/earnings.types';
import { getApiErrorMessage } from '../../utils/apiError';
import { formatBDT, formatDateTime } from '../../utils/format';
import { EASE_OUT } from '../../utils/motion';
import { staggerDelaySeconds } from '../../utils/stagger';

const ACCOUNT_TYPE_LABELS = { bkash: 'bKash', nagad: 'Nagad', bank: 'Bank' } as const;

// A withdrawal moves requested → approved (finance checks it) → paid (finance sent the money). Rejecting a
// request, or marking an approved payout failed, returns the amount to the driver's wallet.
type Stage = 'requested' | 'approved';
const STAGES: { value: Stage; label: string; hint: string; empty: string }[] = [
  { value: 'requested', label: 'To review', hint: 'New requests. Approve to send, or reject with a reason.', empty: 'Every requested withdrawal has been reviewed.' },
  { value: 'approved', label: 'To pay out', hint: 'Approved: send the money, then mark it paid (or failed if it bounced).', empty: 'No approved withdrawals are waiting to be paid.' },
];

type Pending = { id: string; kind: 'reject' | 'paid' | 'failed' } | null;

export function PayoutsPage() {
  const [stage, setStage] = useState<Stage>('requested');
  const [rows, setRows] = useState<WithdrawalQueueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending>(null);
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await adminApi.listWithdrawalQueue({ status: stage, limit: 50 });
      setRows(result.data);
    } catch (thrown) {
      setError(getApiErrorMessage(thrown, 'Could not load the payout queue.'));
    } finally {
      setLoading(false);
    }
  }, [stage]);

  useEffect(() => {
    void load();
  }, [load]);

  function openForm(id: string, kind: 'reject' | 'paid' | 'failed') {
    setPending({ id, kind });
    setNote('');
  }

  async function act(id: string, action: () => Promise<unknown>, message: string, fallback: string) {
    setActioningId(id);
    try {
      await action();
      setRows((current) => current.filter((row) => row.id !== id));
      setPending(null);
      setNote('');
      toast.success(message);
    } catch (thrown) {
      toast.error(getApiErrorMessage(thrown, fallback));
    } finally {
      setActioningId(null);
    }
  }

  const current = STAGES.find((item) => item.value === stage)!;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-4">
        <h1 className="text-2xl font-bold">Withdrawals</h1>
        <p className="text-sm text-ink-500">{current.hint}</p>
      </div>

      <div role="tablist" aria-label="Withdrawal stage" className="mb-4 inline-flex rounded-xl border border-border bg-surface-alt p-1">
        {STAGES.map((item) => (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={stage === item.value}
            onClick={() => { setStage(item.value); setPending(null); }}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${stage === item.value ? 'bg-surface text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-900'}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3"><Skeleton variant="card" /><Skeleton variant="card" /><Skeleton variant="card" /></div>
      ) : error && rows.length === 0 ? (
        <EmptyState title="Queue did not load" hint={error} action={{ label: 'Retry', onClick: load }} />
      ) : rows.length === 0 ? (
        <EmptyState title="Nothing here" hint={current.empty} />
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
          {rows.map((row, index) => {
            const form = pending?.id === row.id ? pending.kind : null;
            const busy = actioningId === row.id;
            return (
            <motion.div
              key={row.id}
              layout
              initial={{ opacity: 0, transform: 'translateY(8px)' }}
              animate={{ opacity: 1, transform: 'translateY(0px)', transition: { duration: 0.2, ease: EASE_OUT, delay: staggerDelaySeconds(index) } }}
              exit={{ opacity: 0, transform: 'translateY(-8px)', transition: { duration: 0.2, ease: EASE_OUT } }}
            >
            <Card className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{row.driverName} · {row.driverPhone}</p>
                  <p className="text-sm text-ink-500">
                    {ACCOUNT_TYPE_LABELS[row.accountType]} · {row.accountName} · <span className="font-semibold text-ink-900">{row.accountNo ?? row.accountNoMasked}</span>
                    {row.bankName ? ` · ${row.bankName}` : ''}
                  </p>
                  <p className="text-xs text-ink-500">
                    Requested {formatDateTime(row.requestedAt)}
                    {row.processedAt && stage === 'approved' ? ` · approved ${formatDateTime(row.processedAt)}` : ''}
                  </p>
                </div>
                <p className="text-xl font-bold tabular-nums">{formatBDT(row.amount)}</p>
              </div>

              {form ? (
                <div className="mt-3 space-y-2 border-t border-border pt-3">
                  <Input
                    label={form === 'paid' ? 'Transaction reference (optional)' : form === 'failed' ? 'Why it failed' : 'Rejection reason'}
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder={form === 'paid' ? 'e.g. bKash TrxID 9ABC1D2EF' : form === 'failed' ? 'e.g. bKash number is not registered' : 'e.g. Account details could not be verified'}
                  />
                  {form !== 'paid' && <p className="text-xs text-ink-500">The {formatBDT(row.amount)} goes back to the driver's wallet, and they're told why.</p>}
                  <div className="flex gap-2">
                    <Button variant="secondary" onClick={() => { setPending(null); setNote(''); }}>Cancel</Button>
                    {form === 'paid' ? (
                      <Button loading={busy} onClick={() => void act(row.id, () => adminApi.markWithdrawalPaid(row.id, note.trim() || undefined), 'Marked paid. The driver has been told.', 'Could not mark it paid.')}>
                        Confirm paid
                      </Button>
                    ) : (
                      <Button
                        variant="danger"
                        loading={busy}
                        disabled={!note.trim()}
                        onClick={() => void act(
                          row.id,
                          () => (form === 'failed' ? adminApi.markWithdrawalFailed(row.id, note.trim()) : adminApi.rejectWithdrawal(row.id, note.trim())),
                          form === 'failed' ? 'Marked failed — the amount is back in the driver\'s wallet.' : 'Withdrawal rejected — the hold was reversed.',
                          form === 'failed' ? 'Could not mark it failed.' : 'Could not reject that withdrawal.',
                        )}
                      >
                        {form === 'failed' ? 'Confirm failed' : 'Confirm reject'}
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
                  {stage === 'requested' ? (
                    <>
                      <Button variant="secondary" onClick={() => openForm(row.id, 'reject')} disabled={busy}>Reject</Button>
                      <Button loading={busy} onClick={() => void act(row.id, () => adminApi.approveWithdrawal(row.id), 'Approved. It\'s now under "To pay out".', 'Could not approve that withdrawal.')}>
                        Approve
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button variant="secondary" onClick={() => openForm(row.id, 'failed')} disabled={busy}>Payout failed</Button>
                      <Button onClick={() => openForm(row.id, 'paid')} disabled={busy}>Mark paid</Button>
                    </>
                  )}
                </div>
              )}
            </Card>
            </motion.div>
            );
          })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
