import { useCallback, useEffect, useState } from 'react';
import { earningsService } from '../services/earningsService';
import type { DriverEarnings, EarningsPeriod } from '../types';

interface UseEarningsReturn {
  earnings: DriverEarnings | null;
  isLoading: boolean;
  error: string | null;
  period: EarningsPeriod;
  setPeriod: (period: EarningsPeriod) => void;
  refresh: () => Promise<void>;
}

export function useEarnings(driverId: string): UseEarningsReturn {
  const [earnings, setEarnings] = useState<DriverEarnings | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<EarningsPeriod>('Week');

  const fetchEarnings = useCallback(async () => {
    if (!driverId) return;

    setIsLoading(true);
    setError(null);

    try {
      const now = new Date();
      let startDate: Date | undefined;
      let endDate: Date | undefined = now;

      switch (period) {
        case 'Today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'Week':
          startDate = new Date(now);
          startDate.setDate(now.getDate() - 7);
          break;
        case 'Month':
          startDate = new Date(now);
          startDate.setMonth(now.getMonth() - 1);
          break;
      }

      const data = await earningsService.getEarnings(driverId, startDate, endDate);
      setEarnings(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch earnings';
      setError(errorMessage);
      console.error('Error fetching earnings:', err);
    } finally {
      setIsLoading(false);
    }
  }, [driverId, period]);

  useEffect(() => {
    fetchEarnings();
  }, [fetchEarnings]);

  return {
    earnings,
    isLoading,
    error,
    period,
    setPeriod,
    refresh: fetchEarnings,
  };
}

