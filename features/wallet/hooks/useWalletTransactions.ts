import { useAuth } from '@/features/auth';
import { useCallback, useEffect, useRef, useState } from 'react';
import { walletService } from '../services/walletService';
import type { WalletTransaction, WalletTransactionType } from '../types';

/**
 * Options for a transactions refresh
 */
interface RefreshOptions {
  /** Skip the loading flag, so a background refresh doesn't flip the list into skeletons */
  silent?: boolean;
}

/**
 * Return type for useWalletTransactions hook
 */
interface UseWalletTransactionsReturn {
  /** Array of transactions */
  transactions: WalletTransaction[];
  /** Loading state */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
  /** Function to refresh transactions */
  refresh: (options?: RefreshOptions) => Promise<void>;
}

/**
 * Custom hook for fetching wallet transactions
 * Only works for Driver/Operator (solo drivers)
 * @param startDate - Optional start date filter
 * @param endDate - Optional end date filter
 * @param type - Optional transaction type filter
 * @returns Object containing transactions, loading state, error, and refresh function
 */
export function useWalletTransactions(
  startDate?: Date,
  endDate?: Date,
  type?: WalletTransactionType
): UseWalletTransactionsReturn {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  /** Whether a list has ever landed, so a failed refresh doesn't wipe the visible ledger */
  const hasLoadedOnceRef = useRef<boolean>(false);

  /**
   * Check if user can access wallet
   */
  const canAccessWallet = user?.role === 'Driver';

  /**
   * Fetch transactions from API
   */
  const fetchTransactions = useCallback(
    async (options?: RefreshOptions) => {
      if (!user || !canAccessWallet) {
        setIsLoading(false);
        hasLoadedOnceRef.current = false;
        setTransactions([]);
        return;
      }

      if (!options?.silent) {
        setIsLoading(true);
      }
      setError(null);

      try {
        const data = await walletService.getTransactions(user.id, startDate, endDate, type);
        hasLoadedOnceRef.current = true;
        setTransactions(data);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch transactions';
        setError(errorMessage);
        // Only clear on the initial load. One flaky background refresh - say the one fired after a
        // transfer - must not empty a ledger the driver is already looking at.
        if (!hasLoadedOnceRef.current) {
          setTransactions([]);
        }
      } finally {
        if (!options?.silent) {
          setIsLoading(false);
        }
      }
    },
    [user, canAccessWallet, startDate, endDate, type]
  );

  /**
   * Refresh transactions
   */
  const refresh = useCallback(
    async (options?: RefreshOptions) => {
      await fetchTransactions(options);
    },
    [fetchTransactions]
  );

  // Fetch transactions on mount and when filters change
  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  return {
    transactions,
    isLoading,
    error,
    refresh,
  };
}

