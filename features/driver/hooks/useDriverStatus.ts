import { useCallback, useEffect, useState } from 'react';
import { driverStatusService } from '../services/driverStatusService';
import type { DriverStatus } from '../services/driverStatusService';

interface UseDriverStatusReturn {
  /** Current online status */
  isOnline: boolean;
  /** Loading state */
  isLoading: boolean;
  /** Error message */
  error: string | null;
  /** Update online status */
  updateStatus: (isOnline: boolean) => Promise<void>;
  /** Refresh status from server */
  refresh: () => Promise<void>;
  /** Driver status data */
  status: DriverStatus | null;
}

/**
 * Hook for managing driver online status
 */
export function useDriverStatus(): UseDriverStatusReturn {
  const [isOnline, setIsOnline] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<DriverStatus | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const driverStatus = await driverStatusService.getMyStatus();
      setStatus(driverStatus);
      setIsOnline(driverStatus.isOnline ?? false);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch driver status';
      setError(errorMessage);
      console.error('Error fetching driver status:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateStatus = useCallback(async (newStatus: boolean) => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await driverStatusService.updateStatus(newStatus);
      setIsOnline(response.isOnline);
      // Update local status if available
      if (status) {
        setStatus({ ...status, isOnline: response.isOnline });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update driver status';
      setError(errorMessage);
      // Revert on error
      setIsOnline(!newStatus);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [status]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  return {
    isOnline,
    isLoading,
    error,
    updateStatus,
    refresh: fetchStatus,
    status,
  };
}

