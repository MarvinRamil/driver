import { apiClient } from '@/shared/services/apiClient';
import { authService } from '@/features/auth/services/authService';
import type { UpdateProfileRequest, UpdateProfileResponse } from '../types';
import type { User } from '@/features/auth/types';

/**
 * Profile service for managing driver profile operations
 */
class ProfileService {
  /**
   * Get current user profile
   * Uses GET /api/auth/me endpoint
   * @returns Promise resolving to user profile
   */
  async getProfile(): Promise<User> {
    try {
      return await authService.getCurrentUser();
    } catch (error) {
      throw new Error(
        `Failed to fetch profile: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Update current user profile (driver updates own profile)
   * PUT /api/auth/profile - uses current auth user, no userId in path
   * @param _userId - Unused; kept for interface compatibility
   * @param data - Profile update data (fullName, vehicle fields)
   * @returns Promise resolving to updated user (fetched via refresh)
   */
  async updateProfile(_userId: string, data: UpdateProfileRequest): Promise<User> {
    try {
      // Backend expects PascalCase and only supports FullName + vehicle fields (no email change here)
      const body: Record<string, string | undefined> = {};
      if (data.fullName != null) body.FullName = data.fullName;
      if (data.vehiclePlate != null) body.VehiclePlate = data.vehiclePlate;
      if (data.vehicleModel != null) body.VehicleModel = data.vehicleModel;
      if (data.vehicleColor != null) body.VehicleColor = data.vehicleColor;

      const response = await apiClient.put<{ message?: string }>(`/api/auth/profile`, {
        body,
        requiresAuth: true,
      });

      if (!response.success) {
        throw new Error(response.message || 'Failed to update profile');
      }

      // Backend returns { success, message }; updated user is obtained via getCurrentUser/refresh
      return await authService.getCurrentUser();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : typeof error === 'object' && error != null && 'message' in error && typeof (error as { message: unknown }).message === 'string'
            ? (error as { message: string }).message
            : 'Unable to update profile. Please try again.';
      throw new Error(message);
    }
  }

  /**
   * Change user password (authenticated user)
   * POST /api/auth/change-password
   * @param _userId - Unused; API uses authenticated user from token
   * @param currentPassword - Current password
   * @param newPassword - New password
   * @returns Promise resolving when password is changed
   */
  async changePassword(
    _userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    try {
      const response = await apiClient.post<{ success: boolean; message?: string }>('/api/auth/change-password', {
        body: {
          currentPassword,
          newPassword,
        },
        requiresAuth: true,
      });

      if (!response.success) {
        throw new Error(response.message || 'Failed to change password');
      }
    } catch (error) {
      throw new Error(
        `Failed to change password: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Upload profile picture
   * POST /api/users/{id}/profile-picture
   * @param userId - User ID
   * @param imageUri - URI of the image to upload
   * @returns Promise resolving to image URL
   * @throws Error if upload fails
   */
  async uploadProfilePicture(userId: string, imageUri: string): Promise<string> {
    try {
      // Create FormData for multipart/form-data upload
      const formData = new FormData();
      
      // Extract filename from URI or use default
      const filename = imageUri.split('/').pop() || 'profile.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : 'image/jpeg';

      // Append image file to FormData
      formData.append('image', {
        uri: imageUri,
        type,
        name: filename,
      } as any);

      const response = await apiClient.post<{ imageUrl: string }>(
        `/api/users/${userId}/profile-picture`,
        {
          body: formData,
          requiresAuth: true,
          // Don't set Content-Type header - let browser set it with boundary for FormData
        }
      );

      if (!response.success || !response.data) {
        throw new Error(response.message || 'Failed to upload profile picture');
      }

      return response.data.imageUrl;
    } catch (error) {
      throw new Error(
        `Failed to upload profile picture: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}

/**
 * Singleton instance of profile service
 */
export const profileService = new ProfileService();

