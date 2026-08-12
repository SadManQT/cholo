import { Card } from '../ui';
import type { WalletTransaction, WalletTxnType } from '../../types/wallet.types';
import { formatBDT, formatDateTime } from '../../utils/format';

// doc 04's own business-meaning list for wallet_txn_type — plain English
// for a ledger row, not the enum value.
const TXN_LABELS: Record<WalletTxnType, string> = {
  topup: 'Wallet top-up',
  trip_payment: 'Trip payment',
  trip_earning: 'Trip earning',
  commission: 'Platform commission',
  withdrawal: 'Withdrawal',
  refund: 'Refund',
  promo_credit: 'Promo credit',
  referral_bonus: 'Referral bonus',
  adjustment: 'Adjustment',
};

export function WalletTxnRow({ txn }: { txn: WalletTransaction }) {
  const isCredit = txn.direction === 'credit';

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-ink-900">{TXN_LABELS[txn.txnType]}</p>
          <p className="mt-1 text-sm text-ink-500">{formatDateTime(txn.createdAt)}</p>
          {txn.note && <p className="mt-1 truncate text-sm text-ink-500">{txn.note}</p>}
        </div>
        <div className="shrink-0 text-right">
          <p className={`font-bold tabular-nums ${isCredit ? 'text-cholo-700' : 'text-ink-900'}`}>
            {isCredit ? '+' : '−'}{formatBDT(txn.amount)}
          </p>
          <p className="mt-1 text-xs text-ink-500">Balance {formatBDT(txn.balanceAfter)}</p>
        </div>
      </div>
    </Card>
  );
}
