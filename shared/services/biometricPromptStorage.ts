import * as SecureStore from 'expo-secure-store';

/**
 * Temporary storage key for login credentials (only used to pass to prompt)
 */
const TEMP_CREDENTIALS_KEY = 'temp_login_credentials';

interface TempCredentials {
  email: string;
  password: string;
  timestamp: number;
}

/**
 * Store temporary credentials for biometric prompt
 * This should be called from the login flow
 */
export async function storeTempCredentialsForPrompt(email: string, password: string): Promise<void> {
  try {
    const credentials: TempCredentials = {
      email,
      password,
      timestamp: Date.now(),
    };
    await SecureStore.setItemAsync(TEMP_CREDENTIALS_KEY, JSON.stringify(credentials));
  } catch (error) {
    console.warn('[BiometricPromptStorage] Error storing temp credentials:', error);
  }
}

/**
 * Get temporary credentials for biometric prompt
 */
export async function getTempCredentialsForPrompt(): Promise<TempCredentials | null> {
  try {
    const stored = await SecureStore.getItemAsync(TEMP_CREDENTIALS_KEY);
    if (!stored) {
      return null;
    }
    return JSON.parse(stored) as TempCredentials;
  } catch (error) {
    console.warn('[BiometricPromptStorage] Error getting temp credentials:', error);
    return null;
  }
}

/**
 * Clear temporary credentials
 */
export async function clearTempCredentialsForPrompt(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(TEMP_CREDENTIALS_KEY);
  } catch (error) {
    console.warn('[BiometricPromptStorage] Error clearing temp credentials:', error);
  }
}

