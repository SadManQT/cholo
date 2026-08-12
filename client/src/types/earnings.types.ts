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
  accountType: PayoutAccountType;
  accountNoMasked: string;
}

export interface WithdrawalQueueRow extends Withdrawal {
  driverName: string;
  driverPhone: string;
  accountName: string;
  bankName: string | null;
}
