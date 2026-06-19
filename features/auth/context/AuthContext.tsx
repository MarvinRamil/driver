import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useAuth as useClerkAuth, useSignIn } from "@clerk/clerk-expo";
import { authService } from "../services/authService";
// Import chatSignalRService directly to avoid circular dependency
import { chatSignalRService } from "@/features/support/services/chatSignalRService";
import { storeTempCredentialsForPrompt, clearTempCredentialsForPrompt } from "@/shared/services/biometricPromptStorage";
import { biometricStorage } from "@/shared/services/biometricStorage";
import { isAllowedRole, getRoleRestrictionMessage } from "../utils/roleValidation";
import { locationTrackingService } from "@/features/driver/services/locationTrackingService";
import { isClerkEnabled } from "@/shared/providers/AppClerkProvider";
import { setLastLoginUser } from "@/shared/services/lastLoginStorage";
import type { User } from "../types";

/**
 * Auth context value interface
 * Defines the shape of data and methods provided by AuthContext
 */
interface AuthContextValue {
  /** Current user information */
  user: User | null;
  /** Whether user is authenticated */
  isAuthenticated: boolean;
  /** Whether auth state is being checked */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
  /** Login function */
  login: (email: string, password: string) => Promise<void>;
  /** Logout function */
  logout: () => Promise<void>;
  /** Refresh user data from API */
  refreshUser: () => Promise<void>;
}

/**
 * Auth context
 * Provides authentication state and methods throughout the app
 */
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * AuthProvider component props
 */
interface AuthProviderProps {
  /** Child components */
  children: React.ReactNode;
}

/**
 * AuthProvider — selects the auth implementation at module load based on whether
 * Clerk is configured. The branch is stable for the app lifetime (driven by an env
 * constant), so hook order is never violated.
 */
export function AuthProvider({ children }: AuthProviderProps) {
  if (isClerkEnabled) {
    return <ClerkAuthProvider>{children}</ClerkAuthProvider>;
  }
  return <LegacyAuthProvider>{children}</LegacyAuthProvider>;
}

/**
 * LegacyAuthProvider — original custom-auth implementation (email/password +
 * refresh token in secure storage). Used when Clerk is disabled.
 */
function LegacyAuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Check if user is authenticated based on token presence
   */
  const isAuthenticated = user !== null;

  /**
   * Initialize auth state on mount
   * Checks for existing token and fetches user if token exists
   */
  useEffect(() => {
    /**
     * Initialize authentication state
     */
    const initializeAuth = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Verify session by checking token and fetching user
        const currentUser = await authService.verifySession();
        
        // ROLE VALIDATION: Check if user has an allowed role
        if (currentUser && !isAllowedRole(currentUser)) {
          console.warn('[AuthContext] Session rejected - user has unauthorized role:', {
            role: currentUser.role,
            isSoloDriver: currentUser.isSoloDriver,
            tenantId: currentUser.tenantId,
          });

          // Clear tokens and session since role is not allowed
          try {
            await authService.logout();
          } catch (logoutError) {
            console.warn("Failed to clear tokens after role rejection:", logoutError);
          }

          setUser(null);
          setError(getRoleRestrictionMessage(currentUser));
          return;
        }
        
        setUser(currentUser);

        if (currentUser) {
          await setLastLoginUser({
            email: currentUser.email,
            fullName: currentUser.fullName,
          });
        }

        // Initialize SignalR connection if user is authenticated
        if (currentUser) {
          try {
            await chatSignalRService.start();
          } catch (signalRErr) {
            console.warn("Failed to start SignalR:", signalRErr);
            // Don't fail auth if SignalR fails
          }
        }
      } catch (err) {
        // Session is invalid or error occurred (e.g. 401 after deploy - token from different API)
        setUser(null);
        const message =
          err instanceof Error
            ? err.message
            : err && typeof err === "object" && "status" in err && (err as { status: number }).status === 401
              ? "Session expired or invalid. Please sign in again."
              : "Failed to initialize auth";
        setError(message);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  /**
   * Login user with email and password
   * Validates that user has an allowed role before completing login
   * @param email - User email address
   * @param password - User password
   */
  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    setError(null);
    // Ensure user is cleared before attempting login
    setUser(null);

    try {
      // Call login API
      const loginResponse = await authService.login({ email, password });

      // ROLE VALIDATION: Check if user has an allowed role
      if (!isAllowedRole(loginResponse.user)) {
        console.warn('[AuthContext] Login rejected - user has unauthorized role:', {
          role: loginResponse.user.role,
          isSoloDriver: loginResponse.user.isSoloDriver,
          tenantId: loginResponse.user.tenantId,
        });

        // Clear tokens since login is rejected
        try {
          await authService.logout();
        } catch (logoutError) {
          console.warn("Failed to clear tokens after role rejection:", logoutError);
        }

        // Set error message and reject login
        const errorMessage = getRoleRestrictionMessage(loginResponse.user);
        setError(errorMessage);
        setUser(null);
        throw new Error(errorMessage);
      }

      // Set user from login response (only if role is allowed)
      setUser(loginResponse.user);
      await setLastLoginUser({
        email: loginResponse.user.email,
        fullName: loginResponse.user.fullName,
      });

      // Store temporary credentials for biometric prompt ONLY if biometric is not already enabled
      // (If user already has biometric enabled, they don't need the "Enable biometric?" prompt)
      try {
        const hasBiometricEnabled = await biometricStorage.hasStoredCredentials();
        if (!hasBiometricEnabled) {
          await storeTempCredentialsForPrompt(email, password);
          console.log('[AuthContext] Temporary credentials stored for biometric prompt');
        } else {
          console.log('[AuthContext] Biometric already enabled, skipping temp credentials storage');
        }
      } catch (tempError) {
        // Don't fail login if temp storage fails
        console.warn('[AuthContext] Failed to check/store temp credentials:', tempError);
      }
      
      // Initialize SignalR connection after successful login
      try {
        await chatSignalRService.start();
      } catch (signalRErr) {
        console.warn("Failed to start SignalR after login:", signalRErr);
        // Don't fail login if SignalR fails
      }
    } catch (err) {
      // Handle login errors - ensure tokens are cleared on failure
      const errorMessage = err instanceof Error ? err.message : "Login failed";
      setError(errorMessage);
      setUser(null);

      // Clear any tokens that might have been stored during failed login
      try {
        await authService.logout();
      } catch (logoutError) {
        // Ignore logout errors - we're already handling a login error
        console.warn("Failed to clear tokens after login error:", logoutError);
      }

      throw err; // Re-throw to allow caller to handle
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Logout user and clear session
   */
  const logout = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Stop location tracking before logout (await so no location API runs after we clear tokens)
      try {
        await locationTrackingService.stopTracking();
      } catch (locationErr) {
        console.warn("Failed to stop location tracking:", locationErr);
      }

      // Stop SignalR connection before logout
      try {
        await chatSignalRService.stop();
      } catch (signalRErr) {
        console.warn("Failed to stop SignalR:", signalRErr);
      }
      
      // Clear tokens and user data
      await authService.logout();

      // Clear cached biometric login so next login requires email/phone + password
      try {
        await biometricStorage.clearCredentials();
        await clearTempCredentialsForPrompt();
      } catch (biometricErr) {
        console.warn("Failed to clear biometric credentials on logout:", biometricErr);
      }

      setUser(null);
    } catch (err) {
      // Even if logout fails, clear local state
      setUser(null);
      setError(err instanceof Error ? err.message : "Logout failed");
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Refresh user data from API
   * Useful for updating user information after profile changes
   */
  const refreshUser = useCallback(async () => {
    if (!isAuthenticated) {
      return;
    }

    try {
      // Fetch current user from API
      const currentUser = await authService.getCurrentUser();
      setUser(currentUser);
      setError(null);
    } catch (err) {
      // If refresh fails, user might be logged out
      const errorMessage =
        err instanceof Error ? err.message : "Failed to refresh user";
      setError(errorMessage);

      // If session expired, clear user
      if (
        errorMessage.includes("Session expired") ||
        errorMessage.includes("Unauthorized")
      ) {
        setUser(null);
        await authService.logout();
      }
    }
  }, [isAuthenticated]);

  const value: AuthContextValue = {
    user,
    isAuthenticated,
    isLoading,
    error,
    login,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * ClerkAuthProvider — Clerk-backed implementation. Clerk owns the session; the app's
 * User (role, onboarding, etc.) is loaded from the backend `/api/auth/me` (Clerk token
 * supplied by the apiClient bridge). Driver role validation + SignalR are preserved.
 */
function ClerkAuthProvider({ children }: AuthProviderProps) {
  const { isLoaded, isSignedIn, signOut } = useClerkAuth();
  const { signIn, setActive, isLoaded: signInLoaded } = useSignIn();

  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const isAuthenticated = user !== null;

  // Load backend profile, enforce the driver role, then start SignalR.
  // Returns the user, or throws with a role-restriction message if not allowed.
  const loadBackendUser = useCallback(async (): Promise<User> => {
    const currentUser = await authService.getCurrentUser();
    if (!isAllowedRole(currentUser)) {
      await signOut();
      throw new Error(getRoleRestrictionMessage(currentUser));
    }
    setUser(currentUser);
    await setLastLoginUser({ email: currentUser.email, fullName: currentUser.fullName });
    try {
      await chatSignalRService.start();
    } catch (signalRErr) {
      console.warn("Failed to start SignalR:", signalRErr);
    }
    return currentUser;
  }, [signOut]);

  useEffect(() => {
    if (!isLoaded) {
      return;
    }
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      try {
        if (!isSignedIn) {
          setUser(null);
          if (!cancelled) setError(null);
          return;
        }
        // Signed into Clerk. The backend profile is created by the Clerk
        // `user.created` webhook, which can lag a second or two behind setActive
        // (e.g. right after registration). Retry /api/auth/me a few times before
        // giving up so a fresh sign-up isn't stranded on the verify screen.
        const maxAttempts = 6;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          if (cancelled) return;
          try {
            await loadBackendUser();
            if (!cancelled) setError(null);
            return;
          } catch (err) {
            if (attempt === maxAttempts) throw err;
            await new Promise((resolve) => setTimeout(resolve, 1500));
          }
        }
      } catch (err) {
        if (!cancelled) {
          setUser(null);
          setError(err instanceof Error ? err.message : "Failed to initialize auth");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, loadBackendUser]);

  const login = useCallback(
    async (email: string, password: string) => {
      if (!signInLoaded || !signIn) {
        throw new Error("Authentication is not ready yet. Please try again.");
      }
      setIsLoading(true);
      setError(null);
      setUser(null);
      try {
        const attempt = await signIn.create({ identifier: email, password });
        if (attempt.status !== "complete") {
          throw new Error("Additional verification is required to sign in.");
        }
        await setActive!({ session: attempt.createdSessionId });
        await loadBackendUser(); // throws if role not allowed (already signs out)
      } catch (err) {
        const message =
          (err as { errors?: { message?: string }[] })?.errors?.[0]?.message ??
          (err instanceof Error ? err.message : "Login failed");
        setError(message);
        setUser(null);
        throw new Error(message);
      } finally {
        setIsLoading(false);
      }
    },
    [signIn, setActive, signInLoaded, loadBackendUser],
  );

  const logout = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      try {
        await locationTrackingService.stopTracking();
      } catch (locationErr) {
        console.warn("Failed to stop location tracking:", locationErr);
      }
      try {
        await chatSignalRService.stop();
      } catch (signalRErr) {
        console.warn("Failed to stop SignalR:", signalRErr);
      }
      await signOut();
      try {
        await biometricStorage.clearCredentials();
        await clearTempCredentialsForPrompt();
      } catch (biometricErr) {
        console.warn("Failed to clear biometric credentials on logout:", biometricErr);
      }
      setUser(null);
    } catch (err) {
      setUser(null);
      setError(err instanceof Error ? err.message : "Logout failed");
    } finally {
      setIsLoading(false);
    }
  }, [signOut]);

  const refreshUser = useCallback(async () => {
    if (!isAuthenticated) {
      return;
    }
    try {
      const currentUser = await authService.getCurrentUser();
      setUser(currentUser);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to refresh user");
    }
  }, [isAuthenticated]);

  const value: AuthContextValue = {
    user,
    isAuthenticated,
    isLoading,
    error,
    login,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Custom hook to access auth context
 * @returns AuthContextValue with user, auth state, and methods
 * @throws Error if used outside AuthProvider
 */
export function useAuthContext(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuthContext must be used within an AuthProvider");
  }
  return context;
}

