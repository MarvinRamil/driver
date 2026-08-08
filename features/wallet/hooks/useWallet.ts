import { useAuth } from '@/features/auth';
import { useCallback, useEffect, useRef, useState } from 'react';
import { walletService } from '../services/walletService';
import type { DriverWallet } from '../types';

/**
 * Options for a wallet refresh
 */
interface RefreshOptions {
  /** Skip the loading flag, so a background refresh doesn't drive the pull-to-refresh spinner */
  silent?: boolean;
}

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
  refresh: (options?: RefreshOptions) => Promise<void>;
  /** Write a wallet returned by a mutation straight into state, no round trip */
  applyWallet: (wallet: DriverWallet) => void;
  /** Merge new balances (e.g. from a TopUpPaid event payload) into the wallet already on screen */
  applyBalances: (personalBalance: number, topUpBalance: number) => void;
  /** Clear current error (e.g. before a post-action refresh) */
  clearError: () => void;
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
  /** Whether a wallet has ever landed, so a failed refresh doesn't blank a wallet we already show */
  const hasWalletRef = useRef<boolean>(false);

  /**
   * Check if user can access wallet
   * Only Driver/Operator (solo drivers) can access wallet
   */
  const canAccessWallet = user?.role === 'Driver';

  /**
   * Fetch wallet from API
   */
  const fetchWallet = useCallback(
    async (options?: RefreshOptions) => {
      if (!user || !canAccessWallet) {
        setIsLoading(false);
        hasWalletRef.current = false;
        setWallet(null);
        return;
      }

      if (!options?.silent) {
        setIsLoading(true);
      }
      setError(null);

      try {
        const data = await walletService.getWallet(user.id);
        hasWalletRef.current = true;
        setWallet(data);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch wallet';
        setError(errorMessage);
        // Only blank the cards on the initial load. A transient refresh failure - including the
        // background one fired right after a transfer - must not wipe balances we already applied.
        if (!hasWalletRef.current) {
          setWallet(null);
        }
      } finally {
        if (!options?.silent) {
          setIsLoading(false);
        }
      }
    },
    [user, canAccessWallet]
  );

  /**
   * Refresh wallet data
   */
  const refresh = useCallback(
    async (options?: RefreshOptions) => {
      await fetchWallet(options);
    },
    [fetchWallet]
  );

  /**
   * Apply a wallet returned by a mutation (e.g. a transfer) without going back to the network
   */
  const applyWallet = useCallback((updated: DriverWallet) => {
    hasWalletRef.current = true;
    setWallet(updated);
    setError(null);
  }, []);

  /**
   * Merge balances pushed by a real-time event into the wallet already on screen. Uses the
   * functional setter so it never depends on a captured `wallet`, and no-ops before first load.
   */
  const applyBalances = useCallback((personalBalance: number, topUpBalance: number) => {
    setWallet((current) =>
      current ? { ...current, personalBalance, topUpBalance, lastUpdatedAt: new Date() } : current
    );
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Fetch wallet on mount and when user changes
  useEffect(() => {
    fetchWallet();
  }, [fetchWallet]);

  return {
    wallet,
    isLoading,
    error,
    refresh,
    applyWallet,
    applyBalances,
    clearError,
  };
}

