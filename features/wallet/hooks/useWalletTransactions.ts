import { useAuth } from '@/features/auth';
import { useCallback, useEffect, useState } from 'react';
import { walletService } from '../services/walletService';
import type { WalletTransaction, WalletTransactionType } from '../types';

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
  refresh: () => Promise<void>;
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

  /**
   * Check if user can access wallet
   */
  const canAccessWallet = user?.role === 'Driver';

  /**
   * Fetch transactions from API
   */
  const fetchTransactions = useCallback(async () => {
    if (!user || !canAccessWallet) {
      setIsLoading(false);
      setTransactions([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = await walletService.getTransactions(user.id, startDate, endDate, type);
      setTransactions(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch transactions';
      setError(errorMessage);
      setTransactions([]);
    } finally {
      setIsLoading(false);
    }
  }, [user, canAccessWallet, startDate, endDate, type]);

  /**
   * Refresh transactions
   */
  const refresh = useCallback(async () => {
    await fetchTransactions();
  }, [fetchTransactions]);

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

