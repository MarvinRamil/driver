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
  | 'CashDeficitAdjustment'
  | 'EarningReversal'
  | 'AccountFee';
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

/**
 * Where a driver is in PayMongo wallet setup.
 *
 * `Declined` is terminal: PayMongo's risk review cannot be appealed and the account cannot be
 * reused, so the UI must route to support rather than offering a retry.
 */
export type PayMongoOnboardingStatus =
  | 'None'
  | 'Pending'
  | 'Verifying'
  | 'Verified'
  | 'Activated'
  | 'Declined';

export interface PayMongoOnboarding {
  status: PayMongoOnboardingStatus;
  accountId: string | null;
  /**
   * The address the wallet was opened under. Not always the driver's plain email — if theirs was
   * already registered with PayMongo it becomes a plus-tagged variant, which still reaches the
   * same inbox. Frozen once the wallet is active.
   */
  accountEmail: string | null;
  walletAccountNumber: string | null;
  /**
   * Hosted identity-verification link, present only on the response that issues a session.
   * Not stored or replayed: sessions expire in ~72 hours and a stale link is indistinguishable
   * from a broken one to the driver.
   */
  verificationUrl: string | null;
  verificationExpiresAt: Date | null;
  /** True once the wallet exists AND is addressable, so earnings can actually be paid into it. */
  walletReady: boolean;
}

/**
 * Details PayMongo requires before it will activate a wallet.
 *
 * Country is fixed server-side. `addressState` is an ISO 3166-2 code such as "PH-ILN", not a
 * province name.
 */
export interface PayMongoOnboardingDetailsInput {
  nationality: string;
  natureOfWork: string;
  sourceOfFunds: string;
  /**
   * Optional. Proven against live activation: TIN is not in the required set, despite PayMongo's
   * activation guide listing it as a prerequisite. Requiring it would gate out every rider who
   * does not have one.
   */
  tin?: string;
  placeOfBirthCity: string;
  addressLine1: string;
  addressCity: string;
  addressState: string;
  addressPostalCode: string;
  middleName?: string;
  sourceOfFundsOther?: string;
}

/**
 * What a driver can withdraw, and why it differs from their balance.
 *
 * Once earnings sit in the driver's own PayMongo wallet the transfer fee comes out of that same
 * wallet, so `withdrawable` is always less than `balance`. On the original path the platform
 * absorbs the fee and the two are equal.
 */
export interface WithdrawableBalance {
  balance: number;
  withdrawable: number;
  /** Estimated. The amount actually charged is read back from the transfer. */
  fee: number;
  feePaidByDriver: boolean;
}
