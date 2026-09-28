import { useEffect, useState } from 'react';
import * as paymentsApi from '../../api/payments.api';
import * as walletApi from '../../api/wallet.api';
import type { Wallet } from '../../types/wallet.types';
import { getApiErrorCode, getApiErrorMessage } from '../../utils/apiError';
import { formatBDT } from '../../utils/format';
import { Button, Card, toast } from '../ui';
import { MethodPicker } from './MethodPicker';
import type { PayMethod } from './MethodPicker';
import { t } from '../../i18n';

interface PayTripCardProps {
  tripCode: string;
  total: string;
  preferred: string;
  onPaid: () => void;
}

const METHODS: PayMethod[] = ['wallet', 'bkash', 'nagad', 'card'];

const CONTINUE_LABEL: Record<Exclude<PayMethod, 'cash' | 'wallet'>, string> = {
  bkash: t('Continue to bKash'),
  nagad: t('Continue to Nagad'),
  card: t('Continue to card payment'),
};

// Shown to the passenger for a completed trip that isn't settled yet. Wallet trips are charged at drop-off,
// so this appears for pay-later methods, or when the wallet didn't cover the final fare.
export function PayTripCard({ tripCode, total, preferred, onPaid }: PayTripCardProps) {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [walletLoaded, setWalletLoaded] = useState(false);
  const [method, setMethod] = useState<PayMethod>(METHODS.includes(preferred as PayMethod) ? preferred as PayMethod : 'bkash');
  const [busy, setBusy] = useState(false);

  function loadWallet() {
    walletApi.getWallet()
      .then(setWallet)
      .catch(() => setWallet(null))
      .finally(() => setWalletLoaded(true));
  }

  useEffect(loadWallet, []);

  const shortBy = wallet ? Math.max(0, Number(total) - Number(wallet.balance)) : 0;
  const walletReason = !walletLoaded ? t('Checking balance…')
    : !wallet ? t('Wallet unavailable right now')
      : wallet.status === 'frozen' ? t('Wallet is frozen')
        : shortBy > 0 ? t('Balance {0}, {1} short', formatBDT(wallet.balance), formatBDT(shortBy))
          : null;

  // Never leave an unusable wallet selected (the rider booked with wallet but the balance no longer covers it).
  useEffect(() => {
    if (walletLoaded && walletReason && method === 'wallet') setMethod('bkash');
  }, [walletLoaded, walletReason, method]);

  async function pay() {
    setBusy(true);
    try {
      const result = await paymentsApi.payTrip(tripCode, method as 'wallet' | 'bkash' | 'nagad' | 'card');
      if (result.status === 'pending_redirect') {
        window.location.assign(result.redirectUrl);
        return;
      }
      toast.success(t('Paid {0} from your wallet.', formatBDT(total)));
      onPaid();
    } catch (thrown) {
      const code = getApiErrorCode(thrown);
      if (code === 'INSUFFICIENT_FUNDS' || code === 'WALLET_FROZEN') loadWallet();
      if (code === 'ALREADY_PAID') onPaid();
      toast.error(getApiErrorMessage(thrown, t('Could not start the payment.')));
    } finally {
      setBusy(false);
    }
  }

  const topUpAmount = Math.max(10, Math.ceil(shortBy));

  return (
    <Card className="mb-4 border-marigold-500/40 print:hidden">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">{t('Payment due')}</h2>
          <p className="text-sm text-ink-500">{t('This trip isn’t paid yet. Your driver is paid once you settle it.')}</p>
        </div>
        <p className="text-xl font-bold tabular-nums">{formatBDT(total)}</p>
      </div>
      <div className="mt-4">
        <MethodPicker
          methods={METHODS}
          value={method}
          onChange={setMethod}
          walletBalance={wallet ? formatBDT(wallet.balance) : undefined}
          disabledReason={walletReason ? { wallet: walletReason } : {}}
          topUpHref={wallet?.status === 'active' && shortBy > 0 ? `/wallet?amount=${topUpAmount}&returnTo=${encodeURIComponent(`/trips/${tripCode}`)}` : undefined}
        />
      </div>
      <Button className="mt-4 w-full" loading={busy} disabled={method === 'wallet' && Boolean(walletReason)} onClick={() => void pay()}>
        {method === 'wallet' || method === 'cash' ? t('Pay {0}', formatBDT(total)) : CONTINUE_LABEL[method]}
      </Button>
      <p className="mt-2 text-center text-xs text-ink-500">
        {method === 'wallet' ? t('Paid instantly from your Cholo wallet.') : t('You’ll finish on SSLCommerz’s secure page, then come back to your receipt.')}
      </p>
    </Card>
  );
}
