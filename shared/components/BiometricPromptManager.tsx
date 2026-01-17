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

  // Check for temporary credentials and show prompt if needed
  useEffect(() => {
    const loadTempCredentials = async () => {
      if (!isAuthenticated || !user) {
        return;
      }

      try {
        // Check if we should show prompt
        await checkPrompt();

        // Get temporary credentials if they exist
        const credentials = await getTempCredentialsForPrompt();
        if (credentials) {
          // Check if credentials are recent (within 5 minutes)
          const isRecent = Date.now() - credentials.timestamp < 5 * 60 * 1000;
          
          if (isRecent && shouldShowPrompt) {
            setTempCredentials(credentials);
            setShowPrompt(true);
          } else {
            // Clean up old credentials
            await clearTempCredentialsForPrompt();
          }
        }
      } catch (error) {
        console.warn('[BiometricPromptManager] Error loading temp credentials:', error);
      }
    };

    loadTempCredentials();
  }, [isAuthenticated, user, shouldShowPrompt, checkPrompt]);

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

