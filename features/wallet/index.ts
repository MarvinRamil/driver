/**
 * Wallet feature public API
 */

// Export hooks
export { useWallet } from './hooks/useWallet';
export { useWalletTransactions } from './hooks/useWalletTransactions';
export { useTopUp } from './hooks/useTopUp';
export { useCashEligibility } from './hooks/useCashEligibility';
export { useTopUpHistory } from './hooks/useTopUpHistory';
export { useWalletTopUpEvents } from './hooks/useWalletTopUpEvents';

// Export services
export { walletService } from './services/walletService';

// Export types
export type {
  DriverWallet,
  DriverEarnings,
  DriverTopUp,
  CashJobEligibility,
  WalletTransaction,
  WalletBucket,
  WalletTransactionType,
} from './types';

