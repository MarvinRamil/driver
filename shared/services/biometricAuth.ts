import * as LocalAuthentication from 'expo-local-authentication';
import { biometricStorage, type BiometricCredentials } from './biometricStorage';

/**
 * Biometric authentication service
 * Handles biometric authentication and credential retrieval
 */
class BiometricAuth {
  /**
   * Check if biometric authentication is available on the device
   * @returns Promise that resolves to true if available, false otherwise
   */
  async isAvailable(): Promise<boolean> {
    try {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      if (!compatible) {
        return false;
      }

      const enrolled = await LocalAuthentication.isEnrolledAsync();
      return enrolled;
    } catch (error) {
      console.error('[BiometricAuth] Error checking availability:', error);
      return false;
    }
  }

  /**
   * Get supported authentication types
   * @returns Promise that resolves to array of supported types
   */
  async getSupportedTypes(): Promise<LocalAuthentication.AuthenticationType[]> {
    try {
      return await LocalAuthentication.supportedAuthenticationTypesAsync();
    } catch (error) {
      console.error('[BiometricAuth] Error getting supported types:', error);
      return [];
    }
  }

  /**
   * Get human-readable name for biometric type
   * @returns String describing the biometric type (e.g., "Face ID", "Touch ID", "Fingerprint")
   */
  async getBiometricTypeName(): Promise<string> {
    try {
      const types = await this.getSupportedTypes();
      
      if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
        return 'Face ID';
      }
      if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
        return 'Touch ID';
      }
      if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
        return 'Iris';
      }
      
      return 'Biometric';
    } catch (error) {
      return 'Biometric';
    }
  }

  /**
   * Authenticate with biometric and retrieve stored credentials
   * @param promptMessage - Custom message to show in biometric prompt
   * @returns Promise that resolves to credentials if successful, null if failed or cancelled
   */
  async authenticateAndGetCredentials(
    promptMessage: string = 'Authenticate to login'
  ): Promise<BiometricCredentials | null> {
    try {
      // Check if biometric is available
      const available = await this.isAvailable();
      if (!available) {
        throw new Error('Biometric authentication is not available on this device');
      }

      // Check if credentials are stored
      const hasCredentials = await biometricStorage.hasStoredCredentials();
      if (!hasCredentials) {
        throw new Error('No stored credentials found. Please login with email and password first.');
      }

      // Authenticate with biometric
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage,
        cancelLabel: 'Cancel',
        disableDeviceFallback: false, // Allow device PIN/password as fallback
        fallbackLabel: 'Use Password',
      });

      if (!result.success) {
        if (result.error === 'user_cancel') {
          console.log('[BiometricAuth] User cancelled biometric authentication');
          return null;
        }
        throw new Error(result.error || 'Biometric authentication failed');
      }

      // Retrieve stored credentials
      const credentials = await biometricStorage.getStoredCredentials();
      if (!credentials) {
        throw new Error('Failed to retrieve stored credentials');
      }

      console.log('[BiometricAuth] Biometric authentication successful');
      return credentials;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[BiometricAuth] Biometric authentication error:', errorMessage);
      throw error;
    }
  }

  /**
   * Check if biometric login is ready (available + credentials stored)
   * @returns Promise that resolves to true if ready, false otherwise
   */
  async isReady(): Promise<boolean> {
    try {
      const [available, hasCredentials] = await Promise.all([
        this.isAvailable(),
        biometricStorage.hasStoredCredentials(),
      ]);
      return available && hasCredentials;
    } catch (error) {
      return false;
    }
  }
}

/**
 * Singleton instance of biometric authentication service
 */
export const biometricAuth = new BiometricAuth();

