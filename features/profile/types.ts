/**
 * Profile feature-specific types
 */

/**
 * Update profile request payload
 */
export interface UpdateProfileRequest {
  /** Full name */
  fullName?: string;
  /** Email address */
  email?: string;
  /** Phone number */
  phoneNumber?: string;
  /** Address */
  address?: string;
}

/**
 * Update profile response
 */
export interface UpdateProfileResponse {
  /** Updated user data */
  user: {
    id: string;
    email: string;
    fullName: string;
    phoneNumber?: string;
    address?: string;
  };
  /** Success message */
  message: string;
}

