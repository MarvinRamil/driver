import { useAuth } from '@/features/auth';
import { useCallback, useEffect, useState } from 'react';
import { walletService } from '../services/walletService';
import type { CashJobEligibility } from '../types';

interface UseCashEligibilityReturn {
  data: CashJobEligibility | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useCashEligibility(): UseCashEligibilityReturn {
  const { user } = useAuth();
  const [data, setData] = useState<CashJobEligibility | null>(null);
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
      const result = await walletService.getCashJobEligibility(user.id);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load cash eligibility');
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
