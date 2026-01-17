import { useEffect, useState } from 'react';
import * as Updates from 'expo-updates';

/**
 * Hook for managing OTA (Over-The-Air) updates
 * Checks for updates and applies them automatically
 */
export function useOTAUpdates() {
  const [isUpdateAvailable, setIsUpdateAvailable] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<Error | null>(null);

  useEffect(() => {
    // Only check for updates in production builds (not in dev mode or Expo Go)
    if (__DEV__ || !Updates.isEnabled || Updates.channel === 'default') {
      console.log('[OTA Updates] Skipping update check - running in development mode');
      return;
    }

    // Only check for updates in production builds with EAS updates
    checkForUpdates();
  }, []);

  const checkForUpdates = async () => {
    try {
      // Double-check we're not in dev mode
      if (__DEV__ || !Updates.isEnabled) {
        console.log('[OTA Updates] Skipping - dev mode or updates disabled');
        return;
      }

      console.log('[OTA Updates] Checking for updates...');
      const update = await Updates.checkForUpdateAsync();

      if (update.isAvailable) {
        console.log('[OTA Updates] Update available, downloading...');
        setIsUpdateAvailable(true);
        await downloadAndApplyUpdate();
      } else {
        console.log('[OTA Updates] No update available');
      }
    } catch (error) {
      // Silently fail in development - don't show errors
      if (__DEV__) {
        console.log('[OTA Updates] Update check failed (dev mode, ignoring):', error);
        return;
      }
      console.error('[OTA Updates] Error checking for updates:', error);
      setUpdateError(error instanceof Error ? error : new Error('Unknown error'));
    }
  };

  const downloadAndApplyUpdate = async () => {
    try {
      if (__DEV__ || !Updates.isEnabled) {
        console.log('[OTA Updates] Skipping download - dev mode');
        return;
      }

      setIsUpdating(true);
      console.log('[OTA Updates] Fetching update...');
      await Updates.fetchUpdateAsync();
      console.log('[OTA Updates] Update fetched, reloading...');
      await Updates.reloadAsync();
    } catch (error) {
      // Silently fail in development
      if (__DEV__) {
        console.log('[OTA Updates] Download failed (dev mode, ignoring):', error);
        setIsUpdating(false);
        return;
      }
      console.error('[OTA Updates] Error downloading/applying update:', error);
      setUpdateError(error instanceof Error ? error : new Error('Unknown error'));
      setIsUpdating(false);
    }
  };

  return {
    isUpdateAvailable,
    isUpdating,
    updateError,
    checkForUpdates,
  };
}

