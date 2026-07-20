import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { router } from 'expo-router';
import { driverStatusService, FaceCheckRequiredError } from '../services/driverStatusService';
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

  /**
   * Ensure location tracking is started if status is online
   * This is a separate function to allow retries and better error handling
   */
  const ensureLocationTracking = useCallback(async (retryCount: number = 0): Promise<void> => {
    if (!user?.id) {
      // User not available yet, will retry when user becomes available
      return;
    }

    const isCurrentlyTracking = locationTrackingService.getIsTracking();
    if (isCurrentlyTracking) {
      // Already tracking, verify it's still active
      console.log('[DriverStatusContext] Location tracking already active');
      return;
    }

    try {
      locationTrackingService.setDriverId(user.id);
      const hasPermission = await locationTrackingService.hasPermissions();
      if (hasPermission) {
        await locationTrackingService.startTracking(5000, user.id);
        console.log('[DriverStatusContext] Location tracking started successfully');
      } else {
        // Request permissions if not granted
        const granted = await locationTrackingService.requestPermissions();
        if (granted) {
          await locationTrackingService.startTracking(5000, user.id);
          console.log('[DriverStatusContext] Location tracking started after permission grant');
        } else {
          console.warn('[DriverStatusContext] Location permissions not granted');
        }
      }
    } catch (err) {
      console.warn('[DriverStatusContext] Failed to start location tracking:', err);
      // Retry once after a short delay if user is available
      if (retryCount === 0 && user?.id) {
        console.log('[DriverStatusContext] Retrying location tracking start...');
        setTimeout(() => {
          ensureLocationTracking(1).catch(console.error);
        }, 2000);
      }
    }
  }, [user]);

  const fetchStatus = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const driverStatus = await driverStatusService.getMyStatus();
      setStatus(driverStatus);
      setIsOnline(driverStatus.isOnline ?? false);

      // If driver is already online on app launch, ensure tracking is started
      if (driverStatus.isOnline) {
        // Don't await this so we don't block the UI rendering
        ensureLocationTracking().catch(err =>
          console.warn('[DriverStatusContext] Failed to resume tracking on startup:', err)
        );
      } else {
        // If status is offline, ensure tracking is stopped
        const isCurrentlyTracking = locationTrackingService.getIsTracking();
        if (isCurrentlyTracking) {
          try {
            await locationTrackingService.stopTracking();
          } catch (err) {
            console.warn('[DriverStatusContext] Failed to stop tracking:', err);
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
  }, [ensureLocationTracking]);

  const updateStatus = useCallback(async (newStatus: boolean) => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await driverStatusService.updateStatus(newStatus);
      setIsOnline(response.isOnline);

      // Start/stop location tracking based on online status
      if (response.isOnline) {
        // Driver went online - start location tracking
        await ensureLocationTracking();
      } else {
        // Driver went offline - stop location tracking
        try {
          await locationTrackingService.stopTracking();
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
      // Backend requires a face check before going online — open the check screen
      // instead of surfacing an error; on pass it retries going online.
      if (err instanceof FaceCheckRequiredError) {
        setIsOnline(false);
        router.push('/shift-check');
        return;
      }
      const errorMessage = err instanceof Error ? err.message : 'Failed to update driver status';
      setError(errorMessage);
      // Revert on error
      setIsOnline(!newStatus);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [status, fetchStatus, ensureLocationTracking]);

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
      // Stop tracking when user logs out (void = fire-and-forget; AuthContext logout already awaits)
      try {
        void locationTrackingService.stopTracking();
      } catch (err) {
        console.warn('[DriverStatusContext] Failed to stop tracking on logout:', err);
      }
    }
  }, [fetchStatus, user]);

  // Additional effect to ensure tracking starts when user becomes available and status is online
  useEffect(() => {
    if (user?.id && isOnline && !isInitialLoading) {
      // Verify tracking is actually active
      const isCurrentlyTracking = locationTrackingService.getIsTracking();
      if (!isCurrentlyTracking) {
        console.log('[DriverStatusContext] Status is online but tracking not active, starting tracking...');
        ensureLocationTracking().catch(err =>
          console.warn('[DriverStatusContext] Failed to start tracking after user/login:', err)
        );
      }
    }
  }, [user?.id, isOnline, isInitialLoading, ensureLocationTracking]);

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

