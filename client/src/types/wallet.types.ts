export interface Wallet {
  balance: string;
  currency: string;
  status: 'active' | 'frozen';
}

export type WalletTxnType =
  | 'topup' | 'trip_payment' | 'trip_earning' | 'commission' | 'withdrawal'
  | 'refund' | 'promo_credit' | 'referral_bonus' | 'adjustment';

export interface WalletTransaction {
  id: string;
  txnType: WalletTxnType;
  direction: 'credit' | 'debit';
  amount: string;
  balanceAfter: string;
  referenceType: 'trip' | 'payment' | 'withdrawal' | 'promo' | 'referral' | 'manual';
  referenceId: string | null;
  note: string | null;
  createdAt: string;
}
