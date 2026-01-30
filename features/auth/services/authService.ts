import { apiClient } from '@/shared/services/apiClient';
import { tokenStorage } from '@/shared/services/tokenStorage';
import { isAllowedRole, getRoleRestrictionMessage } from '../utils/roleValidation';
import type {
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
  User,
  SendOtpRequest,
  VerifyOtpAndRegisterRequest,
  VerifyOtpAndRegisterResponse,
} from '../types';

/**
 * Authentication service for handling login, logout, and user session management
 * Provides methods for authenticating users and managing their sessions
 */
class AuthService {
  /**
   * Login user with email and password
   * Calls POST /api/auth/login endpoint
   * @param credentials - User login credentials (email and password)
   * @returns Promise resolving to LoginResponse with token and user data
   * @throws Error if login fails (invalid credentials, account deactivated, etc.)
   */
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    try {
      // Call login API endpoint
      const response = await apiClient.post<LoginResponse>('api/auth/login', {
        body: credentials,
        requiresAuth: false, // Login endpoint doesn't require authentication
      });
      
      // Log response for debugging
      console.log('[AuthService] Login response:', {
        success: response.success,
        statusCode: response.statusCode,
        hasData: !!response.data,
        dataKeys: response.data ? Object.keys(response.data) : [],
        message: response.message,
        userRole: response.data?.user?.role || response.data?.User?.role || response.data?.role,
        isSoloDriver: response.data?.user?.isSoloDriver || response.data?.User?.isSoloDriver,
      });

      // Check if request was successful
      if (!response.success || !response.data) {
        // Handle error response
        const errorMessage = response.message || 'Login failed';
        
        // Check for specific error cases based on status code
        if (response.statusCode === 401) {
          // Check error message for specific cases
          const errorText = typeof response.error === 'string' ? response.error : errorMessage;
          
          // Provide specific error messages
          if (errorText === 'Invalid credentials' || errorMessage === 'Invalid credentials') {
            throw new Error('Invalid email or password. Please check your credentials and try again.');
          }
          if (errorText === 'Account is deactivated' || errorMessage.includes('deactivated')) {
            throw new Error('Your account has been deactivated. Please contact support.');
          }
          if (errorText.includes('locked') || errorMessage.includes('locked')) {
            throw new Error('Account is temporarily locked due to too many failed login attempts. Please try again later.');
          }
          
          // Generic 401 error with helpful message
          throw new Error('Login failed. Please check your email and password, or contact support if the problem persists.');
        }
        
        // Handle 400 Bad Request (validation errors)
        if (response.statusCode === 400) {
          throw new Error(errorMessage || 'Validation error. Please check your input.');
        }
        
        throw new Error(errorMessage);
      }

      const loginData = response.data;

      // Handle both camelCase and PascalCase property names (backend might return either)
      const token = loginData.token || (loginData as any).Token;
      const expiration = loginData.expiration || (loginData as any).Expiration;
      const user = loginData.user || (loginData as any).User;

      // Validate that we have a token before storing
      if (!token) {
        console.error('[AuthService] Login response missing token. Response data:', loginData);
        throw new Error('Login response missing token');
      }

      // ROLE VALIDATION: Check if user has an allowed role before storing token
      // This prevents unauthorized users from getting a valid session
      if (!isAllowedRole(user)) {
        console.warn('[AuthService] Login rejected - user has unauthorized role:', {
          role: user?.role,
          isSoloDriver: user?.isSoloDriver,
          tenantId: user?.tenantId,
        });
        throw new Error(getRoleRestrictionMessage(user));
      }

      // Store token securely (only if role is allowed)
      await tokenStorage.setAccessToken(token);
      
      // Verify token was stored (for debugging)
      const storedToken = await tokenStorage.getAccessToken();
      if (storedToken) {
        console.log('[AuthService] ✓ Token stored successfully');
        console.log('[AuthService] Token preview:', storedToken.substring(0, 30) + '...');
      } else {
        console.error('[AuthService] ⚠️ Token storage failed - token not found after storing');
      }

      // Return normalized response with camelCase properties
      const normalizedResponse: LoginResponse = {
        token,
        expiration: expiration || new Date().toISOString(),
        user: user || (loginData as any).user,
      };

      // Note: API doesn't provide refresh token, so we only store access token
      // If refresh token becomes available, store it here

      return normalizedResponse;
    } catch (error) {
      // Clear any tokens that might have been stored (defensive cleanup)
      // This ensures no partial state remains on login failure
      try {
        await tokenStorage.clearAllTokens();
      } catch (clearError) {
        // Ignore errors when clearing tokens - we're already handling a login error
        console.warn('[AuthService] Failed to clear tokens after login error:', clearError);
      }

      // Log the actual error for debugging
      console.error('[AuthService] Login error details:', {
        error,
        errorType: typeof error,
        errorKeys: error && typeof error === 'object' ? Object.keys(error) : [],
        errorMessage: error instanceof Error ? error.message : String(error),
        hasStatus: error && typeof error === 'object' && 'status' in error,
        status: error && typeof error === 'object' && 'status' in error ? (error as { status?: number }).status : undefined,
      });

      // Handle ApiError with specific status codes
      if (error && typeof error === 'object' && 'status' in error) {
        const apiError = error as { status?: number; message?: string; details?: unknown };
        
        // Handle 401 Unauthorized
        if (apiError.status === 401) {
          const errorText = apiError.message || 'Login failed';
          
          // Check for specific error messages
          if (errorText === 'Invalid credentials' || errorText.includes('Invalid credentials')) {
            throw new Error('Invalid credentials');
          }
          if (errorText === 'Account is deactivated' || errorText.includes('deactivated')) {
            throw new Error('Account is deactivated');
          }
          
          throw new Error('Invalid credentials');
        }
        
        // Handle 400 Bad Request (validation errors)
        if (apiError.status === 400) {
          throw new Error(apiError.message || 'Validation error. Please check your input.');
        }

        // Handle other HTTP errors
        throw new Error(apiError.message || `Login failed (HTTP ${apiError.status})`);
      }

      // Handle network errors (no status code means network/fetch error)
      if (error instanceof Error) {
        const errorMessage = error.message.toLowerCase();
        
        // Network error or fetch failure
        if (errorMessage.includes('timeout') || errorMessage.includes('abort')) {
          throw new Error('Request timeout. Please check your connection and try again.');
        }
        if (
          errorMessage.includes('failed to fetch') ||
          errorMessage.includes('networkerror') ||
          errorMessage.includes('network request failed') ||
          errorMessage.includes('networkerror')
        ) {
          throw new Error('Network error. Please check your connection and ensure the API server is running.');
        }
        
        // Re-throw the original error message if it's informative
        throw error;
      }

      // Fallback for unknown error types
      console.error('[AuthService] Unknown error type:', error);
      throw new Error('Login failed. Please try again.');
    }
  }

  /**
   * Get current authenticated user information
   * Calls GET /api/auth/me endpoint
   * @returns Promise resolving to User object
   * @throws Error if user is not authenticated or token is invalid
   */
  async getCurrentUser(): Promise<User> {
    try {
      // Call /auth/me endpoint (requires authentication)
      const response = await apiClient.get<User>('/api/auth/me', {
        requiresAuth: true, // This endpoint requires authentication
      });

      // Check if request was successful
      if (!response.success || !response.data) {
        const errorMessage = response.message || 'Failed to get user information';
        
        // Handle 401 Unauthorized (token expired or invalid)
        if (response.statusCode === 401) {
          // Clear stored token
          await tokenStorage.clearAllTokens();
          throw new Error('Session expired. Please login again.');
        }
        
        throw new Error(errorMessage);
      }

      return response.data;
    } catch (error) {
      // Handle ApiError with 401 status
      if (
        error &&
        typeof error === 'object' &&
        'status' in error &&
        error.status === 401
      ) {
        // Clear stored token on 401
        await tokenStorage.clearAllTokens();
        throw new Error('Session expired. Please login again.');
      }

      // Re-throw with user-friendly message
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to get user information');
    }
  }

  /**
   * Logout user and clear all stored tokens
   * Clears tokens from secure storage
   * @returns Promise resolving when logout is complete
   */
  async logout(): Promise<void> {
    try {
      // Clear all stored tokens
      await tokenStorage.clearAllTokens();
    } catch (error) {
      throw new Error(
        `Failed to logout: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Check if user is currently authenticated
   * Checks for presence of access token
   * @returns Promise resolving to true if authenticated, false otherwise
   */
  async isAuthenticated(): Promise<boolean> {
    try {
      const token = await tokenStorage.getAccessToken();
      return token !== null && token.length > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Verify current session by checking token and fetching user
   * Useful for app initialization to check if user is still logged in
   * @returns Promise resolving to User if session is valid, null otherwise
   */
  async verifySession(): Promise<User | null> {
    try {
      // Check if token exists
      const hasToken = await this.isAuthenticated();
      if (!hasToken) {
        return null;
      }

      // Try to fetch current user
      const user = await this.getCurrentUser();
      return user;
    } catch (error) {
      // Session is invalid, clear tokens
      await tokenStorage.clearAllTokens();
      return null;
    }
  }

  /**
   * Register a new driver
   * Calls POST /api/auth/register endpoint
   * Only accepts "Driver" role - other roles are rejected
   * @param registrationData - Driver registration data (email, password, fullName)
   * @returns Promise resolving to RegisterResponse with success message
   * @throws Error if registration fails (email already exists, validation errors, etc.)
   */
  async register(registrationData: RegisterRequest): Promise<RegisterResponse> {
    try {
      // Enforce Driver role only - reject any other role
      if (registrationData.role !== 'Driver') {
        throw new Error('Only Driver role is allowed for driver registration');
      }

      // Call register API endpoint
      const response = await apiClient.post<RegisterResponse>('api/auth/register', {
        body: registrationData,
        requiresAuth: false, // Register endpoint doesn't require authentication
      });

      console.log('[AuthService] Register API response:', {
        success: response.success,
        statusCode: response.statusCode,
        message: response.message,
        data: response.data,
        fullResponse: JSON.stringify(response, null, 2),
      });

      // Check if request was successful
      if (!response.success) {
        const errorMessage = response.message || 'Registration failed';
        
        // Handle 400 Bad Request (validation errors, email already exists, etc.)
        if (response.statusCode === 400) {
          console.error('[AuthService] Registration failed with 400:', errorMessage);
          throw new Error(errorMessage || 'Validation error. Please check your input.');
        }
        
        console.error('[AuthService] Registration failed:', errorMessage);
        throw new Error(errorMessage);
      }

      console.log('[AuthService] Registration successful, returning:', response.data);
      return response.data || { message: 'User registered successfully' };
    } catch (error) {
      // Log the actual error for debugging
      console.error('[AuthService] Registration error details:', {
        error,
        errorType: typeof error,
        errorMessage: error instanceof Error ? error.message : String(error),
      });

      // Handle network errors
      if (error instanceof Error) {
        const errorMessage = error.message.toLowerCase();
        
        // Network error or fetch failure
        if (errorMessage.includes('timeout') || errorMessage.includes('abort')) {
          throw new Error('Request timeout. Please check your connection and try again.');
        }
        if (
          errorMessage.includes('failed to fetch') ||
          errorMessage.includes('networkerror') ||
          errorMessage.includes('network request failed')
        ) {
          throw new Error('Network error. Please check your connection and ensure the API server is running.');
        }
        
        // Re-throw the original error message if it's informative
        throw error;
      }

      // Fallback for unknown error types
      console.error('[AuthService] Unknown error type:', error);
      throw new Error('Registration failed. Please try again.');
    }
  }

  /**
   * Send OTP to email for verification (OTP-first registration)
   * POST /api/auth/send-otp
   */
  async sendOtp(request: SendOtpRequest): Promise<{ success: boolean; message: string }> {
    const response = await apiClient.post<{ success: boolean; message: string }>('api/auth/send-otp', {
      body: { email: request.email.trim().toLowerCase() },
      requiresAuth: false,
    });
    if (!response.success) {
      throw new Error(response.message || 'Failed to send verification code.');
    }
    return { success: true, message: response.message || 'Verification code sent.' };
  }

  /**
   * Resend OTP to email
   * POST /api/auth/resend-otp
   */
  async resendOtp(email: string): Promise<{ success: boolean; message: string }> {
    const response = await apiClient.post<{ success: boolean; message: string }>('api/auth/resend-otp', {
      body: { email: email.trim().toLowerCase() },
      requiresAuth: false,
    });
    if (!response.success) {
      throw new Error(response.message || 'Failed to resend verification code.');
    }
    return { success: true, message: response.message || 'New verification code sent.' };
  }

  /**
   * Verify OTP and create account (OTP-first registration)
   * On success: stores token and returns user (same as login).
   * POST /api/auth/verify-otp-and-register
   */
  async verifyOtpAndRegister(
    request: VerifyOtpAndRegisterRequest
  ): Promise<VerifyOtpAndRegisterResponse> {
    const response = await apiClient.post<{ data: VerifyOtpAndRegisterResponse }>(
      'api/auth/verify-otp-and-register',
      {
        body: {
          email: request.email.trim().toLowerCase(),
          otp: request.otp.trim(),
          password: request.password,
          fullName: request.fullName.trim(),
          role: request.role ?? 'Driver',
          referralCode: request.referralCode ?? undefined,
        },
        requiresAuth: false,
      }
    );

    const payload = (response.data as any)?.data ?? response.data;
    if (!response.success || !payload?.token || !payload?.user) {
      throw new Error(response.message || 'Verification failed. Please check the code and try again.');
    }

    const { token, user, expiration, refreshToken, refreshTokenExpiration } = payload;
    if (!isAllowedRole(user)) {
      throw new Error(getRoleRestrictionMessage(user));
    }

    await tokenStorage.setAccessToken(token);
    return {
      token,
      expiration: expiration ?? '',
      refreshToken,
      refreshTokenExpiration,
      user,
    };
  }
}

/**
 * Singleton instance of auth service
 * Use this instance throughout the application for authentication operations
 */
export const authService = new AuthService();

