import { apiClient } from '@/shared/services/apiClient';

/**
 * Registration status response from backend
 */
export interface RegistrationStatus {
  emailVerified: boolean;
  registrationComplete: boolean;
  canResume: boolean;
  email?: string;
}

/**
 * Registration service for checking status and resuming incomplete registrations
 */
class RegistrationService {
  /**
   * Check registration status for an email
   * @param email - Email address to check
   * @returns Promise resolving to RegistrationStatus
   */
  async checkRegistrationStatus(email: string): Promise<RegistrationStatus> {
    try {
      const response = await apiClient.get<RegistrationStatus>('api/auth/registration-status', {
        params: { email: email.trim().toLowerCase() },
        requiresAuth: false,
      });

      if (!response.success || !response.data) {
        // If endpoint doesn't exist yet, return default status
        if (response.statusCode === 404) {
          return {
            emailVerified: false,
            registrationComplete: false,
            canResume: false,
          };
        }
        throw new Error(response.message || 'Failed to check registration status');
      }

      return response.data;
    } catch (error) {
      console.error('[RegistrationService] Error checking status:', error);
      // Return default status on error
      return {
        emailVerified: false,
        registrationComplete: false,
        canResume: false,
      };
    }
  }

  /**
   * Resend verification email
   * @param email - Email address
   * @returns Promise resolving to success message
   */
  async resendVerificationEmail(email: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await apiClient.post<{ success: boolean; message: string }>(
        'api/auth/resend-verification',
        {
          body: { email: email.trim().toLowerCase() },
          requiresAuth: false,
        }
      );

      if (!response.success) {
        throw new Error(response.message || 'Failed to resend verification email');
      }

      return {
        success: true,
        message: response.data?.message || response.message || 'Verification email sent',
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to resend verification email';
      return {
        success: false,
        message: errorMessage,
      };
    }
  }

  /**
   * Verify email with token
   * @param email - Email address
   * @param token - Verification token
   * @returns Promise resolving to success message
   */
  async verifyEmail(email: string, token: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await apiClient.post<{ success: boolean; message: string }>(
        'api/auth/verify-email',
        {
          body: {
            email: email.trim().toLowerCase(),
            token,
          },
          requiresAuth: false,
        }
      );

      if (!response.success) {
        throw new Error(response.message || 'Email verification failed');
      }

      return {
        success: true,
        message: response.data?.message || response.message || 'Email verified successfully',
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Email verification failed';
      return {
        success: false,
        message: errorMessage,
      };
    }
  }
}

/**
 * Singleton instance of registration service
 */
export const registrationService = new RegistrationService();
