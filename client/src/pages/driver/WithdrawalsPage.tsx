import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import * as driverApi from '../../api/driver.api';
import * as walletApi from '../../api/wallet.api';
import { Button, Card, EmptyState, Input, Skeleton, toast } from '../../components/ui';
import type { PayoutAccount, PayoutAccountType, Withdrawal, WithdrawalStatus } from '../../types/earnings.types';
import type { Wallet } from '../../types/wallet.types';
import { getApiErrorMessage } from '../../utils/apiError';
import { formatBDT, formatDateTime } from '../../utils/format';
import { staggerStyle } from '../../utils/stagger';

// withdrawal_status (schema.sql) is its own enum, separate from ride/trip
// status — doc 11-12 §2.1's shared StatusBadge is explicitly scoped to
// "ride_request_status + trip_status" only, so this stays a small local
// badge rather than stretching that component's documented scope.
const STATUS_STYLES: Record<WithdrawalStatus, string> = {
  requested: 'bg-marigold-500/15 text-marigold-500',
  approved: 'bg-info-600/10 text-info-600',
  processing: 'bg-info-600/10 text-info-600',
  paid: 'bg-cholo-50 text-cholo-700',
  rejected: 'bg-danger-600/10 text-danger-600',
  failed: 'bg-danger-600/10 text-danger-600',
};

