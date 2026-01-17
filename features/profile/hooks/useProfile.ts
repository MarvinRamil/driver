import { useAuth } from '@/features/auth';
import { useCallback, useState } from 'react';
import { profileService } from '../services/profileService';
import type { UpdateProfileRequest } from '../types';

/**
 * Return type for useProfile hook
 */
interface UseProfileReturn {
  /** Loading state */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
  /** Function to update profile */
  updateProfile: (data: UpdateProfileRequest) => Promise<void>;
  /** Function to change password */
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  /** Function to upload profile picture */
  uploadProfilePicture: (imageUri: string) => Promise<string>;
}

/**
 * Custom hook for profile management
 * Provides functions to update profile and change password
 * @returns Object containing loading state, error, and profile management functions
 */
export function useProfile(): UseProfileReturn {
  const { user, refreshUser } = useAuth();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Update user profile
   */
  const updateProfile = useCallback(async (data: UpdateProfileRequest) => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    setIsLoading(true);
    setError(null);

    try {
      await profileService.updateProfile(user.id, data);
      // Refresh user data in auth context
      await refreshUser();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update profile';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [user, refreshUser]);

  /**
   * Change user password
   */
  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    setIsLoading(true);
    setError(null);

    try {
      await profileService.changePassword(user.id, currentPassword, newPassword);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to change password';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  /**
   * Upload profile picture
   */
  const uploadProfilePicture = useCallback(async (imageUri: string) => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    setIsLoading(true);
    setError(null);

    try {
      const imageUrl = await profileService.uploadProfilePicture(user.id, imageUri);
      // Refresh user data to get updated profile picture
      await refreshUser();
      return imageUrl;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to upload profile picture';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [user, refreshUser]);

  return {
    isLoading,
    error,
    updateProfile,
    changePassword,
    uploadProfilePicture,
  };
}

