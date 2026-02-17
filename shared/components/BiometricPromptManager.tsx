import React, { useEffect, useState } from 'react';
import { useAuthContext } from '@/features/auth/context/AuthContext';
import { useBiometricPrompt } from '@/shared/hooks/useBiometricPrompt';
import { BiometricEnablePrompt } from './BiometricEnablePrompt';
import { getTempCredentialsForPrompt, clearTempCredentialsForPrompt } from '@/shared/services/biometricPromptStorage';

interface TempCredentials {
  email: string;
  password: string;
  timestamp: number;
}

/**
 * Biometric prompt manager component
 * Shows biometric enable prompt after successful login
 * Should be placed in the app layout after AuthProvider
 */
export function BiometricPromptManager() {
  const { isAuthenticated, user } = useAuthContext();
  const { shouldShowPrompt, checkPrompt } = useBiometricPrompt();
  const [showPrompt, setShowPrompt] = useState(false);
  const [tempCredentials, setTempCredentials] = useState<TempCredentials | null>(null);

  // Check for temporary credentials and show prompt if needed (only when user does NOT already have biometric enabled)
  useEffect(() => {
    const loadTempCredentials = async () => {
      if (!isAuthenticated || !user) {
        return;
      }

      try {
        // Resolve whether to show prompt from this call (avoids race: state may not be updated yet)
        const shouldShow = await checkPrompt();
        if (!shouldShow) {
          await clearTempCredentialsForPrompt();
          return;
        }

        const credentials = await getTempCredentialsForPrompt();
        if (credentials) {
          const isRecent = Date.now() - credentials.timestamp < 5 * 60 * 1000;
          if (isRecent) {
            setTempCredentials(credentials);
            setShowPrompt(true);
          } else {
            await clearTempCredentialsForPrompt();
          }
        }
      } catch (error) {
        console.warn('[BiometricPromptManager] Error loading temp credentials:', error);
      }
    };

    loadTempCredentials();
  }, [isAuthenticated, user, checkPrompt]);

  const handleDismiss = async () => {
    setShowPrompt(false);
    // Clean up temporary credentials
    await clearTempCredentialsForPrompt();
    setTempCredentials(null);
    // Re-check prompt state
    await checkPrompt();
  };

  if (!showPrompt || !tempCredentials) {
    return null;
  }

  return (
    <BiometricEnablePrompt
      visible={showPrompt}
      onDismiss={handleDismiss}
      email={tempCredentials.email}
      password={tempCredentials.password}
    />
  );
}

