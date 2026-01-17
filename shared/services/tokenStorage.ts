import * as SecureStore from 'expo-secure-store';

/**
 * Token storage keys
 */
const TOKEN_KEYS = {
  ACCESS_TOKEN: 'access_token',
  REFRESH_TOKEN: 'refresh_token',
} as const;

/**
 * Secure token storage service
 * Provides secure storage for authentication tokens using Expo SecureStore
 */
class TokenStorage {
  /**
   * Store an access token securely
   * @param token - The access token to store
   * @returns Promise that resolves when token is stored
   */
  async setAccessToken(token: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(TOKEN_KEYS.ACCESS_TOKEN, token);
    } catch (error) {
      throw new Error(`Failed to store access token: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Retrieve the stored access token
   * @returns Promise that resolves to the access token or null if not found
   */
  async getAccessToken(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(TOKEN_KEYS.ACCESS_TOKEN);
    } catch (error) {
      throw new Error(`Failed to retrieve access token: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Store a refresh token securely
   * @param token - The refresh token to store
   * @returns Promise that resolves when token is stored
   */
  async setRefreshToken(token: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(TOKEN_KEYS.REFRESH_TOKEN, token);
    } catch (error) {
      throw new Error(`Failed to store refresh token: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Retrieve the stored refresh token
   * @returns Promise that resolves to the refresh token or null if not found
   */
  async getRefreshToken(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(TOKEN_KEYS.REFRESH_TOKEN);
    } catch (error) {
      throw new Error(`Failed to retrieve refresh token: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Remove the stored access token
   * @returns Promise that resolves when token is removed
   */
  async removeAccessToken(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(TOKEN_KEYS.ACCESS_TOKEN);
    } catch (error) {
      throw new Error(`Failed to remove access token: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Remove the stored refresh token
   * @returns Promise that resolves when token is removed
   */
  async removeRefreshToken(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(TOKEN_KEYS.REFRESH_TOKEN);
    } catch (error) {
      throw new Error(`Failed to remove refresh token: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Remove all stored tokens (logout)
   * @returns Promise that resolves when all tokens are removed
   */
  async clearAllTokens(): Promise<void> {
    try {
      await Promise.all([
        this.removeAccessToken(),
        this.removeRefreshToken(),
      ]);
    } catch (error) {
      throw new Error(`Failed to clear tokens: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

/**
 * Singleton instance of token storage service
 */
export const tokenStorage = new TokenStorage();

