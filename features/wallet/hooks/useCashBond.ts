import { useAuth } from '@/features/auth';
import { useCallback, useEffect, useState } from 'react';
import { payMongoOnboardingService } from '../services/payMongoOnboardingService';
import type { CashBondQr, CashBondStatus } from '../types';

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
  isCreatingQr: boolean;
  error: string | null;
  refresh: (options?: RefreshOptions) => Promise<void>;
  /**
   * Issues the QR that pays the cashbond into the platform wallet. Replaces the old `pay()`, which
   * swept the driver's own BeeWallet — that could not work, since the cashbond falls due before
   * BeeWallet onboarding exists.
   */
  createQr: () => Promise<CashBondQr>;
}

/**
 * Where the driver stands on their cashbond, and the way to pay it.
 *
 * `createQr()` does not write the status into state, unlike the `pay()` it replaces: issuing a QR
 * is not a payment. The cashbond only becomes paid when the driver actually scans it and the
 * platform account's `qr.paid` webhook settles it, so the screen learns about it through a refresh
 * — which is what the focus refetch and pull-to-refresh exist for.
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
  const [isCreatingQr, setIsCreatingQr] = useState(false);
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

  const createQr = useCallback(async () => {
    if (!userId) throw new Error('Not signed in');

    setIsCreatingQr(true);
    setError(null);
    try {
      return await payMongoOnboardingService.createCashBondQr(userId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not create your cashbond QR';
      setError(message);
      throw new Error(message);
    } finally {
      setIsCreatingQr(false);
    }
  }, [userId]);

  return { data, isLoading, isCreatingQr, error, refresh, createQr };
}
