import * as Location from 'expo-location';
import * as Device from 'expo-device';
import { locationService } from './locationService';
import { mqttLocationService } from './mqttLocationService';
import { Platform } from 'react-native';

/**
 * Location tracking service
 * Tracks driver location and sends updates to backend API
 * Backend will then publish to MQTT automatically
 */
class LocationTrackingService {
  private watchSubscription: Location.LocationSubscription | null = null;
  private isTracking = false;
  private updateInterval: number = 5000; // Update every 5 seconds
  private lastUpdateTime: number = 0;
  private minUpdateInterval: number = 3000; // Minimum 3 seconds between updates
  private driverId: string | null = null; // Driver ID for MQTT publishing

  // Batching properties
  private locationBuffer: Location.LocationObject[] = [];
  private flushTimer: any | null = null;
  private readonly BATCH_SIZE_LIMIT = 10;
  private readonly FLUSH_INTERVAL = 15000; // 15 seconds

  // Status tracking for UI
  private lastSentTime: number = 0;
  private lastSentCount: number = 0;
  private lastError: string | null = null;
  private statusListeners: Set<() => void> = new Set();

  /**
   * Request location permissions
   */
  async requestPermissions(): Promise<boolean> {
    try {
      // Check if location services are enabled
      const isEnabled = await Location.hasServicesEnabledAsync();
      if (!isEnabled) {
        console.warn('Location services are disabled');
        return false;
      }

      // Request permissions
      const { status } = await Location.requestForegroundPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('Error requesting location permissions:', error);
      return false;
    }
  }

