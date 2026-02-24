import { useCallback, useEffect, useState, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { locationTrackingService } from '../services/locationTrackingService';
import { mqttLocationService } from '../services/mqttLocationService';
import { useAuth } from '@/features/auth';

interface UseLocationTrackingReturn {
  /** Whether location tracking is active */
  isTracking: boolean;
  /** Loading state */
  isLoading: boolean;
  /** Error message */
  error: string | null;
  /** Start location tracking */
  startTracking: (updateInterval?: number) => Promise<void>;
  /** Stop location tracking */
  stopTracking: () => void;
  /** Check if location permissions are granted */
  hasPermissions: () => Promise<boolean>;
  /** Request location permissions */
  requestPermissions: () => Promise<boolean>;
}

/**
 * Hook for managing location tracking
 * Automatically starts/stops tracking when driver goes online/offline
 */
export function useLocationTracking(autoStart: boolean = false): UseLocationTrackingReturn {
  const { user } = useAuth();
  const [isTracking, setIsTracking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track AppState for reconnections
  const appState = useRef(AppState.currentState);

  const startTracking = useCallback(async (updateInterval: number = 5000) => {
    try {
      setIsLoading(true);
      setError(null);

      // Set driver ID if available
      if (user?.id) {
        locationTrackingService.setDriverId(user.id);
      }

      await locationTrackingService.startTracking(updateInterval, user?.id);
      setIsTracking(true);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start location tracking';
      setError(errorMessage);
      setIsTracking(false);
      console.error('Error starting location tracking:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const stopTracking = useCallback(() => {
    try {
      locationTrackingService.stopTracking();
      setIsTracking(false);
      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to stop location tracking';
      setError(errorMessage);
      console.error('Error stopping location tracking:', err);
    }
  }, []);

  const hasPermissions = useCallback(async () => {
    return await locationTrackingService.hasPermissions();
  }, []);

  const requestPermissions = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const granted = await locationTrackingService.requestPermissions();
      return granted;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to request location permissions';
      setError(errorMessage);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Auto-start tracking if enabled
  useEffect(() => {
    if (autoStart && !isTracking) {
      startTracking();
    }

    // Cleanup on unmount
    return () => {
      if (isTracking) {
        stopTracking();
      }
    };
  }, [autoStart, isTracking, startTracking, stopTracking]);

  // Handle AppState changes to revive MQTT immediately when returning to foreground
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      // If returning to the foreground (active) and we should be tracking
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active' &&
        isTracking
      ) {
        console.log('[useLocationTracking] App returned to foreground. Verifying MQTT health...');
        if (!mqttLocationService.isConnected()) {
          console.log('[useLocationTracking] MQTT disconnected while in background. Reviving...');
          mqttLocationService.forceReconnect().catch(err => {
            console.warn('[useLocationTracking] Failed to revive MQTT on foreground:', err);
          });
        } else {
          console.log('[useLocationTracking] MQTT is still healthy on foreground.');
        }
      }
      appState.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      subscription.remove();
    };
  }, [isTracking]);

  return {
    isTracking,
    isLoading,
    error,
    startTracking,
    stopTracking,
    hasPermissions,
    requestPermissions,
  };
}

/**
 * Hook for getting location tracking status (for UI indicators)
 */
export function useLocationTrackingStatus() {
  const [status, setStatus] = useState(() => locationTrackingService.getStatus());

  useEffect(() => {
    // Subscribe to status changes
    const unsubscribe = locationTrackingService.onStatusChange(() => {
      setStatus(locationTrackingService.getStatus());
    });

    // Update status periodically to show "time since last sent"
    const interval = setInterval(() => {
      setStatus(locationTrackingService.getStatus());
    }, 1000); // Update every second

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  return status;
}

