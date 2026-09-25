import { useEffect, useState } from 'react';
import * as paymentsApi from '../../api/payments.api';
import * as walletApi from '../../api/wallet.api';
import { getApiErrorMessage } from '../../utils/apiError';
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

// Shown to the passenger for a completed trip that isn't settled yet (anything but cash is paid after the ride).
export function PayTripCard({ tripCode, total, preferred, onPaid }: PayTripCardProps) {
  const [balance, setBalance] = useState<string | null>(null);
  const [method, setMethod] = useState<PayMethod>(['wallet', 'bkash', 'nagad', 'card'].includes(preferred) ? preferred as PayMethod : 'bkash');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    walletApi.getWallet().then((wallet) => setBalance(wallet.balance)).catch(() => setBalance(null));
  }, []);

  const walletShort = balance != null && Number(balance) < Number(total);

  async function pay() {
    setBusy(true);
    try {
      const result = await paymentsApi.payTrip(tripCode, method);
      if (result.status === 'pending_redirect') {
        window.location.assign(result.redirectUrl);
        return;
      }
      toast.success(t('Paid {0} from your wallet.', formatBDT(total)));
      onPaid();
    } catch (thrown) {
      toast.error(getApiErrorMessage(thrown, t('Could not start the payment.')));
    } finally {
      setBusy(false);
    }
  }

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
          methods={['wallet', 'bkash', 'nagad', 'card']}
          value={method}
          onChange={setMethod}
          walletBalance={balance != null ? formatBDT(balance) : undefined}
          disabledReason={walletShort ? { wallet: t('Balance {0}, top up first', formatBDT(balance)) } : {}}
        />
      </div>
      <Button className="mt-4 w-full" loading={busy} disabled={method === 'wallet' && walletShort} onClick={() => void pay()}>
        {method === 'wallet' ? t('Pay {0}', formatBDT(total)) : t('Continue to {0}', method === 'card' ? 'card payment' : method === 'bkash' ? 'bKash' : 'Nagad')}
      </Button>
    </Card>
  );
}
