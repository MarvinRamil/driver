/**
 * Auth feature public API
 * This file exports all public components, hooks, services, and types from the auth feature
 * Other features should import from this file, not from internal paths
 */

// Export context
export { AuthProvider, useAuthContext } from './context/AuthContext';

// Export hooks
export { useAuth } from './hooks/useAuth';
export { useLogin } from './hooks/useLogin';
// Clerk-native password reset (email-code). Replaces legacy backend OTP + security-question recovery.
export { useClerkPasswordReset } from './hooks/useClerkPasswordReset';
export type {
  ClerkPasswordResetStep,
  UseClerkPasswordResetReturn
} from './hooks/useClerkPasswordReset';

// Export services
export { authService } from './services/authService';
export { tokenService } from './services/tokenService';
export { registrationService } from './services/registrationService';

// Export types
export type {
  AuthResponse,
  AuthState,
  BusinessType,
  LoginCredentials,
  LoginRequest,
  LoginResponse,
  RefreshTokenResponse,
  RegisterRequest,
  RegisterResponse,
  User,
  UserRole
} from './types';

// Export registration types
export type { RegistrationStatus } from './services/registrationService';

// Export utilities
export { isAllowedRole, getRoleRestrictionMessage } from './utils/roleValidation';

