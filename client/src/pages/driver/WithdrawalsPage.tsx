import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import * as driverApi from '../../api/driver.api';
import * as walletApi from '../../api/wallet.api';
import { Button, Card, EmptyState, Input, Skeleton, toast } from '../../components/ui';
import type { PayoutAccount, PayoutAccountType, Withdrawal, WithdrawalStatus } from '../../types/earnings.types';
import type { Wallet, WalletTransaction } from '../../types/wallet.types';
import { WalletTxnRow } from '../../components/wallet/WalletTxnRow';
import { getApiErrorMessage } from '../../utils/apiError';
import { formatBDT, formatDateTime } from '../../utils/format';
import { EASE_OUT } from '../../utils/motion';
import { staggerStyle } from '../../utils/stagger';
import { t } from '../../i18n';

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
      {t(status)}
    </span>
  );
}

const ACCOUNT_TYPE_LABELS: Record<PayoutAccountType, string> = { bkash: 'bKash', nagad: 'Nagad', bank: 'Bank' };

const MIN_WITHDRAWAL = 50;

const STATUS_NOTES: Partial<Record<WithdrawalStatus, string>> = {
  requested: t('Waiting for review. The amount is held from your wallet.'),
  approved: t('Approved — the money is being sent to your account.'),
  processing: t('Approved — the money is being sent to your account.'),
  rejected: t('Not approved. The amount is back in your wallet.'),
  failed: t('The payout didn’t go through. The amount is back in your wallet.'),
};

