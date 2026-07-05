import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { apiClient } from './apiClient';
import { tokenStorage } from './tokenStorage';

/**
 * Notification service for handling push notifications
 * Manages device token registration, notification permissions, and notification handling
 */

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export type PushTokenType = 'fcm' | 'apns' | 'expo';

export interface RegisterDeviceTokenRequest {
  deviceToken: string;
  platform: 'ios' | 'android';
  appType: 'driver';
  /** Token type the backend uses to route delivery (fcm/apns -> Firebase, expo -> Expo). */
  tokenType?: PushTokenType;
}

export interface RegisterDeviceTokenResponse {
  success: boolean;
  message?: string;
  /** The token type the backend currently expects for this platform (vendor-sync hint). */
  expectedTokenType?: PushTokenType;
}

/** GET /api/notifications/push-config response. */
export interface PushConfigResponse {
  provider: string;
  expected: { ios: PushTokenType; android: PushTokenType };
}

class NotificationService {
  private deviceToken: string | null = null;
  /** Token type resolved for the most recently acquired token. */
  private resolvedTokenType: PushTokenType | null = null;
  /** Guards against re-sync recursion when the backend reports a mismatch. */
  private resyncing = false;
  private notificationListener: Notifications.Subscription | null = null;
  private responseListener: Notifications.Subscription | null = null;

  /**
   * Ask the backend which token type it currently expects for this platform, so the
   * client stays in sync if the backend changes push vendor. Falls back to the native
   * default (FCM/APNs) when the config call fails.
   */
  async getExpectedTokenType(): Promise<PushTokenType> {
    const platform = Platform.OS === 'ios' ? 'ios' : 'android';
    try {
      const response = await apiClient.get<PushConfigResponse>(
        '/api/notifications/push-config',
        { requiresAuth: true }
      );
      const expected = response?.data?.expected?.[platform];
      if (expected === 'fcm' || expected === 'apns' || expected === 'expo') {
        return expected;
      }
    } catch (error) {
      console.warn('Could not fetch push-config; using default token type.', error);
    }
    return platform === 'ios' ? 'apns' : 'fcm';
  }

  /**
   * Request notification permissions
   * @returns true if permissions granted, false otherwise
   */
  async requestPermissions(): Promise<boolean> {
    try {
      if (!Device.isDevice) {
        console.warn('Push notifications only work on physical devices');
        return false;
      }

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        try {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        } catch (error) {
          console.error('Error requesting notification permissions:', error);
          return false;
        }
      }

      if (finalStatus !== 'granted') {
        console.warn('Failed to get push notification permissions');
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in requestPermissions:', error);
      return false;
    }
  }

  /**
   * Acquire the push token matching the type the backend currently expects.
   * - 'fcm' / 'apns' -> native token via getDevicePushTokenAsync (Firebase Admin SDK delivery)
   * - 'expo'         -> Expo push token via getExpoPushTokenAsync
   * If a native token is expected but unavailable (e.g. Expo Go / missing FCM creds),
   * falls back to an Expo token tagged 'expo'. Sets resolvedTokenType accordingly.
   * @returns push token or null if unavailable
   */
  async getDeviceToken(): Promise<string | null> {
    try {
      if (!Device.isDevice) {
        return null;
      }

      const expected = await this.getExpectedTokenType();

      if (expected === 'expo') {
        return await this.getExpoToken();
      }

      try {
        const tokenData = await Notifications.getDevicePushTokenAsync();
        this.resolvedTokenType = Platform.OS === 'ios' ? 'apns' : 'fcm';
        return tokenData.data;
      } catch (nativeError) {
        // Native token unavailable (Expo Go, missing FCM credentials, etc.) -> fall back to Expo.
        console.warn('Native push token unavailable; falling back to Expo token.', nativeError);
        return await this.getExpoToken();
      }
    } catch (error) {
      console.error('Error getting device token:', error);
      this.resolvedTokenType = null;
      return null;
    }
  }

