/**
 * Authentication feature-specific types
 * These types match the API response structure
 */

/**
 * User role enumeration
 */
export type UserRole = "Admin" | "Owner" | "Driver" | "Client" | string;

/**
 * Business type enumeration
 */
export type BusinessType = "Fleet" | "Individual";

/**
 * Login request payload
 * Matches API POST /api/auth/login request body
 */
export interface LoginRequest {
  /** User email address */
  email: string;
  /** User password */
  password: string;
}

/**
 * Login response from API
 * Matches API POST /api/auth/login response
 */
export interface LoginResponse {
  /** JWT Bearer token for authenticated requests */
  token: string;
  /** Token expiration date/time (ISO 8601) */
  expiration: string;
  /** Current user information */
  user: User;
}

/**
 * User information
 * Matches API user object structure
 */
export interface User {
  /** User's unique identifier (Guid) */
  id: string;
  /** User's email address */
  email: string;
  /** User's full name */
  fullName: string;
  /** User's role (Admin, Owner, Driver, Client, etc.) */
  role: UserRole;
  /** Company/Tenant ID (Guid | null, null for customers) */
  tenantId: string | null;
  /** Whether user has completed onboarding */
  isOnboarded: boolean;
  /** Business type: "Fleet" or "Individual" (null if not set) */
  businessType: BusinessType | null;
  /** Whether driver is a solo/independent driver */
  isSoloDriver: boolean;
  /** Whether driver is currently online (for drivers only) */
  isOnline?: boolean;
  /** Profile picture URL (optional) */
  profilePictureUrl?: string | null;
}

/**
 * Authentication state
 * Used for managing auth state in context
 */
export interface AuthState {
  /** Whether user is authenticated */
  isAuthenticated: boolean;
  /** Current user information */
  user: User | null;
  /** Whether authentication is being checked */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
}

/**
 * Legacy type aliases for backward compatibility
 * @deprecated Use LoginRequest instead
 */
export type LoginCredentials = LoginRequest;

/**
 * Legacy AuthResponse type
 * @deprecated Use LoginResponse instead
 */
export interface AuthResponse {
  /** Access token (legacy name, maps to token) */
  accessToken: string;
  /** Refresh token (not provided by current API) */
  refreshToken?: string;
  /** Token expiration time in seconds (legacy) */
  expiresIn?: number;
  /** User information */
  user?: User;
}

/**
 * Token refresh response
 * Note: Refresh token endpoint not currently available in API
 */
export interface RefreshTokenResponse {
  /** New access token */
  accessToken: string;
  /** Optional new refresh token */
  refreshToken?: string;
  /** Token expiration time in seconds */
  expiresIn?: number;
}

/**
 * Register request payload
 * Matches API POST /api/auth/register request body
 * For drivers app, role is always "Driver"
 */
export interface RegisterRequest {
  /** User email address */
  email: string;
  /** User password */
  password: string;
  /** User full name */
  fullName: string;
  /** User role - must be "Driver" for drivers app */
  role: "Driver";
  /** Company ID (optional, for drivers under operators) */
  companyId?: string | null;
  /** Referral code (optional) */
  referralCode?: string | null;
}

/**
 * Register response from API
 * Matches API POST /api/auth/register response
 */
export interface RegisterResponse {
  /** Success message */
  message: string;
  /** Whether email verification is required */
  requiresEmailVerification?: boolean;
  /** Email address that was registered */
  email?: string;
}

/** OTP send request - POST /api/auth/send-otp */
export interface SendOtpRequest {
  email: string;
}

/** OTP verify only - POST /api/auth/verify-otp (then call register) */
export interface VerifyOtpRequest {
  email: string;
  otp: string;
}

/** OTP verify and register request - POST /api/auth/verify-otp-and-register (deprecated: use verify-otp + register + login) */
export interface VerifyOtpAndRegisterRequest {
  email: string;
  otp: string;
  password: string;
  fullName: string;
  role?: "Driver";
  referralCode?: string | null;
}

/** Response from verify-otp-and-register (same shape as login: token + user) */
export interface VerifyOtpAndRegisterResponse {
  token: string;
  expiration: string;
  refreshToken?: string;
  refreshTokenExpiration?: string;
  user: User;
}

/**
 * Complete driver registration request
 * Used after email verification to complete registration with documents
 */
export interface CompleteDriverRegistrationRequest {
  /** License image file (FormData) */
  licenseImage: File | Blob | string;
  /** Selfie image file (FormData) */
  selfieImage: File | Blob | string;
  /** Additional driver information (optional) */
  licenseNumber?: string;
  /** License expiry date (optional) */
  licenseExpiryDate?: string;
  /** Address (optional) */
  address?: string;
}

