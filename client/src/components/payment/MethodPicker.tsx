import type { GatewayMethod } from '../../api/payments.api';

export type PayMethod = 'wallet' | GatewayMethod;

const LABELS: Record<PayMethod, { name: string; hint: string; mark: string; tone: string }> = {
  wallet: { name: 'Cholo wallet', hint: 'Pay instantly from your balance', mark: '৳', tone: 'bg-cholo-700 text-white' },
  bkash: { name: 'bKash', hint: 'Mobile wallet', mark: 'b', tone: 'bg-[#E2136E] text-white' },
  nagad: { name: 'Nagad', hint: 'Mobile wallet', mark: 'N', tone: 'bg-[#F6921E] text-white' },
  card: { name: 'Card', hint: 'Visa, Mastercard, Amex', mark: '▭', tone: 'bg-ink-900 text-white' },
};

interface MethodPickerProps {
  methods: PayMethod[];
  value: PayMethod;
  onChange: (method: PayMethod) => void;
  disabledReason?: Partial<Record<PayMethod, string>>;
  walletBalance?: string;
}

export function MethodPicker({ methods, value, onChange, disabledReason = {}, walletBalance }: MethodPickerProps) {
  return (
    <div role="radiogroup" aria-label="Payment method" className="grid gap-2 sm:grid-cols-2">
      {methods.map((method) => {
        const label = LABELS[method];
        const disabled = Boolean(disabledReason[method]);
        const selected = value === method;
        return (
          <button
            key={method}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(method)}
            className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cholo-700 disabled:cursor-not-allowed disabled:opacity-50 ${selected ? 'border-cholo-700 bg-cholo-50' : 'border-border bg-surface hover:bg-surface-alt'}`}
          >
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-black ${label.tone}`} aria-hidden="true">{label.mark}</span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-ink-900">{label.name}</span>
              <span className="block truncate text-xs text-ink-500">
                {disabledReason[method] ?? (method === 'wallet' && walletBalance ? `Balance ${walletBalance}` : label.hint)}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
