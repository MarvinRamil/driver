import { useAuth } from '@/features/auth';
import { useCallback, useEffect, useState } from 'react';
import { walletService } from '../services/walletService';
import type { DriverTopUp } from '../types';

interface UseTopUpHistoryReturn {
  topUps: DriverTopUp[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useTopUpHistory(): UseTopUpHistoryReturn {
  const { user } = useAuth();
  const [topUps, setTopUps] = useState<DriverTopUp[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user?.id || user.role !== 'Driver') {
      setTopUps([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const history = await walletService.getTopUpHistory(user.id);
      setTopUps(history);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load top-up history');
      setTopUps([]);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { topUps, isLoading, error, refresh };
}