export function WithdrawalsPage() {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [accounts, setAccounts] = useState<PayoutAccount[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activity, setActivity] = useState<WalletTransaction[]>([]);
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
      walletApi.listTransactions({ limit: 8 }).then((result) => setActivity(result.data)).catch(() => {});
      setAccounts(nextAccounts);
      setWithdrawals(nextWithdrawals.data);
      setPayoutAccountId((current) => current || nextAccounts[0]?.id || '');
    } catch (thrown) {
      setError(getApiErrorMessage(thrown, t('Could not load your withdrawals.')));
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
      toast.success(t('Payout account added.'));
    } catch (thrown) {
      toast.error(getApiErrorMessage(thrown, t('Could not add that account.')));
    } finally {
      setSavingAccount(false);
    }
  }

  async function handleRemoveAccount(accountId: string) {
    try {
      await driverApi.removePayoutAccount(accountId);
      setAccounts((current) => current.filter((account) => account.id !== accountId));
      if (payoutAccountId === accountId) setPayoutAccountId('');
      toast.success(t('Payout account removed.'));
    } catch (thrown) {
      toast.error(getApiErrorMessage(thrown, t('Could not remove that account.')));
    }
  }

  const balance = Number(wallet?.balance ?? 0);
  const frozen = wallet?.status === 'frozen';
  const amountNumber = Number(amount);
  const amountError = !amount ? null
    : !Number.isFinite(amountNumber) || amountNumber <= 0 ? t('Enter an amount.')
      : amountNumber < MIN_WITHDRAWAL ? t('The minimum withdrawal is {0}.', formatBDT(MIN_WITHDRAWAL))
        : amountNumber > balance ? t('You can withdraw up to {0}.', formatBDT(Math.max(0, balance)))
          : null;
  const canWithdraw = !frozen && balance >= MIN_WITHDRAWAL;

  async function handleRequestWithdrawal(event: FormEvent) {
    event.preventDefault();
    if (!amount || amountError || !canWithdraw) return;
    setSubmitting(true);
    try {
      const created = await driverApi.requestWithdrawal({ amount: amountNumber, payoutAccountId });
      setWithdrawals((current) => [created, ...current]);
      setAmount('');
      toast.success(t('Withdrawal requested — a finance admin will review it.'));
    } catch (thrown) {
      toast.error(getApiErrorMessage(thrown, t('Could not request that withdrawal.')));
    } finally {
      walletApi.getWallet().then(setWallet).catch(() => {});
      walletApi.listTransactions({ limit: 8 }).then((result) => setActivity(result.data)).catch(() => {});
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
        <EmptyState title={t('Withdrawals did not load')} hint={error} action={{ label: t('Retry'), onClick: load }} />
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-[calc(100dvh-4rem)] max-w-3xl px-4 py-5 md:px-6">
      <div className="mb-5">
        <h1 className="text-2xl font-bold">{t('Withdrawals')}</h1>
        <p className="text-sm text-ink-500">{t('Cash out to bKash, Nagad, or your bank.')}</p>
      </div>

      <div className="mb-5 rounded-xl bg-cholo-700 p-5 text-white">
        <p className="text-sm text-white/80">{t('Available to withdraw')}</p>
        <p className="mt-1 text-4xl font-bold tabular-nums">{formatBDT(Math.max(0, balance))}</p>
        {balance < 0 && (
          <p className="mt-2 text-sm text-white/85">
            {t('You owe {0} in commission from cash trips. It comes out of your next in-app earnings.', formatBDT(-balance))}
          </p>
        )}
        {balance < 0 && (
          <a href={`/wallet?amount=${Math.max(10, Math.ceil(-balance))}`} className="mt-3 inline-flex h-10 items-center rounded-xl bg-white px-4 text-sm font-semibold text-cholo-700 hover:bg-white/90">
            {t('Pay dues now')}
          </a>
        )}
      </div>

      {frozen && (
        <p role="alert" className="mb-5 rounded-xl bg-danger-600/10 p-4 text-sm text-danger-600">
          {t('Your wallet is frozen, so withdrawals are paused. Contact support to unfreeze it.')}
        </p>
      )}

      <Card className="mb-5">
        <h2 className="mb-3 font-semibold">{t('Request a withdrawal')}</h2>
        {accounts.length === 0 ? (
          <p className="text-sm text-ink-500">{t('Add a payout account below before requesting a withdrawal.')}</p>
        ) : (
          <form onSubmit={handleRequestWithdrawal} className="space-y-3">
            <label className="block text-sm font-medium text-ink-900">
              {t('Payout account')}
              <select
                value={payoutAccountId}
                onChange={(event) => setPayoutAccountId(event.target.value)}
                required
                className="mt-1 h-11 w-full rounded-xl border border-border bg-surface px-3 focus:border-cholo-700 focus:outline-none focus:ring-2 focus:ring-cholo-700/20"
              >
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {t(ACCOUNT_TYPE_LABELS[account.accountType])} · {account.accountNoMasked}
                  </option>
                ))}
              </select>
            </label>
            <div>
              <Input
                label={t('Amount (৳)')}
                inputMode="decimal"
                value={amount}
                error={amountError ?? undefined}
                disabled={!canWithdraw}
                onChange={(event) => setAmount(event.target.value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1').replace(/^(\d*\.\d{0,2}).*$/, '$1'))}
                placeholder={t('Minimum ৳50')}
                required
              />
              {canWithdraw && (
                <button type="button" onClick={() => setAmount((Math.floor(Math.round(balance * 100)) / 100).toFixed(2).replace(/\.?0+$/, ''))} className="mt-1.5 text-sm font-semibold text-cholo-700 hover:underline">
                  {t('Withdraw all ({0})', formatBDT(balance))}
                </button>
              )}
            </div>
            <p className="text-xs text-ink-500">
              {canWithdraw
                ? t('Fee: ৳0.00 — you\'ll receive the full amount. It\'s held from your wallet until finance reviews it.')
                : frozen ? t('Withdrawals are paused while your wallet is frozen.') : t('You need at least {0} to withdraw.', formatBDT(MIN_WITHDRAWAL))}
            </p>
            <Button type="submit" loading={submitting} disabled={!canWithdraw || !amount || Boolean(amountError)} className="w-full">{t('Request withdrawal')}</Button>
          </form>
        )}
      </Card>

      <Card className="mb-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">{t('Payout accounts')}</h2>
          <Button type="button" variant="secondary" onClick={() => setShowAddAccount((current) => !current)}>
            {showAddAccount ? t('Cancel') : t('+ Add account')}
          </Button>
        </div>

        <AnimatePresence>
          {showAddAccount && (
            <motion.form
              key="add-account-form"
              onSubmit={handleAddAccount}
              initial={{ opacity: 0, transform: 'translateY(-8px)' }}
              animate={{ opacity: 1, transform: 'translateY(0px)' }}
              exit={{ opacity: 0, transform: 'translateY(-8px)' }}
              transition={{ duration: 0.2, ease: EASE_OUT }}
              className="mb-4 space-y-3 border-b border-border pb-4"
            >
              <label className="block text-sm font-medium text-ink-900">
                {t('Type')}
                <select
                  value={accountType}
                  onChange={(event) => setAccountType(event.target.value as PayoutAccountType)}
                  className="mt-1 h-11 w-full rounded-xl border border-border bg-surface px-3 focus:border-cholo-700 focus:outline-none focus:ring-2 focus:ring-cholo-700/20"
                >
                  <option value="bkash">{t('bKash')}</option>
                  <option value="nagad">{t('Nagad')}</option>
                  <option value="bank">{t('Bank')}</option>
                </select>
              </label>
              <Input label={t('Account holder name')} value={accountName} onChange={(event) => setAccountName(event.target.value)} required />
              <Input
                label={accountType === 'bank' ? t('Account number') : t('Mobile number')}
                variant={accountType === 'bank' ? 'text' : 'phone'}
                value={accountNo}
                onChange={(event) => setAccountNo(event.target.value)}
                required
              />
              {accountType === 'bank' && (
                <Input label={t('Bank name')} value={bankName} onChange={(event) => setBankName(event.target.value)} required />
              )}
              <Button type="submit" loading={savingAccount} className="w-full">{t('Save account')}</Button>
            </motion.form>
          )}
        </AnimatePresence>

        {accounts.length === 0 ? (
          <p className="text-sm text-ink-500">{t('No payout accounts yet.')}</p>
        ) : (
          <div className="space-y-2">
            {accounts.map((account, index) => (
              <div key={account.id} className="flex items-center justify-between rounded-xl border border-border p-3 animate-stagger-in" style={staggerStyle(index)}>
                <div>
                  <p className="text-sm font-medium">{t(ACCOUNT_TYPE_LABELS[account.accountType])} · {account.accountNoMasked}</p>
                  <p className="text-xs text-ink-500">{account.accountName}{account.bankName ? ` · ${account.bankName}` : ''}</p>
                </div>
                <Button type="button" variant="secondary" onClick={() => handleRemoveAccount(account.id)}>{t('Remove')}</Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {activity.length > 0 && (
        <>
          <h2 className="mb-3 font-semibold">{t('Recent wallet activity')}</h2>
          <div className="mb-5 space-y-2">
            {activity.map((txn) => <WalletTxnRow key={txn.id} txn={txn} />)}
          </div>
        </>
      )}

      <h2 className="mb-3 font-semibold">{t('History')}</h2>
      {withdrawals.length === 0 ? (
        <EmptyState title={t('No withdrawals yet')} hint={t('Requests you make will show up here with their review status.')} />
      ) : (
        <div className="space-y-2">
          {withdrawals.map((withdrawal, index) => (
            <Card key={withdrawal.id} className="p-3 animate-stagger-in" style={staggerStyle(index)}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold tabular-nums">{formatBDT(withdrawal.amount)}</p>
                  <p className="text-xs text-ink-500">
                    {t(ACCOUNT_TYPE_LABELS[withdrawal.accountType])} · {withdrawal.accountNoMasked}
                  </p>
                  <p className="text-xs text-ink-500">{formatDateTime(withdrawal.requestedAt)}</p>
                </div>
                <WithdrawalStatusBadge status={withdrawal.status} />
              </div>
              {STATUS_NOTES[withdrawal.status] && <p className="mt-2 text-xs text-ink-500">{STATUS_NOTES[withdrawal.status]}</p>}
              {withdrawal.status === 'paid' && withdrawal.payoutReference && (
                <p className="mt-2 text-xs text-ink-500">{t('Transaction reference: {0}', withdrawal.payoutReference)}</p>
              )}
              {withdrawal.rejectionReason && (
                <p className="mt-2 text-sm text-danger-600">{t('Reason:')} {withdrawal.rejectionReason}</p>
              )}
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
