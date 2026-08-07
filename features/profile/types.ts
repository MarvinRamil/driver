/**
 * Profile feature-specific types
 */

/**
 * Update profile request payload
 */
export interface UpdateProfileRequest {
  /** Full name */
  fullName?: string;
  /** Email address (not updatable via auth/profile on backend) */
  email?: string;
  /** Phone number */
  phoneNumber?: string;
  /** Address */
  address?: string;
  /** Vehicle plate (driver) */
  vehiclePlate?: string;
  /** Vehicle model (driver) */
  vehicleModel?: string;
  /** Vehicle color (driver) */
  vehicleColor?: string;
  // Vehicle type is intentionally absent: it is fixed when the driver application is
  // approved (validated against the vehicle pricing table) and is not self-editable.
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

