import { useCallback, useEffect, useMemo, useState } from 'react';
import { historyService } from '../services/historyService';
import type { TripHistory, HistoryFilter, HistoryStats } from '../types';
import { useAuth } from '@/features/auth';

interface UseHistoryReturn {
  /** Trip history items */
  trips: TripHistory[];
  /** History statistics */
  stats: HistoryStats;
  /** Loading state */
  isLoading: boolean;
  /** Error message */
  error: string | null;
  /** Current filter */
  filter: HistoryFilter;
  /** Set filter */
  setFilter: (filter: HistoryFilter) => void;
  /** Refresh history */
  refresh: () => Promise<void>;
  /** Filtered trips by current filter */
  filteredTrips: TripHistory[];
}

/**
 * Hook for managing trip history
 */
export function useHistory(initialFilter: HistoryFilter = 'All'): UseHistoryReturn {
  const { user } = useAuth();
  const [trips, setTrips] = useState<TripHistory[]>([]);
  const [stats, setStats] = useState<HistoryStats>({
    totalEarnings: 0,
    totalTrips: 0,
    averageRating: 0,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<HistoryFilter>(initialFilter);

  const fetchHistory = useCallback(async () => {
    if (!user?.id) {
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const [historyData, statsData] = await Promise.all([
        historyService.getTripHistory(user.id),
        historyService.getHistoryStats(user.id, filter),
      ]);
      setTrips(historyData);
      setStats(statsData);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch history';
      setError(errorMessage);
      console.error('Error fetching history:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, filter]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const filteredTrips = useMemo(() => {
    if (filter === 'All') {
      return trips;
    }

    const now = new Date();
    const getFilterStartDate = (filter: HistoryFilter): Date => {
      switch (filter) {
        case 'Today':
          return new Date(now.getFullYear(), now.getMonth(), now.getDate());
        case 'This Week':
          const weekStart = new Date(now);
          weekStart.setDate(now.getDate() - now.getDay());
          weekStart.setHours(0, 0, 0, 0);
          return weekStart;
        case 'Last Month':
          return new Date(now.getFullYear(), now.getMonth() - 1, 1);
        default:
          return new Date(0);
      }
    };

    const startDate = getFilterStartDate(filter);
    return trips.filter((trip) => trip.completedAt >= startDate);
  }, [trips, filter]);

  return {
    trips,
    stats,
    isLoading,
    error,
    filter,
    setFilter,
    refresh: fetchHistory,
    filteredTrips,
  };
}

