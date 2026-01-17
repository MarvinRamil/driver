import * as SecureStore from 'expo-secure-store';

/**
 * Biometric storage keys
 */
const BIOMETRIC_KEYS = {
  STORED_EMAIL: 'biometric_stored_email',
  STORED_PASSWORD: 'biometric_stored_password',
  BIOMETRIC_ENABLED: 'biometric_enabled',
} as const;

/**
 * Interface for stored biometric credentials
 */
export interface BiometricCredentials {
  email: string;
  password: string;
}

/**
 * Biometric storage service
 * Provides secure storage for biometric login credentials using Expo SecureStore
 */
class BiometricStorage {
  /**
   * Store credentials for biometric login
   * @param email - User's email/username
   * @param password - User's password
   * @returns Promise that resolves when credentials are stored
   */
  async storeCredentials(email: string, password: string): Promise<void> {
    try {
      await Promise.all([
        SecureStore.setItemAsync(BIOMETRIC_KEYS.STORED_EMAIL, email),
        SecureStore.setItemAsync(BIOMETRIC_KEYS.STORED_PASSWORD, password),
        SecureStore.setItemAsync(BIOMETRIC_KEYS.BIOMETRIC_ENABLED, 'true'),
      ]);
      console.log('[BiometricStorage] Credentials stored successfully');
    } catch (error) {
      throw new Error(
        `Failed to store biometric credentials: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Retrieve stored credentials for biometric login
   * @returns Promise that resolves to credentials or null if not found
   */
  async getStoredCredentials(): Promise<BiometricCredentials | null> {
    try {
      const email = await SecureStore.getItemAsync(BIOMETRIC_KEYS.STORED_EMAIL);
      const password = await SecureStore.getItemAsync(BIOMETRIC_KEYS.STORED_PASSWORD);

      if (!email || !password) {
        return null;
      }

      return { email, password };
    } catch (error) {
      console.warn('[BiometricStorage] Error retrieving stored credentials:', error);
      return null;
    }
  }

  /**
   * Check if biometric login is enabled
   * @returns Promise that resolves to true if enabled, false otherwise
   */
  async isBiometricEnabled(): Promise<boolean> {
    try {
      const enabled = await SecureStore.getItemAsync(BIOMETRIC_KEYS.BIOMETRIC_ENABLED);
      return enabled === 'true';
    } catch (error) {
      console.warn('[BiometricStorage] Error checking biometric status:', error);
      return false;
    }
  }

  /**
   * Check if stored credentials exist
   * @returns Promise that resolves to true if credentials exist, false otherwise
   */
  async hasStoredCredentials(): Promise<boolean> {
    try {
      const credentials = await this.getStoredCredentials();
      return credentials !== null;
    } catch (error) {
      return false;
    }
  }

  /**
   * Clear stored biometric credentials
   * @returns Promise that resolves when credentials are cleared
   */
  async clearCredentials(): Promise<void> {
    try {
      await Promise.all([
        SecureStore.deleteItemAsync(BIOMETRIC_KEYS.STORED_EMAIL),
        SecureStore.deleteItemAsync(BIOMETRIC_KEYS.STORED_PASSWORD),
        SecureStore.deleteItemAsync(BIOMETRIC_KEYS.BIOMETRIC_ENABLED),
      ]);
      console.log('[BiometricStorage] Credentials cleared successfully');
    } catch (error) {
      throw new Error(
        `Failed to clear biometric credentials: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}

/**
 * Singleton instance of biometric storage service
 */
export const biometricStorage = new BiometricStorage();

