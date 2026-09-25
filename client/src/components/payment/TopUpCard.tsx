import { useState } from 'react';
import * as paymentsApi from '../../api/payments.api';
import type { GatewayMethod } from '../../api/payments.api';
import { getApiErrorMessage } from '../../utils/apiError';
import { formatBDT } from '../../utils/format';
import { Button, Card, Input, toast } from '../ui';
import { MethodPicker } from './MethodPicker';
import { t } from '../../i18n';

const PRESETS = [100, 200, 500, 1000];
const MIN = 10;
const MAX = 25_000;

export function TopUpCard() {
  const [amount, setAmount] = useState('200');
  const [method, setMethod] = useState<GatewayMethod>('bkash');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function start() {
    const value = Number(amount);
    if (!Number.isFinite(value) || value < MIN || value > MAX) {
      setError(t('Enter an amount between {0} and {1}', formatBDT(MIN), formatBDT(MAX)));
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const { redirectUrl } = await paymentsApi.topup(value, method);
      window.location.assign(redirectUrl);
    } catch (thrown) {
      toast.error(getApiErrorMessage(thrown, t('Could not start the top-up.')));
      setBusy(false);
    }
  }

  return (
    <Card className="mb-5">
      <h2 className="font-semibold">{t('Add money')}</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => { setAmount(String(preset)); setError(null); }}
            className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold tabular-nums ${Number(amount) === preset ? 'border-cholo-700 bg-cholo-50 text-cholo-800' : 'border-border text-ink-500 hover:text-ink-900'}`}
          >
            {formatBDT(preset)}
          </button>
        ))}
      </div>
      <Input containerClassName="mt-3" label={t('Amount (৳)')} inputMode="numeric" value={amount} error={error ?? undefined} onChange={(event) => { setAmount(event.target.value.replace(/[^\d]/g, '').slice(0, 5)); setError(null); }} />
      <div className="mt-3">
        <MethodPicker methods={['bkash', 'nagad', 'card']} value={method} onChange={(next) => setMethod(next as GatewayMethod)} />
      </div>
      <Button className="mt-4 w-full" loading={busy} onClick={() => void start()}>{amount ? t('Add {0}', formatBDT(Number(amount))) : t('Add money')}</Button>
      <p className="mt-2 text-center text-xs text-ink-500">{t('You’ll finish the payment on SSLCommerz’s secure page, then come back here.')}</p>
    </Card>
  );
}
