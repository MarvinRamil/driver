import { useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import { biometricAuth } from '../services/biometricAuth';
import { biometricStorage } from '../services/biometricStorage';
import { useAuth } from '@/features/auth';

/**
 * Hook for auto-prompting biometric login on app launch and resume
 * Only prompts if:
 * - User is not authenticated
 * - Biometric is available and ready
 * - User is on login screen
 */
export function useAutoBiometricLogin() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const [hasPrompted, setHasPrompted] = useState(false);
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const isAuthenticated = user !== null;

  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      // When app comes to foreground, check if we should prompt biometric
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active' &&
        !isAuthenticated &&
        !isLoading
      ) {
        // Small delay to ensure UI is ready
        setTimeout(() => {
          attemptAutoBiometricLogin();
        }, 500);
      }
      appState.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, [isAuthenticated, isLoading]);

  const attemptAutoBiometricLogin = async () => {
    // Don't prompt if already authenticated or loading
    if (isAuthenticated || isLoading) {
      return;
    }

    // Only prompt on login screen
    const currentRoute = segments[0];
    if (currentRoute !== 'login') {
      return;
    }

    // Don't prompt multiple times
    if (hasPrompted) {
      return;
    }

    try {
      // Check if biometric is ready
      const isReady = await biometricAuth.isReady();
      if (!isReady) {
        return;
      }

      // Get biometric type for prompt message
      const biometricType = await biometricAuth.getBiometricTypeName();

      // Attempt biometric authentication
      const credentials = await biometricAuth.authenticateAndGetCredentials(
        `Authenticate with ${biometricType} to login`
      );

      if (credentials) {
        // Credentials retrieved - trigger login
        // Note: We need to dispatch an event or use a callback to trigger login
        // For now, we'll use a custom event that login screen can listen to
        setHasPrompted(true);
      }
    } catch (error) {
      // Silently fail - user can login manually
      console.log('[useAutoBiometricLogin] Auto-login skipped:', error);
    }
  };

  // Attempt auto-login on mount if on login screen
  useEffect(() => {
    if (!isAuthenticated && !isLoading && !hasPrompted) {
      const currentRoute = segments[0];
      if (currentRoute === 'login') {
        // Small delay to ensure login screen is mounted
        const timer = setTimeout(() => {
          attemptAutoBiometricLogin();
        }, 1000);
        return () => clearTimeout(timer);
      }
    }
  }, [isAuthenticated, isLoading, segments, hasPrompted]);

  // Reset hasPrompted when user logs out
  useEffect(() => {
    if (!isAuthenticated) {
      setHasPrompted(false);
    }
  }, [isAuthenticated]);

  return {
    attemptAutoBiometricLogin,
  };
}
