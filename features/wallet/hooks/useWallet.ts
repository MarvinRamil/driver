import { useAuth } from '@/features/auth';
import { useCallback, useEffect, useState } from 'react';
import { walletService } from '../services/walletService';
import type { DriverWallet } from '../types';

/**
 * Return type for useWallet hook
 */
interface UseWalletReturn {
  /** Wallet data */
  wallet: DriverWallet | null;
  /** Loading state */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
  /** Function to refresh wallet */
  refresh: () => Promise<void>;
}

/**
 * Custom hook for fetching driver wallet
 * Only works for Driver/Operator (solo drivers)
 * @returns Object containing wallet data, loading state, error, and refresh function
 */
export function useWallet(): UseWalletReturn {
  const { user } = useAuth();
  const [wallet, setWallet] = useState<DriverWallet | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Check if user can access wallet
   * Only Driver/Operator (solo drivers) can access wallet
   */
  const canAccessWallet = user?.isSoloDriver || user?.role === 'Owner' || user?.role === 'Admin';

  /**
   * Fetch wallet from API
   */
  const fetchWallet = useCallback(async () => {
    if (!user || !canAccessWallet) {
      setIsLoading(false);
      setWallet(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = await walletService.getWallet(user.id);
      setWallet(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch wallet';
      setError(errorMessage);
      setWallet(null);
    } finally {
      setIsLoading(false);
    }
  }, [user, canAccessWallet]);

  /**
   * Refresh wallet data
   */
  const refresh = useCallback(async () => {
    await fetchWallet();
  }, [fetchWallet]);

  // Fetch wallet on mount and when user changes
  useEffect(() => {
    fetchWallet();
  }, [fetchWallet]);

  return {
    wallet,
    isLoading,
    error,
    refresh,
  };
}

