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
 * What a driver sees for each transaction type.
 *
 * Derived from the type rather than shown from `description`, because the stored description is
 * internal: it carries booking GUIDs ("Earning from booking 3f2a91c…"), provider names and period
 * keys. Mapping here also fixes rows that were already written, which changing the backend copy
 * would not.
 *
 * Colocated with WalletTransactionType on purpose — adding a type without a label is then visible
 * in the same file rather than silently falling through to the default.
 */
const TRANSACTION_LABELS: Record<WalletTransactionType, string> = {
  Earning: 'Earnings',
  EarningReversal: 'Earnings reversed',
  TopUp: 'Top-up',
  Withdrawal: 'Withdrawal',
  Payout: 'Payout',
  Refund: 'Refund',
  CashSettlementDebit: 'Deduction',
  CashDeficitAdjustment: 'Adjustment',
  WalletTransferIn: 'Transferred in',
  WalletTransferOut: 'Transferred out',
  AccountFee: 'Account fee',
};

export function transactionLabel(type: WalletTransactionType | string): string {
  return TRANSACTION_LABELS[type as WalletTransactionType] ?? 'Transaction';
}

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
  /**
   * Why the last identity check failed, in the driver's terms — e.g. "Image quality check failed:
   * blur detection". Usually one retry away from passing, so it must be shown rather than leaving
   * them on a screen that says nothing.
   */
  verificationFailureReason: string | null;
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
  /**
   * Required by PayMongo activation. Falls back to the driver's profile when omitted, but the
   * profile is not always populated — and the rejection lands after the account already exists.
   */
  mobileNumber?: string;
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

/**
 * Where a driver stands on their cashbond: a fixed, vehicle-type-priced deposit paid once before
 * they can be offered bookings — not accrued, not deducted from. `amountDue` is null when no
 * cashbond amount has been configured yet for the driver's vehicle type.
 */
export interface CashBondStatus {
  driverId: string;
  vehicleType: string | null;
  amountDue: number | null;
  cashBondBalance: number;
  paid: boolean;
}

/**
 * A QR the driver scans to add money to their own BeeWallet wallet.
 *
 * Credits land in real time over InstaPay rather than waiting on payment settlement — which is why
 * this replaces the checkout, whose QR showed the platform as the merchant and only reached a
 * wallet on the weekly settlement run.
 */
export interface BeeWalletTopUpQr {
  /** Raw EMV payload, for copy-to-clipboard and support comparison. */
  qrString: string;
  /** PNG data URI, rendered server-side so the app needs no native QR dependency. */
  qrImage: string;
  /** Whose wallet it credits — the driver's own name, not the platform's. */
  merchantName: string | null;
  accountNumber: string | null;
  /**
   * Null for a static QR: it belongs to the driver, not to one payment.
   *
   * Non-null means the amount was fixed into the code, which is what makes it expire — PayMongo
   * defaults to 30 minutes. The two always travel together.
   */
  expiresAt: Date | null;
  /**
   * The amount fixed into the code, echoed back by the backend. Null for a static QR, where the
   * payer types whatever they like.
   */
  amount: number | null;
}
