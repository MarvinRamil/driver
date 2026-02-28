import { useEffect, useState } from 'react';
import { biometricAuth } from '@/shared/services/biometricAuth';
import { biometricStorage } from '@/shared/services/biometricStorage';

interface UseBiometricPromptReturn {
  /** Whether to show the biometric enable prompt */
  shouldShowPrompt: boolean;
  /** Whether biometric is available */
  isBiometricAvailable: boolean;
  /** Biometric type name (Face ID, Touch ID, etc.) */
  biometricType: string;
  /** Check if prompt should be shown; returns true only when biometric available and credentials not yet stored (avoids race with state) */
  checkPrompt: () => Promise<boolean>;
}

/**
 * Hook to manage biometric enable prompt
 * Checks if biometric is available and if credentials are not stored
 */
export function useBiometricPrompt(): UseBiometricPromptReturn {
  const [shouldShowPrompt, setShouldShowPrompt] = useState(false);
  const [isBiometricAvailable, setIsBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState<string>('Biometric');

  const checkPrompt = async (): Promise<boolean> => {
    try {
      const [available, hasCredentials] = await Promise.all([
        biometricAuth.isAvailable(),
        biometricStorage.hasStoredCredentials(),
      ]);

      const type = await biometricAuth.getBiometricTypeName();

      setIsBiometricAvailable(available);
      setBiometricType(type);
      const show = available && !hasCredentials;
      setShouldShowPrompt(show);
      return show;
    } catch (error) {
      console.warn('[useBiometricPrompt] Error checking prompt:', error);
      setIsBiometricAvailable(false);
      setShouldShowPrompt(false);
      return false;
    }
  };

  useEffect(() => {
    checkPrompt();
  }, []);

  return {
    shouldShowPrompt,
    isBiometricAvailable,
    biometricType,
    checkPrompt,
  };
}

