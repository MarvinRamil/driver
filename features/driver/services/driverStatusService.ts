import { apiClient } from '@/shared/services/apiClient';
import type { ApiResponse } from '@/shared/types/api';

/**
 * Driver status response
 */
export interface DriverStatus {
  isOnline: boolean;
  currentLatitude?: number | null;
  currentLongitude?: number | null;
  locationUpdatedAt?: string | null;
}

/**
 * Update driver online status request
 */
export interface UpdateDriverStatusRequest {
  isOnline: boolean;
}

/**
 * Update driver online status response
 */
export interface UpdateDriverStatusResponse {
  isOnline: boolean;
}

/**
 * Service for managing driver online status
 */
class DriverStatusService {
  /**
   * Get current driver status
   */
  async getMyStatus(): Promise<DriverStatus> {
    try {
      const response = await apiClient.get<{ data: DriverStatus }>('/api/users/driver/my-status');
      // API returns { success: true, data: { isOnline, ... } }
      return response.data.data || response.data;
    } catch (error) {
      console.error('Error fetching driver status:', error);
      // Return default status on error
      return {
        isOnline: false,
        currentLatitude: null,
        currentLongitude: null,
        locationUpdatedAt: null,
      };
    }
  }

  /**
   * Update driver online status
   */
  async updateStatus(isOnline: boolean): Promise<UpdateDriverStatusResponse> {
    try {
      const response = await apiClient.patch<{ data: UpdateDriverStatusResponse }>('/api/users/driver/status', {
        body: { isOnline },
      });
      // API returns { success: true, data: { isOnline } }
      return response.data.data || { isOnline: response.data.isOnline ?? isOnline };
    } catch (error) {
      console.error('Error updating driver status:', error);
      throw new Error(
        `Failed to update driver status: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}

export const driverStatusService = new DriverStatusService();

