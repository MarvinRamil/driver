import { useCallback, useEffect, useState } from 'react';
import { earningsService } from '../services/earningsService';
import type { DriverEarningsHistory } from '../types';

export function useEarningsHistory(
  driverId: string,
  options?: { startDate?: Date; endDate?: Date; limit?: number }
) {
  const [history, setHistory] = useState<DriverEarningsHistory | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    if (!driverId) return;

    setIsLoading(true);
    setError(null);

    try {
      const data = await earningsService.getEarningsHistory(
        driverId,
        options?.startDate,
        options?.endDate,
        options?.limit ?? 50
      );
      setHistory(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load earnings history');
    } finally {
      setIsLoading(false);
    }
  }, [driverId, options?.startDate, options?.endDate, options?.limit]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  return { history, isLoading, error, refresh: fetchHistory };
}
