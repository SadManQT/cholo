import { Link } from 'react-router-dom';
import type { GatewayMethod } from '../../api/payments.api';
import { t } from '../../i18n';

export type PayMethod = 'cash' | 'wallet' | GatewayMethod;

const LABELS: Record<PayMethod, { name: string; hint: string; mark: string; tone: string }> = {
  cash: { name: t('Cash'), hint: t('Pay your driver at drop-off'), mark: '৳', tone: 'bg-marigold-500 text-ink-900' },
  wallet: { name: t('Cholo wallet'), hint: t('Pay instantly from your balance'), mark: 'W', tone: 'bg-cholo-700 text-white' },
  bkash: { name: 'bKash', hint: t('Mobile wallet'), mark: 'b', tone: 'bg-[#E2136E] text-white' },
  nagad: { name: t('Nagad'), hint: t('Mobile wallet'), mark: 'N', tone: 'bg-[#F6921E] text-white' },
  card: { name: t('Card'), hint: t('Visa, Mastercard, Amex'), mark: '▭', tone: 'bg-ink-900 text-surface' },
};

interface MethodPickerProps {
  methods: PayMethod[];
  value: PayMethod;
  onChange: (method: PayMethod) => void;
  disabledReason?: Partial<Record<PayMethod, string>>;
  hints?: Partial<Record<PayMethod, string>>;
  walletBalance?: string;
  topUpHref?: string;
}

export function MethodPicker({ methods, value, onChange, disabledReason = {}, hints = {}, walletBalance, topUpHref }: MethodPickerProps) {
  return (
    <div role="radiogroup" aria-label={t('Payment method')} className="grid gap-2 sm:grid-cols-2">
      {methods.map((method) => {
        const label = LABELS[method];
        const reason = disabledReason[method];
        const selected = value === method;
        const hint = reason
          ?? (method === 'wallet' && walletBalance ? t('Balance {0}', walletBalance) : hints[method] ?? label.hint);
        return (
          <div key={method} className="relative">
            <button
              type="button"
              role="radio"
              aria-checked={selected}
              aria-disabled={Boolean(reason) || undefined}
              disabled={Boolean(reason)}
              onClick={() => onChange(method)}
              className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cholo-700 disabled:cursor-not-allowed ${selected ? 'border-cholo-700 bg-cholo-50' : 'border-border bg-surface hover:bg-surface-alt'} ${reason ? 'opacity-60' : ''}`}
            >
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-black ${label.tone}`} aria-hidden="true">{label.mark}</span>
              <span className={`min-w-0 flex-1 ${reason && method === 'wallet' && topUpHref ? 'pr-16' : ''}`}>
                <span className="block text-sm font-semibold text-ink-900">{label.name}</span>
                <span className={`block truncate text-xs ${reason ? 'text-danger-600' : 'text-ink-500'}`}>{hint}</span>
              </span>
              {selected && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-cholo-700" aria-hidden="true" />}
            </button>
            {reason && method === 'wallet' && topUpHref && (
              <Link
                to={topUpHref}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg border border-cholo-700 px-2.5 py-1 text-xs font-semibold text-cholo-700 hover:bg-cholo-50"
              >
                {t('Top up')}
              </Link>
            )}
          </div>
        );
      })}
    </div>
  );
}
