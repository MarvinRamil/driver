import { useAuthContext } from '../context/AuthContext';

/**
 * Custom hook to access authentication state and methods
 * Provides convenient access to auth context
 * @returns AuthContextValue with user, auth state, and methods
 * @throws Error if used outside AuthProvider
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { user, isAuthenticated, login, logout } = useAuth();
 *
 *   if (!isAuthenticated) {
 *     return <LoginScreen />;
 *   }
 *
 *   return <Dashboard user={user} />;
 * }
 * ```
 */
export function useAuth() {
  return useAuthContext();
}

