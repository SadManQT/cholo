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

// doc 11-12 §7: "/admin/payouts | finance queue | requested table, account
// details (masked), Approve→gateway / Reject+reason | finance access
// level only." The page itself is visible to any admin (matches GET
// /admin/withdrawals having no access-level restriction); only the
// approve/reject actions can come back 403 FORBIDDEN_ACCESS_LEVEL for a
// non-finance admin, surfaced honestly rather than hidden — an ops/support
// admin should be able to SEE the queue, just not act on it.
export function PayoutsPage() {
  const [rows, setRows] = useState<WithdrawalQueueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await adminApi.listWithdrawalQueue({ status: 'requested', limit: 50 });
      setRows(result.data);
    } catch (thrown) {
      setError(getApiErrorMessage(thrown, 'Could not load the payout queue.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleApprove(id: string) {
    setActioningId(id);
    try {
      await adminApi.approveWithdrawal(id);
      setRows((current) => current.filter((row) => row.id !== id));
      toast.success('Withdrawal approved.');
    } catch (thrown) {
      toast.error(getApiErrorMessage(thrown, 'Could not approve that withdrawal.'));
    } finally {
      setActioningId(null);
    }
  }

  async function handleReject(id: string) {
    if (!rejectReason.trim()) return;
    setActioningId(id);
    try {
      await adminApi.rejectWithdrawal(id, rejectReason.trim());
      setRows((current) => current.filter((row) => row.id !== id));
      setRejectingId(null);
      setRejectReason('');
      toast.success('Withdrawal rejected — the hold was reversed.');
    } catch (thrown) {
      toast.error(getApiErrorMessage(thrown, 'Could not reject that withdrawal.'));
    } finally {
      setActioningId(null);
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-5">
        <h1 className="text-2xl font-bold">Withdrawals</h1>
        <p className="text-sm text-ink-500">Requested payouts awaiting finance review.</p>
      </div>

      {loading ? (
        <div className="space-y-3"><Skeleton variant="card" /><Skeleton variant="card" /><Skeleton variant="card" /></div>
      ) : error && rows.length === 0 ? (
        <EmptyState title="Queue did not load" hint={error} action={{ label: 'Retry', onClick: load }} />
      ) : rows.length === 0 ? (
        <EmptyState title="Nothing to review" hint="Every requested withdrawal has been reviewed." />
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
          {rows.map((row, index) => (
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
                    {ACCOUNT_TYPE_LABELS[row.accountType]} · {row.accountName} · {row.accountNoMasked}
                    {row.bankName ? ` · ${row.bankName}` : ''}
                  </p>
                  <p className="text-xs text-ink-500">Requested {formatDateTime(row.requestedAt)}</p>
                </div>
                <p className="text-xl font-bold tabular-nums">{formatBDT(row.amount)}</p>
              </div>

              {rejectingId === row.id ? (
                <div className="mt-3 space-y-2 border-t border-border pt-3">
                  <Input
                    label="Rejection reason"
                    value={rejectReason}
                    onChange={(event) => setRejectReason(event.target.value)}
                    placeholder="e.g. Account details could not be verified"
                  />
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => { setRejectingId(null); setRejectReason(''); }}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={() => handleReject(row.id)}
                      loading={actioningId === row.id}
                      disabled={!rejectReason.trim()}
                    >
                      Confirm reject
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="mt-3 flex gap-2 border-t border-border pt-3">
                  <Button
                    variant="secondary"
                    onClick={() => setRejectingId(row.id)}
                    disabled={actioningId === row.id}
                  >
                    Reject
                  </Button>
                  <Button
                    onClick={() => handleApprove(row.id)}
                    loading={actioningId === row.id}
                  >
                    Approve
                  </Button>
                </div>
              )}
            </Card>
            </motion.div>
          ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
