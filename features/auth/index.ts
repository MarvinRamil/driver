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

// Export services
export { authService } from './services/authService';
export { tokenService } from './services/tokenService';

// Export types
export type {
  AuthResponse,
  AuthState,
  BusinessType,
  LoginCredentials,
  LoginRequest,
  LoginResponse,
  RefreshTokenResponse,
  User,
  UserRole
} from './types';

// Export utilities
export { isAllowedRole, getRoleRestrictionMessage } from './utils/roleValidation';

