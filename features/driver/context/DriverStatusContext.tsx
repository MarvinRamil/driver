import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { driverStatusService } from '../services/driverStatusService';
import { locationTrackingService } from '../services/locationTrackingService';
import type { DriverStatus } from '../services/driverStatusService';
import { useAuth } from '@/features/auth';

interface DriverStatusContextValue {
  /** Current online status */
  isOnline: boolean;
  /** Loading state (for updates) */
  isLoading: boolean;
  /** Initial loading state (for first fetch) */
  isInitialLoading: boolean;
  /** Error message */
  error: string | null;
  /** Update online status */
  updateStatus: (isOnline: boolean) => Promise<void>;
  /** Refresh status from server */
  refresh: () => Promise<void>;
  /** Driver status data */
  status: DriverStatus | null;
  /** Toggle online status */
  toggleOnlineStatus: () => Promise<void>;
}

const DriverStatusContext = createContext<DriverStatusContextValue | undefined>(undefined);

interface DriverStatusProviderProps {
  children: React.ReactNode;
}

/**
 * Provider for driver status context
 * Manages global driver online status state
 */
export function DriverStatusProvider({ children }: DriverStatusProviderProps) {
  const { user } = useAuth();
  const [isOnline, setIsOnline] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true); // Track initial fetch
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<DriverStatus | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const driverStatus = await driverStatusService.getMyStatus();
      setStatus(driverStatus);
      setIsOnline(driverStatus.isOnline ?? false);

      // If driver is already online on app launch, ensure tracking is started
      if (driverStatus.isOnline) {
        if (user?.id) {
          locationTrackingService.setDriverId(user.id);
          const hasPermission = await locationTrackingService.hasPermissions();
          if (hasPermission) {
            // Don't await this so we don't block the UI rendering
            locationTrackingService.startTracking(5000, user.id).catch(err =>
              console.warn('[DriverStatusContext] Failed to resume tracking on startup:', err)
            );
          }
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch driver status';
      setError(errorMessage);
      console.error('Error fetching driver status:', err);
      // On error, default to offline for safety
      setIsOnline(false);
    } finally {
      setIsLoading(false);
      setIsInitialLoading(false); // Mark initial fetch as complete
    }
  }, [user]);

  const updateStatus = useCallback(async (newStatus: boolean) => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await driverStatusService.updateStatus(newStatus);
      setIsOnline(response.isOnline);

      // Start/stop location tracking based on online status
      if (response.isOnline) {
        // Driver went online - start location tracking
        try {
          // Set driver ID if available
          if (user?.id) {
            locationTrackingService.setDriverId(user.id);
          }

          const hasPermission = await locationTrackingService.hasPermissions();
          if (hasPermission) {
            await locationTrackingService.startTracking(5000, user?.id); // Update every 5 seconds
          } else {
            // Request permissions if not granted
            const granted = await locationTrackingService.requestPermissions();
            if (granted) {
              await locationTrackingService.startTracking(5000, user?.id);
            }
          }
        } catch (locationError) {
          // Log but don't fail the status update if location tracking fails
          console.warn('Failed to start location tracking:', locationError);
        }
      } else {
        // Driver went offline - stop location tracking
        try {
          locationTrackingService.stopTracking();
        } catch (locationError) {
          // Log but don't fail the status update if location tracking fails
          console.warn('Failed to stop location tracking:', locationError);
        }
      }

      // Update local status if available
      if (status) {
        setStatus({ ...status, isOnline: response.isOnline });
      } else {
        // If status wasn't loaded, fetch it
        await fetchStatus();
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
  }, [status, fetchStatus]);

  const toggleOnlineStatus = useCallback(async () => {
    await updateStatus(!isOnline);
  }, [isOnline, updateStatus]);

  useEffect(() => {
    // Only fetch status if user is authenticated
    if (user) {
      fetchStatus();
    } else {
      // If no user, mark as not loading and offline
      setIsInitialLoading(false);
      setIsOnline(false);
      setIsLoading(false);
    }
  }, [fetchStatus, user]);

  const value: DriverStatusContextValue = {
    isOnline,
    isLoading,
    isInitialLoading,
    error,
    updateStatus,
    refresh: fetchStatus,
    status,
    toggleOnlineStatus,
  };

  return <DriverStatusContext.Provider value={value}>{children}</DriverStatusContext.Provider>;
}

/**
 * Hook to access driver status context
 */
export function useDriverStatusContext(): DriverStatusContextValue {
  const context = useContext(DriverStatusContext);
  if (context === undefined) {
    throw new Error('useDriverStatusContext must be used within a DriverStatusProvider');
  }
  return context;
}