function WithdrawalStatusBadge({ status }: { status: WithdrawalStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium capitalize ${STATUS_STYLES[status]}`}>
      {status}
    </span>
  );
}

const ACCOUNT_TYPE_LABELS: Record<PayoutAccountType, string> = { bkash: 'bKash', nagad: 'Nagad', bank: 'Bank' };

export function WithdrawalsPage() {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [accounts, setAccounts] = useState<PayoutAccount[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showAddAccount, setShowAddAccount] = useState(false);
  const [accountType, setAccountType] = useState<PayoutAccountType>('bkash');
  const [accountName, setAccountName] = useState('');
  const [accountNo, setAccountNo] = useState('');
  const [bankName, setBankName] = useState('');
  const [savingAccount, setSavingAccount] = useState(false);

  const [amount, setAmount] = useState('');
  const [payoutAccountId, setPayoutAccountId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextWallet, nextAccounts, nextWithdrawals] = await Promise.all([
        walletApi.getWallet(),
        driverApi.listPayoutAccounts(),
        driverApi.listWithdrawals({ limit: 20 }),
      ]);
      setWallet(nextWallet);
      setAccounts(nextAccounts);
      setWithdrawals(nextWithdrawals.data);
      setPayoutAccountId((current) => current || nextAccounts[0]?.id || '');
    } catch (thrown) {
      setError(getApiErrorMessage(thrown, 'Could not load your withdrawals.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleAddAccount(event: FormEvent) {
    event.preventDefault();
    setSavingAccount(true);
    try {
      const created = await driverApi.addPayoutAccount({
        accountType,
        accountName,
        accountNo,
        ...(accountType === 'bank' ? { bankName } : {}),
      });
      setAccounts((current) => [created, ...current]);
      setPayoutAccountId((current) => current || created.id);
      setAccountName('');
      setAccountNo('');
      setBankName('');
      setShowAddAccount(false);
      toast.success('Payout account added.');
    } catch (thrown) {
      toast.error(getApiErrorMessage(thrown, 'Could not add that account.'));
    } finally {
      setSavingAccount(false);
    }
  }

  async function handleRemoveAccount(accountId: string) {
    try {
      await driverApi.removePayoutAccount(accountId);
      setAccounts((current) => current.filter((account) => account.id !== accountId));
      if (payoutAccountId === accountId) setPayoutAccountId('');
      toast.success('Payout account removed.');
    } catch (thrown) {
      toast.error(getApiErrorMessage(thrown, 'Could not remove that account.'));
    }
  }

  async function handleRequestWithdrawal(event: FormEvent) {
    event.preventDefault();
    const amountNumber = Number(amount);
    setSubmitting(true);
    try {
      const created = await driverApi.requestWithdrawal({ amount: amountNumber, payoutAccountId });
      setWithdrawals((current) => [created, ...current]);
      setAmount('');
      const nextWallet = await walletApi.getWallet();
      setWallet(nextWallet);
      toast.success('Withdrawal requested — a finance admin will review it.');
    } catch (thrown) {
      toast.error(getApiErrorMessage(thrown, 'Could not request that withdrawal.'));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto min-h-[calc(100dvh-4rem)] max-w-3xl space-y-3 px-4 py-5 md:px-6">
        <Skeleton variant="card" className="h-24" />
        <Skeleton variant="card" /><Skeleton variant="card" />
      </main>
    );
  }

  if (error && !wallet) {
    return (
      <main className="mx-auto min-h-[calc(100dvh-4rem)] max-w-3xl px-4 py-5 md:px-6">
        <EmptyState title="Withdrawals did not load" hint={error} action={{ label: 'Retry', onClick: load }} />
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-[calc(100dvh-4rem)] max-w-3xl px-4 py-5 md:px-6">
      <div className="mb-5">
        <h1 className="text-2xl font-bold">Withdrawals</h1>
        <p className="text-sm text-ink-500">Cash out to bKash, Nagad, or your bank.</p>
      </div>

      <div className="mb-5 rounded-xl bg-cholo-700 p-5 text-white">
        <p className="text-sm text-white/80">Available balance</p>
        <p className="mt-1 text-4xl font-bold tabular-nums">{formatBDT(wallet?.balance)}</p>
      </div>

      <Card className="mb-5">
        <h2 className="mb-3 font-semibold">Request a withdrawal</h2>
        {accounts.length === 0 ? (
          <p className="text-sm text-ink-500">Add a payout account below before requesting a withdrawal.</p>
        ) : (
          <form onSubmit={handleRequestWithdrawal} className="space-y-3">
            <label className="block text-sm font-medium text-ink-900">
              Payout account
              <select
                value={payoutAccountId}
                onChange={(event) => setPayoutAccountId(event.target.value)}
                required
                className="mt-1 h-11 w-full rounded-xl border border-border bg-surface px-3 focus:border-cholo-700 focus:outline-none focus:ring-2 focus:ring-cholo-700/20"
              >
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {ACCOUNT_TYPE_LABELS[account.accountType]} · {account.accountNoMasked}
                  </option>
                ))}
              </select>
            </label>
            {/* Input's `type` is deliberately excluded from its props (it
                only offers text/phone/password variants) — inputMode is
                enough to bring up a numeric keyboard on mobile without
                needing a 4th variant just for this one field. */}
            <Input
              label="Amount (৳)"
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value.replace(/[^0-9.]/g, ''))}
              placeholder="Minimum ৳50"
              required
            />
            <p className="text-xs text-ink-500">Fee: ৳0.00 — you'll receive the full amount.</p>
            <Button type="submit" loading={submitting} className="w-full">Request withdrawal</Button>
          </form>
        )}
      </Card>

      <Card className="mb-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Payout accounts</h2>
          <Button type="button" variant="secondary" onClick={() => setShowAddAccount((current) => !current)}>
            {showAddAccount ? 'Cancel' : '+ Add account'}
          </Button>
        </div>

        {showAddAccount && (
          <form onSubmit={handleAddAccount} className="mb-4 space-y-3 border-b border-border pb-4 animate-stagger-in">
            <label className="block text-sm font-medium text-ink-900">
              Type
              <select
                value={accountType}
                onChange={(event) => setAccountType(event.target.value as PayoutAccountType)}
                className="mt-1 h-11 w-full rounded-xl border border-border bg-surface px-3 focus:border-cholo-700 focus:outline-none focus:ring-2 focus:ring-cholo-700/20"
              >
                <option value="bkash">bKash</option>
                <option value="nagad">Nagad</option>
                <option value="bank">Bank</option>
              </select>
            </label>
            <Input label="Account holder name" value={accountName} onChange={(event) => setAccountName(event.target.value)} required />
            <Input
              label={accountType === 'bank' ? 'Account number' : 'Mobile number'}
              variant={accountType === 'bank' ? 'text' : 'phone'}
              value={accountNo}
              onChange={(event) => setAccountNo(event.target.value)}
              required
            />
            {accountType === 'bank' && (
              <Input label="Bank name" value={bankName} onChange={(event) => setBankName(event.target.value)} required />
            )}
            <Button type="submit" loading={savingAccount} className="w-full">Save account</Button>
          </form>
        )}

        {accounts.length === 0 ? (
          <p className="text-sm text-ink-500">No payout accounts yet.</p>
        ) : (
          <div className="space-y-2">
            {accounts.map((account, index) => (
              <div key={account.id} className="flex items-center justify-between rounded-xl border border-border p-3 animate-stagger-in" style={staggerStyle(index)}>
                <div>
                  <p className="text-sm font-medium">{ACCOUNT_TYPE_LABELS[account.accountType]} · {account.accountNoMasked}</p>
                  <p className="text-xs text-ink-500">{account.accountName}{account.bankName ? ` · ${account.bankName}` : ''}</p>
                </div>
                <Button type="button" variant="secondary" onClick={() => handleRemoveAccount(account.id)}>Remove</Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <h2 className="mb-3 font-semibold">History</h2>
      {withdrawals.length === 0 ? (
        <EmptyState title="No withdrawals yet" hint="Requests you make will show up here with their review status." />
      ) : (
        <div className="space-y-2">
          {withdrawals.map((withdrawal, index) => (
            <Card key={withdrawal.id} className="p-3 animate-stagger-in" style={staggerStyle(index)}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold tabular-nums">{formatBDT(withdrawal.amount)}</p>
                  <p className="text-xs text-ink-500">
                    {ACCOUNT_TYPE_LABELS[withdrawal.accountType]} · {withdrawal.accountNoMasked}
                  </p>
                  <p className="text-xs text-ink-500">{formatDateTime(withdrawal.requestedAt)}</p>
                </div>
                <WithdrawalStatusBadge status={withdrawal.status} />
              </div>
              {withdrawal.rejectionReason && (
                <p className="mt-2 text-sm text-danger-600">Reason: {withdrawal.rejectionReason}</p>
              )}
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
