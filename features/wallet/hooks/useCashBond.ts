import { useAuth } from '@/features/auth';
import { useCallback, useEffect, useState } from 'react';
import { payMongoOnboardingService } from '../services/payMongoOnboardingService';
import type { CashBondStatus } from '../types';

interface UseCashBondReturn {
  data: CashBondStatus | null;
  isLoading: boolean;
  isPaying: boolean;
  error: string | null;
  refresh: () => Promise<void>;
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
  const [data, setData] = useState<CashBondStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPaying, setIsPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user?.id || user.role !== 'Driver') {
      setData(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      setData(await payMongoOnboardingService.getCashBondStatus(user.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load your cashbond status');
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const pay = useCallback(async () => {
    if (!user?.id) throw new Error('Not signed in');

    setIsPaying(true);
    setError(null);
    try {
      const result = await payMongoOnboardingService.payCashBond(user.id);
      setData(result);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not pay your cashbond';
      setError(message);
      throw new Error(message);
    } finally {
      setIsPaying(false);
    }
  }, [user]);

  return { data, isLoading, isPaying, error, refresh, pay };
}
