export interface DailyEarning {
  earningDate: string;
  tripsCount: number;
  grossTotal: string;
  commissionTotal: string;
  netTotal: string;
}

export interface EarningTripRow {
  id: string;
  tripCode: string;
  grossFare: string;
  commissionPct: string;
  commissionAmount: string;
  netEarning: string;
  settlementStatus: 'pending' | 'settled' | 'withheld';
  earnedAt: string;
  /** How the rider paid: cash goes to the driver's hand, anything else through the app into the wallet. */
  paymentMethod?: 'cash' | 'wallet' | 'bkash' | 'nagad' | 'card';
}

export type PayoutAccountType = 'bkash' | 'nagad' | 'bank';

export interface PayoutAccount {
  id: string;
  accountType: PayoutAccountType;
  accountName: string;
  accountNoMasked: string;
  bankName: string | null;
  isDefault: boolean;
  isVerified: boolean;
  createdAt: string;
}

export type WithdrawalStatus = 'requested' | 'approved' | 'processing' | 'paid' | 'rejected' | 'failed';

export interface Withdrawal {
  id: string;
  publicId: string;
  amount: string;
  fee: string;
  status: WithdrawalStatus;
  rejectionReason: string | null;
  requestedAt: string;
  processedAt: string | null;
  /** The bKash/Nagad/bank transaction reference finance recorded when it was paid. */
  payoutReference?: string | null;
  accountType: PayoutAccountType;
  accountNoMasked: string;
}

export interface WithdrawalQueueRow extends Withdrawal {
  driverName: string;
  driverPhone: string;
  accountName: string;
  /** The full payout number, for finance only (null for accounts added before it was kept). */
  accountNo?: string | null;
  bankName: string | null;
}
