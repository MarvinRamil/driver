import { tokenStorage } from '@/shared/services/tokenStorage';
import type { AuthResponse, RefreshTokenResponse } from '../types';

/**
 * Token service for managing authentication tokens
 * Provides high-level token management operations including login, logout, and token refresh
 */
class TokenService {
  /**
   * Store authentication tokens after successful login
   * @param authResponse - Authentication response containing tokens and user info
   * @returns Promise that resolves when tokens are stored
   */
  async storeTokens(authResponse: AuthResponse): Promise<void> {
    try {
      await Promise.all([
        tokenStorage.setAccessToken(authResponse.accessToken),
        tokenStorage.setRefreshToken(authResponse.refreshToken || ''),
      ]);
    } catch (error) {
      throw new Error(`Failed to store authentication tokens: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get the current access token
   * @returns Promise that resolves to the access token or null if not found
   */
  async getAccessToken(): Promise<string | null> {
    return tokenStorage.getAccessToken();
  }

  /**
   * Get the current refresh token
   * @returns Promise that resolves to the refresh token or null if not found
   */
  async getRefreshToken(): Promise<string | null> {
    return tokenStorage.getRefreshToken();
  }

  /**
   * Check if user has valid tokens (is authenticated)
   * @returns Promise that resolves to true if access token exists
   */
  async isAuthenticated(): Promise<boolean> {
    const token = await this.getAccessToken();
    return token !== null && token.length > 0;
  }

  /**
   * Refresh the access token using the refresh token
   * Note: This is a placeholder - actual implementation should call your refresh token API endpoint
   * @returns Promise that resolves to new token response
   */
  async refreshAccessToken(): Promise<RefreshTokenResponse> {
    const refreshToken = await this.getRefreshToken();
    
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    // TODO: Implement actual API call to refresh token endpoint
    // Example:
    // const response = await apiClient.post<RefreshTokenResponse>('/auth/refresh', {
    //   body: { refreshToken },
    //   requiresAuth: false,
    // });
    // 
    // if (response.data.accessToken) {
    //   await tokenStorage.setAccessToken(response.data.accessToken);
    //   if (response.data.refreshToken) {
    //     await tokenStorage.setRefreshToken(response.data.refreshToken);
    //   }
    // }
    // 
    // return response.data;

    throw new Error('Token refresh not implemented - requires API endpoint');
  }

  /**
   * Clear all authentication tokens (logout)
   * @returns Promise that resolves when all tokens are cleared
   */
  async clearTokens(): Promise<void> {
    try {
      await tokenStorage.clearAllTokens();
    } catch (error) {
      throw new Error(`Failed to clear tokens: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Store user data in secure storage
   * Note: User data can be stored separately if needed for offline access
   * @param user - User object to store
   * @returns Promise that resolves when user data is stored
   */
  async storeUserData(user: any): Promise<void> {
    // Note: Currently user data is not stored separately
    // It's fetched from API when needed
    // If offline access is required, implement secure storage here
    // Example: await SecureStore.setItemAsync('user_data', JSON.stringify(user));
  }

  /**
   * Retrieve stored user data
   * @returns Promise that resolves to user data or null if not found
   */
  async getUserData(): Promise<any | null> {
    // Note: Currently user data is not stored separately
    // It's fetched from API when needed
    // If offline access is required, implement secure storage retrieval here
    return null;
  }

  /**
   * Logout user and clear all tokens
   * @returns Promise that resolves when logout is complete
   */
  async logout(): Promise<void> {
    try {
      await this.clearTokens();
    } catch (error) {
      throw new Error(`Failed to logout: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

/**
 * Singleton instance of token service
 * Use this instance throughout the application for token management
 */
export const tokenService = new TokenService();