  /**
   * Check if location permissions are granted
   */
  async hasPermissions(): Promise<boolean> {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('Error checking location permissions:', error);
      return false;
    }
  }

  /**
   * Set driver ID for MQTT publishing
   * @param driverId - Driver ID from authenticated user
   */
  setDriverId(driverId: string): void {
    this.driverId = driverId;
    console.log('[LocationTrackingService] Driver ID set:', driverId);
  }

  /**
   * Get driver ID (tries to extract from JWT token if not set)
   */
  private async getDriverId(): Promise<string | null> {
    if (this.driverId) {
      return this.driverId;
    }

    // Try to extract from JWT token as fallback
    try {
      const { tokenStorage } = await import('@/shared/services/tokenStorage');
      const token = await tokenStorage.getAccessToken();
      if (token) {
        // Decode JWT token (simple base64 decode of payload)
        const parts = token.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(atob(parts[1]));
          const userId = payload.sub || payload.nameid || payload.userId || payload.id;
          if (userId) {
            console.log('[LocationTrackingService] Extracted driver ID from token:', userId);
            this.driverId = userId;
            return userId;
          }
        }
      }
    } catch (error) {
      console.warn('[LocationTrackingService] Could not extract driver ID from token:', error);
    }

    return null;
  }

  /**
   * Start tracking location
   * @param updateInterval - Interval in milliseconds between location updates (default: 5000ms)
   * @param driverId - Optional driver ID (if not provided, will try to extract from token)
   */
  async startTracking(updateInterval: number = 5000, driverId?: string): Promise<void> {
    if (driverId) {
      this.setDriverId(driverId);
    }
    if (this.isTracking) {
      console.warn('Location tracking is already active');
      return;
    }

    // Request permissions if not granted
    const hasPermission = await this.hasPermissions();
    if (!hasPermission) {
      const granted = await this.requestPermissions();
      if (!granted) {
        throw new Error('Location permissions not granted');
      }
    }

    this.updateInterval = updateInterval;
    this.isTracking = true;
    this.lastUpdateTime = 0;
    this.locationBuffer = [];

    // Start flush timer
    this.startFlushTimer();

    // Initialize MQTT connection (non-blocking)
    // If it fails, we'll fall back to HTTP
    mqttLocationService.connect().catch((error) => {
      console.warn('MQTT connection failed, will use HTTP fallback:', error);
    });

    try {
      // Start watching location changes
      this.watchSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation, // High accuracy for speed calculation
          timeInterval: this.updateInterval,
          distanceInterval: 10, // Update every 10 meters
          mayShowUserSettingsDialog: true,
        },
        async (location) => {
          await this.handleLocationUpdate(location);
        }
      );

      console.log('Location tracking started');
      this.notifyStatusListeners();
    } catch (error) {
      this.isTracking = false;
      this.stopFlushTimer();
      console.error('Error starting location tracking:', error);
      this.notifyStatusListeners();
      throw error;
    }
  }

  /**
   * Stop tracking location.
   * Awaits any pending buffer flush so no location API call runs after tokens are cleared (e.g. on logout).
   */
  async stopTracking(): Promise<void> {
    if (!this.isTracking) {
      return;
    }

    if (this.watchSubscription) {
      this.watchSubscription.remove();
      this.watchSubscription = null;
    }

    // Flush remaining buffer and await so logout doesn't clear tokens before this request completes
    if (this.locationBuffer.length > 0) {
      try {
        await this.flushBuffer();
      } catch (err) {
        console.error('Error flushing final buffer:', err);
      }
    }

    this.stopFlushTimer();
    this.isTracking = false;
    this.lastUpdateTime = 0;

    // Disconnect MQTT when stopping tracking
    mqttLocationService.disconnect().catch((error) => {
      console.warn('Error disconnecting MQTT:', error);
    });

    this.notifyStatusListeners();
    console.log('Location tracking stopped');
  }

  private startFlushTimer() {
    this.stopFlushTimer();
    this.flushTimer = setInterval(() => {
      this.flushBuffer();
    }, this.FLUSH_INTERVAL);
  }

  private stopFlushTimer() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  private async flushBuffer(): Promise<void> {
    if (this.locationBuffer.length === 0) return;

    // Take snapshot and clear buffer immediately to allow new updates
    const batch = [...this.locationBuffer];
    this.locationBuffer = [];

    // Periodic MQTT Health Check:
    // If we're tracking but MQTT is dead (e.g., stuck due to backgrounding), try to revive it over time.
    if (!mqttLocationService.isConnected()) {
      console.log('[LocationTrackingService] Health Check: MQTT is disconnected. Requesting force reconnect...');
      mqttLocationService.forceReconnect().catch(err => {
        console.warn('[LocationTrackingService] MQTT force reconnect failed during flush:', err);
      });
    }

    try {
      // Try MQTT first (preferred method - real-time, lighter)
      if (mqttLocationService.isConnected()) {
        try {
          // Get driver ID (required for MQTT)
          const driverId = await this.getDriverId();
          if (!driverId) {
            console.warn('[LocationTrackingService] No driver ID available, skipping MQTT publish');
            throw new Error('Driver ID not set');
          }

          // Get device ID for MQTT payload (using same method as locationService)
          let deviceId: string | null = null;
          try {
            const deviceName = Device.deviceName || 'unknown';
            let deviceType = 'unknown';
            try {
              deviceType = await Device.getDeviceTypeAsync();
            } catch {
              // Ignore
            }
            const osName = Device.osName || 'unknown';
            const osVersion = Device.osVersion || 'unknown';
            deviceId = `${deviceName}-${deviceType}-${osName}-${osVersion}`.replace(/\s+/g, '-');
          } catch (error) {
            console.warn('[LocationTrackingService] Could not get device ID:', error);
          }

          // Publish each location individually via MQTT (real-time)
          const publishPromises = batch.map(location => {
            const speed = location.coords.speed != null
              ? Math.round(location.coords.speed * 3.6)
              : undefined;
            const heading = location.coords.heading != null
              ? Math.round(location.coords.heading)
              : undefined;

            return mqttLocationService.publishLocation(
              driverId,
              location.coords.latitude,
              location.coords.longitude,
              speed,
              heading,
              deviceId || undefined
            );
          });

          await Promise.all(publishPromises);
          this.lastSentTime = Date.now();
          this.lastSentCount += batch.length;
          this.lastError = null;
          this.notifyStatusListeners();
          console.log(`Published ${batch.length} locations via MQTT`);
          return; // Success via MQTT
        } catch (mqttError) {
          console.warn('MQTT publish failed, falling back to HTTP:', mqttError);
          // Fall through to HTTP fallback
        }
      }

      // Fallback to HTTP batch API
      const dtos = batch.map(location => {
        // Calculate speed in km/h
        const speed = location.coords.speed != null
          ? Math.round(location.coords.speed * 3.6)
          : undefined;

        // Calculate heading
        const heading = location.coords.heading != null
          ? Math.round(location.coords.heading)
          : undefined;

        return {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          speed,
          heading,
          // deviceId handled by service
        } as any; // Type assertion as UpdateLocationDto is not imported here directly but structure matches
      });

      await locationService.updateLocationBatch(dtos);
      this.lastSentTime = Date.now();
      this.lastSentCount += batch.length;
      this.lastError = null;
      this.notifyStatusListeners();
      console.log(`Flushed ${batch.length} locations via HTTP`);
    } catch (error) {
      // Extract full error message from various error types
      let errorMessage = 'Unknown error';

      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (error && typeof error === 'object') {
        // Handle ApiError objects
        if ('message' in error && typeof error.message === 'string') {
          errorMessage = error.message;
        } else if ('error' in error && typeof error.error === 'string') {
          errorMessage = error.error;
        } else if ('details' in error && error.details && typeof error.details === 'object') {
          // Try to extract message from details
          if ('message' in error.details && typeof error.details.message === 'string') {
            errorMessage = error.details.message;
          }
        }
      } else if (typeof error === 'string') {
        errorMessage = error;
      }

      this.lastError = errorMessage;
      this.notifyStatusListeners();
      console.error('Error sending location batch:', {
        error,
        errorMessage,
        errorType: typeof error,
        errorName: error instanceof Error ? error.name : undefined,
        errorStack: error instanceof Error ? error.stack : undefined,
        errorString: String(error),
        errorJSON: JSON.stringify(error, null, 2),
      });
      // Logic failure: Should we put them back? 
      // For GPS, "old" data is less valuable. Dropping is often safer than indefinite retry loops.
      // We could implement a "retry once" logic, but simplicity rule applies.
    }
  }

  /**
   * Get location tracking status for UI
   */
  getStatus(): {
    isTracking: boolean;
    lastSentTime: number;
    lastSentCount: number;
    lastError: string | null;
    hasRecentUpdate: boolean; // True if sent within last 30 seconds
  } {
    const now = Date.now();
    const hasRecentUpdate = this.lastSentTime > 0 && (now - this.lastSentTime) < 30000; // 30 seconds
    return {
      isTracking: this.isTracking,
      lastSentTime: this.lastSentTime,
      lastSentCount: this.lastSentCount,
      lastError: this.lastError,
      hasRecentUpdate,
    };
  }

  /**
   * Subscribe to status changes
   */
  onStatusChange(listener: () => void): () => void {
    this.statusListeners.add(listener);
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  private notifyStatusListeners(): void {
    this.statusListeners.forEach(listener => {
      try {
        listener();
      } catch (error) {
        console.error('Error in status listener:', error);
      }
    });
  }

  /**
   * Handle location update
   * Sends location to backend API
   */
  private async handleLocationUpdate(location: Location.LocationObject): Promise<void> {
    // Throttle updates to prevent too frequent API calls
    const now = Date.now();
    if (now - this.lastUpdateTime < this.minUpdateInterval) {
      return;
    }

    // Add to buffer
    this.locationBuffer.push(location);
    this.lastUpdateTime = now;

    // If buffer full, flush immediately
    if (this.locationBuffer.length >= this.BATCH_SIZE_LIMIT) {
      await this.flushBuffer();
      // Restart timer to avoid double flush shortly after
      this.startFlushTimer();
    }
  }

  /**
   * Get current location once (without starting tracking)
   */
  async getCurrentLocation(): Promise<Location.LocationObject> {
    try {
      const hasPermission = await this.hasPermissions();
      if (!hasPermission) {
        const granted = await this.requestPermissions();
        if (!granted) {
          throw new Error('Location permissions not granted');
        }
      }

      return await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
        // @ts-ignore - maximumAge not officially in the types but sometimes supported by native code
        maximumAge: 60000, // Accept location up to 1 minute old
        timeout: 15000, // 15 second timeout
      });
    } catch (error) {
      console.error('Error getting current location:', error);
      throw new Error(
        `Failed to get current location: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Check if tracking is active
   */
  getIsTracking(): boolean {
    return this.isTracking;
  }

  /**
   * Set update interval
   */
  setUpdateInterval(interval: number): void {
    try {
      this.updateInterval = interval;
      // Restart tracking if active to apply new interval
      if (this.isTracking) {
        this.stopTracking();
        this.startTracking(interval).catch((error) => {
          console.error('Error restarting location tracking with new interval:', error);
          // Don't throw - allow app to continue
        });
      }
    } catch (error) {
      console.error('Error setting update interval:', error);
      // Don't throw - allow app to continue
    }
  }
}

export const locationTrackingService = new LocationTrackingService();

