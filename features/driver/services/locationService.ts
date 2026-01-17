import { apiClient } from '@/shared/services/apiClient';
import type { ApiResponse } from '@/shared/types/api';
import * as Device from 'expo-device';

/**
 * Location DTOs matching backend API
 */
export interface LocationDto {
  driverId: string;
  latitude: number;
  longitude: number;
  speed?: number;
  heading?: number;
  timestamp: string;
  deviceId?: string;
}

export interface UpdateLocationDto {
  latitude: number;
  longitude: number;
  speed?: number;
  heading?: number;
  deviceId?: string;
}

export interface LocationHistoryDto {
  id: string;
  driverId: string;
  latitude: number;
  longitude: number;
  speed?: number;
  heading?: number;
  timestamp: string;
  deviceId?: string;
}

/**
 * Service for managing driver location updates
 * Sends location data to backend API which then publishes to MQTT
 */
class LocationService {
  private deviceId: string | null = null;

  /**
   * Get or generate device ID
   */
  private async getDeviceId(): Promise<string> {
    try {
      if (!this.deviceId) {
        // Generate a device ID using device info
        const deviceName = Device.deviceName || 'unknown';
        let deviceType = 'unknown';
        try {
          deviceType = await Device.getDeviceTypeAsync();
        } catch (error) {
          console.warn('Error getting device type:', error);
        }
        const osName = Device.osName || 'unknown';
        const osVersion = Device.osVersion || 'unknown';
        // Create a unique device ID
        this.deviceId = `${deviceName}-${deviceType}-${osName}-${osVersion}`.replace(/\s+/g, '-');
      }
      return this.deviceId;
    } catch (error) {
      console.error('Error generating device ID:', error);
      // Fallback to a simple device ID
      if (!this.deviceId) {
        this.deviceId = `device-${Date.now()}`;
      }
      return this.deviceId;
    }
  }

  /**
   * Update driver location
   * Sends location update to backend API
   * Backend will then publish to MQTT automatically
   */
  async updateLocation(
    latitude: number,
    longitude: number,
    speed?: number,
    heading?: number
  ): Promise<LocationDto> {
    try {
      const deviceId = await this.getDeviceId();

      const updateDto: UpdateLocationDto = {
        latitude,
        longitude,
        speed,
        heading,
        deviceId,
      };

      console.log('[LocationService] Sending location update:', {
        latitude,
        longitude,
        speed,
        heading,
        deviceId,
      });

      const response = await apiClient.post<ApiResponse<LocationDto>>(
        '/api/locations/update',
        {
          body: updateDto,
        }
      );

      console.log('[LocationService] Location update response:', {
        success: response.success,
        statusCode: response.statusCode,
        message: response.message,
        hasData: !!response.data,
      });

      if (!response.success || !response.data) {
        const errorMsg = response.message || 'Failed to update location';
        console.error('[LocationService] Location update failed:', errorMsg, response);
        throw new Error(errorMsg);
      }

      console.log('[LocationService] Location update successful:', response.data);
      return response.data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorDetails = error && typeof error === 'object' && 'status' in error 
        ? ` (Status: ${(error as any).status})` 
        : '';
      console.error('[LocationService] Location update error:', {
        error,
        errorMessage,
        errorDetails,
        errorType: typeof error,
        errorName: error instanceof Error ? error.name : undefined,
      });
      throw new Error(`Failed to update location: ${errorMessage}${errorDetails}`);
    }
  }

  /**
   * Update driver location batch
   */
  async updateLocationBatch(locations: UpdateLocationDto[]): Promise<void> {
    try {
      if (locations.length === 0) return;

      const deviceId = await this.getDeviceId();
      
      // Ensure all dtos have deviceId
      const dtosWithDevice = locations.map(l => ({
        ...l,
        deviceId: l.deviceId || deviceId
      }));

      console.log('[LocationService] Sending location batch:', {
        count: dtosWithDevice.length,
        deviceId,
        firstLocation: dtosWithDevice[0],
      });

      const response = await apiClient.post<{ count: number }>(
        '/api/locations/batch',
        {
          body: dtosWithDevice,
        }
      );

      console.log('[LocationService] Location batch response:', {
        success: response.success,
        statusCode: response.statusCode,
        message: response.message,
      });

      if (!response.success) {
        const errorMsg = response.message || 'Failed to update location batch';
        console.error('[LocationService] Location batch failed:', errorMsg, response);
        throw new Error(errorMsg);
      }

      console.log('[LocationService] Location batch successful, count:', response.data);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorDetails = error && typeof error === 'object' && 'status' in error 
        ? ` (Status: ${(error as any).status})` 
        : '';
      console.error('[LocationService] Location batch error:', {
        error,
        errorMessage,
        errorDetails,
        errorType: typeof error,
        errorName: error instanceof Error ? error.name : undefined,
      });
      throw new Error(`Failed to update location batch: ${errorMessage}${errorDetails}`);
    }
  }

  /**
   * Get current driver location
   */
  async getCurrentLocation(): Promise<LocationDto> {
    try {
      const response = await apiClient.get<ApiResponse<LocationDto>>(
        '/api/locations/current'
      );

      if (!response.success || !response.data) {
        throw new Error(response.message || 'Failed to get current location');
      }

      return response.data;
    } catch (error) {
      throw new Error(
        `Failed to get current location: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get location history
   */
  async getLocationHistory(from?: Date, to?: Date): Promise<LocationHistoryDto[]> {
    try {
      const params: Record<string, string> = {};
      if (from) {
        params.from = from.toISOString();
      }
      if (to) {
        params.to = to.toISOString();
      }

      const queryString = new URLSearchParams(params).toString();
      const endpoint = `/api/locations/history${queryString ? `?${queryString}` : ''}`;

      const response = await apiClient.get<ApiResponse<LocationHistoryDto[]>>(
        endpoint
      );

      if (!response.success || !response.data) {
        throw new Error(response.message || 'Failed to get location history');
      }

      return response.data;
    } catch (error) {
      throw new Error(
        `Failed to get location history: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}

export const locationService = new LocationService();

