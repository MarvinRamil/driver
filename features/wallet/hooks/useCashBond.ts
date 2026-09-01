import { useAuth } from '@/features/auth';
import { useCallback, useEffect, useState } from 'react';
import { payMongoOnboardingService } from '../services/payMongoOnboardingService';
import type { CashBondStatus } from '../types';

interface RefreshOptions {
  /**
   * Refetch without showing the loading skeleton, and keep the last good status if the call
   * fails. For refreshes the driver did not ask for — on screen focus, say — where flashing a
   * skeleton over a card that is already correct reads as a glitch, and where dropping the card
   * on a transient network error would look exactly like the bug this refetch exists to work
   * around.
   */
  silent?: boolean;
}

interface UseCashBondReturn {
  data: CashBondStatus | null;
  isLoading: boolean;
  isPaying: boolean;
  error: string | null;
  refresh: (options?: RefreshOptions) => Promise<void>;
  pay: () => Promise<CashBondStatus>;
}

/**
 * Where the driver stands on their cashbond, and the action to pay it.
 *
 * `pay()` writes the response straight into state rather than triggering a refetch — same
 * principle as `useWallet`'s `applyBalances`: the POST already returns the settled status, so a
 * second round trip would only add a delay before the screen agrees with itself.
 */
export function useCashBond(): UseCashBondReturn {
  const { user } = useAuth();
  // Destructured rather than depending on `user` itself: the callbacks below are used as
  // useFocusEffect deps by the profile screen, so an auth context that hands back a new object
  // each render would turn "refetch on focus" into a refetch loop.
  const userId = user?.id;
  const role = user?.role;
  const [data, setData] = useState<CashBondStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPaying, setIsPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async ({ silent = false }: RefreshOptions = {}) => {
    if (!userId || role !== 'Driver') {
      setData(null);
      setIsLoading(false);
      return;
    }

    if (!silent) setIsLoading(true);
    setError(null);
    try {
      setData(await payMongoOnboardingService.getCashBondStatus(userId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load your cashbond status');
      // A silent refresh keeps whatever was already on screen: a failed background poll should
      // not blank out a card the driver is looking at.
      if (!silent) setData(null);
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [userId, role]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const pay = useCallback(async () => {
    if (!userId) throw new Error('Not signed in');

    setIsPaying(true);
    setError(null);
    try {
      const result = await payMongoOnboardingService.payCashBond(userId);
      setData(result);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not pay your cashbond';
      setError(message);
      throw new Error(message);
    } finally {
      setIsPaying(false);
    }
  }, [userId]);

  return { data, isLoading, isPaying, error, refresh, pay };
}
