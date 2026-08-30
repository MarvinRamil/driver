import { useAuth } from '@/features/auth';
import { useCallback, useEffect, useState } from 'react';
import { payMongoOnboardingService } from '../services/payMongoOnboardingService';
import type { WithdrawableBalance } from '../types';

interface UseWithdrawableBalanceReturn {
  data: WithdrawableBalance | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * How much the driver can actually withdraw, which is not the same as their balance once their
 * money sits in their own PayMongo wallet — the transfer fee comes out of it.
 *
 * Deliberately server-derived rather than computed here: the fee has been observed to vary, so a
 * constant in the app would drift out of step with what PayMongo charges and start producing
 * rejections the driver cannot explain.
 */
export function useWithdrawableBalance(): UseWithdrawableBalanceReturn {
  const { user } = useAuth();
  const [data, setData] = useState<WithdrawableBalance | null>(null);
  const [isLoading, setIsLoading] = useState(true);
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
      setData(await payMongoOnboardingService.getWithdrawable(user.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load withdrawable balance');
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, isLoading, error, refresh };
}