  /** Acquire an Expo push token and tag the resolved type as 'expo'. */
  private async getExpoToken(): Promise<string | null> {
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID,
    });
    this.resolvedTokenType = 'expo';
    return tokenData.data;
  }

  /**
   * Register device token with backend
   * @param token - Device push token
   * @returns true if registration successful
   */
  async registerDeviceToken(token: string): Promise<boolean> {
    try {
      const platform = Platform.OS === 'ios' ? 'ios' : 'android';
      const tokenType: PushTokenType =
        this.resolvedTokenType ?? (Platform.OS === 'ios' ? 'apns' : 'fcm');

      const response = await apiClient.post<RegisterDeviceTokenResponse>(
        '/api/notifications/register-device',
        {
          body: {
            deviceToken: token,
            platform,
            appType: 'driver',
            tokenType,
          },
          requiresAuth: true,
        }
      );

      if (response.success && response.data) {
        this.deviceToken = token;

        // Vendor-sync: if the backend expects a different token type than we just sent,
        // re-acquire the correct token and re-register once.
        const expected = response.data.expectedTokenType;
        if (expected && expected !== tokenType && !this.resyncing) {
          this.resyncing = true;
          try {
            const newToken = await this.getDeviceToken();
            if (newToken && this.resolvedTokenType === expected) {
              await this.registerDeviceToken(newToken);
            }
          } finally {
            this.resyncing = false;
          }
        }

        return true;
      }

      return false;
    } catch (error) {
      console.error('Error registering device token:', error);
      return false;
    }
  }

  /**
   * Unregister device token from backend
   * @returns true if unregistration successful
   */
  async unregisterDeviceToken(): Promise<boolean> {
    try {
      if (!this.deviceToken) {
        return true; // Nothing to unregister
      }

      // Try to unregister, but don't require auth since user might already be logged out
      // The backend should handle unregistering based on device token if available
      try {
        await apiClient.delete('/api/notifications/unregister-device', {
          requiresAuth: false, // Don't require auth - token might already be invalid
        });
      } catch (error: any) {
        // If 401 or any error, user is already logged out or endpoint failed - this is expected
        // Silently handle it since we're already logging out
        if (error?.status === 401 || error?.statusCode === 401) {
          // Expected - user already logged out, token invalid
          // Don't log as error, just continue
        } else {
          // For other errors, log but don't fail
          console.warn('[NotificationService] Device token unregister failed (non-critical):', error?.message || error);
        }
      }

      this.deviceToken = null;
      return true;
    } catch (error) {
      // Clear token even on error to prevent stale state
      this.deviceToken = null;
      // Don't log as error - this is expected during logout
      return true; // Return true anyway since we cleared the token
    }
  }

  /**
   * Initialize notification service
   * Requests permissions, gets token, and registers with backend
   * @returns true if initialization successful
   */
  async initialize(): Promise<boolean> {
    try {
      // Request permissions
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        return false;
      }

      // Get device token
      const token = await this.getDeviceToken();
      if (!token) {
        return false;
      }

      // Register with backend (only if user is authenticated)
      const authToken = await tokenStorage.getAccessToken();
      if (authToken) {
        await this.registerDeviceToken(token);
      }

      return true;
    } catch (error) {
      console.error('Error initializing notification service:', error);
      return false;
    }
  }

  /**
   * Setup notification listeners
   * @param onNotificationReceived - Callback when notification is received
   * @param onNotificationTapped - Callback when notification is tapped
   */
  setupListeners(
    onNotificationReceived?: (notification: Notifications.Notification) => void,
    onNotificationTapped?: (response: Notifications.NotificationResponse) => void
  ): void {
    // Listen for notifications received while app is foregrounded
    this.notificationListener = Notifications.addNotificationReceivedListener(
      (notification) => {
        onNotificationReceived?.(notification);
      }
    );

    // Listen for user tapping on notification
    this.responseListener = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        onNotificationTapped?.(response);
      }
    );
  }

  /**
   * Remove notification listeners
   */
  removeListeners(): void {
    if (this.notificationListener) {
      this.notificationListener.remove();
      this.notificationListener = null;
    }

    if (this.responseListener) {
      this.responseListener.remove();
      this.responseListener = null;
    }
  }

  /**
   * Get the current device token
   */
  getCurrentToken(): string | null {
    return this.deviceToken;
  }
}

export const notificationService = new NotificationService();

