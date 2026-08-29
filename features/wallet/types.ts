/**
 * Wallet feature-specific types
 */

/**
 * Wallet transaction type
 */
export type WalletTransactionType =
  | 'Earning'
  | 'Withdrawal'
  | 'Payout'
  | 'Refund'
  | 'TopUp'
  | 'CashSettlementDebit'
  | 'WalletTransferIn'
  | 'WalletTransferOut'
  | 'CashDeficitAdjustment';
export type WalletBucket = 'Personal' | 'TopUp';

/**
 * Wallet transaction interface
 */
export interface WalletTransaction {
  /** Transaction ID */
  id: string;
  /** Transaction type */
  type: WalletTransactionType;
  /** Wallet bucket affected */
  bucket?: WalletBucket;
  /** Amount */
  amount: number;
  /** Description */
  description: string;
  /** Transaction date */
  date: Date;
  /** Booking ID if related to a booking */
  bookingId: string | null;
  /** Status */
  status: string;
}

/**
 * Driver wallet interface
 */
export interface DriverWallet {
  /** Wallet ID */
  id: string;
  /** Driver ID */
  driverId: string;
  /** Personal wallet balance (withdrawable) */
  personalBalance: number;
  /** Top-up wallet balance for cash deliveries */
  topUpBalance: number;
  /** Pending payout amount */
  pendingPayout: number;
  /** Whether driver can still accept cash jobs */
  canAcceptCashJobs: boolean;
  /** Last updated */
  lastUpdatedAt: Date;
}

/**
 * Driver earnings interface
 */
export interface DriverEarnings {
  /** Total earnings */
  total: number;
  /** Earnings by period */
  byPeriod: {
    day: number;
    week: number;
    month: number;
  };
  /** Number of completed bookings */
  completedBookings: number;
}

export interface DriverTopUp {
  id: string;
  driverId: string;
  walletId: string;
  amount: number;
  status: 'Pending' | 'Paid' | 'Failed' | 'Expired' | 'Cancelled';
  externalId: string;
  idempotencyKey?: string | null;
  xenditInvoiceId?: string | null;
  xenditInvoiceUrl?: string | null;
  expiresAt?: Date | null;
  paidAt?: Date | null;
  creditedAt?: Date | null;
  createdAt: Date;
}

export interface CashJobEligibility {
  canAcceptCashJobs: boolean;
  currentTopUpBalance: number;
  blockThreshold: number;
  allowedNegativeLimit: number;
}

/** How the driver nominated where the money goes. */
export type WithdrawalDestinationType = 'BankAccount' | 'QrPh';

export interface WithdrawalRequest {
  id: string;
  driverId: string;
  walletId: string;
  amount: number;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Failed';
  bankAccountNumber: string;
  bankName: string;
  accountHolderName: string;
  destinationType?: WithdrawalDestinationType;
  rejectionReason?: string | null;
  xenditDisbursementId?: string | null;
  requestedAt: Date;
  processedAt?: Date | null;
}

/**
 * Everything needed to raise one withdrawal. Exactly one destination applies:
 * a saved method, a picked bank/e-wallet, or a scanned QR Ph code.
 */
export interface WithdrawalRequestInput {
  amount: number;
  /** Use a previously saved bank account; the other bank fields are then ignored. */
  savedWithdrawalMethodId?: string | null;
  bankAccountNumber?: string;
  bankName?: string;
  accountHolderName?: string;
  /** Catalog code from GET /api/payments/banks — what actually addresses the transfer. */
  bankCode?: string;
  destinationType?: WithdrawalDestinationType;
  /** Raw scanned QR Ph payload; required when destinationType is 'QrPh'. */
  qrString?: string;
  /** Makes a retry after a timeout safe — the provider replays rather than paying twice. */
  idempotencyKey?: string | null;
}

/**
 * Saved Withdrawal Method types
 */
export interface SavedWithdrawalMethod {
  id: string;
  driverId: string;
  bankName: string;
  bankCode: string;
  maskedAccountNumber: string; // Last 4 digits only (e.g., "****1234")
  accountHolderName: string;
  isDefault: boolean;
  isActive: boolean;
  lastUsedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSavedWithdrawalMethodRequest {
  bankName: string;
  bankCode: string;
  accountNumber: string;
  accountHolderName: string;
  isDefault?: boolean;
}

export interface UpdateSavedWithdrawalMethodRequest {
  bankName?: string;
  bankCode?: string;
  accountNumber?: string;
  accountHolderName?: string;
  isDefault?: boolean;
}