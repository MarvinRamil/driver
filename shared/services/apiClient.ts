import type { ApiClientConfig, ApiError, ApiResponse, RequestConfig } from '@/shared/types/api';
import { tokenStorage } from './tokenStorage';

/**
 * API client configuration
 * Default base URL - should be configured via environment variables in production
 * Environment variables:
 *   - EXPO_PUBLIC_API_URL: Base URL for API (required)
 *   - EXPO_PUBLIC_API_DEBUG: Enable debug logging (optional, default: false)
 */
// Normalize base URL - remove trailing slashes and /api suffix if present
// Endpoints should include /api/ prefix themselves
const normalizeBaseURL = (url: string): string => {
  // Remove trailing slashes and /api suffix
  let normalized = url.replace(/\/+$/, '').replace(/\/api$/, '');
  return normalized;
};

const DEFAULT_CONFIG: ApiClientConfig = {
  baseURL: normalizeBaseURL(process.env.EXPO_PUBLIC_API_URL || 'https://localhost:5001'),
  defaultHeaders: {
    'Content-Type': 'application/json',
  },
};

// Enable debug logging if configured
const API_DEBUG = process.env.EXPO_PUBLIC_API_DEBUG === 'true';

/**
 * API Client class for making HTTP requests with automatic token injection
 * Handles authentication, error handling, and request/response transformation
 */
class ApiClient {
  private config: ApiClientConfig;

  /**
   * Create a new API client instance
   * @param config - API client configuration
   */
  constructor(config: Partial<ApiClientConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Get the full URL by combining base URL with endpoint
   * @param endpoint - API endpoint path
   * @returns Full URL string
   */
  private getUrl(endpoint: string): string {
    // Remove leading slash if present to avoid double slashes
    let cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
    
    // Ensure endpoint starts with 'api/' if it doesn't already
    // This handles both 'api/auth/login' and 'auth/login' formats
    // All endpoints should use /api/ prefix to match backend routes
    if (!cleanEndpoint.startsWith('api/')) {
      cleanEndpoint = `api/${cleanEndpoint}`;
    }
    
    const fullUrl = `${this.config.baseURL}/${cleanEndpoint}`;
    
    // Debug: Log URL construction for troubleshooting
    if (process.env.EXPO_PUBLIC_API_DEBUG === 'true') {
      console.log(`[API] URL Construction:`, {
        baseURL: this.config.baseURL,
        endpoint,
        cleanEndpoint,
        fullUrl,
      });
    }
    
    return fullUrl;
  }

  /**
   * Build query string from params object
   * @param params - Query parameters
   * @returns Query string
   */
  private buildQueryString(params: Record<string, string | number | boolean>): string {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      searchParams.append(key, String(value));
    });
    return searchParams.toString();
  }

  /**
   * Get request headers with authentication token if required
   * @param config - Request configuration
   * @param endpoint - API endpoint (for logging purposes)
   * @returns Headers object
   */
  private async getHeaders(config: RequestConfig = {}, endpoint?: string): Promise<HeadersInit> {
    const headers: Record<string, string> = {
      ...this.config.defaultHeaders,
      ...config.headers,
    };

    // Automatically inject token if auth is required (default: true)
    if (config.requiresAuth !== false) {
      const token = await tokenStorage.getAccessToken();
      if (token) {
        headers.Authorization = `Bearer ${token}`;
        // Always log token presence for location endpoints (critical for debugging)
        if (endpoint && endpoint.includes('/locations/')) {
          console.log('[API] ✓ Token found, Authorization header set');
          console.log('[API] Token length:', token.length);
          console.log('[API] Token preview:', token.substring(0, 30) + '...');
        } else if (process.env.EXPO_PUBLIC_API_DEBUG === 'true') {
          console.log('[API] Token found, Authorization header set');
        }
      } else {
        // Always log missing token - critical for debugging 401 errors
        console.error('[API] ⚠️ No token found for authenticated request');
        if (endpoint) {
          console.error('[API] Endpoint:', endpoint);
        }
        console.error('[API] Requires Auth:', config.requiresAuth !== false);
      }
    }

    return headers;
  }

  /**
   * Handle API errors and transform them into ApiError format
   * @param error - Error object
   * @param status - HTTP status code
   * @returns ApiError object
   */
  private handleError(error: unknown, status?: number): ApiError {
    if (error instanceof Error) {
      return {
        message: error.message,
        status,
      };
    }
    return {
      message: 'An unknown error occurred',
      status,
    };
  }

  /**
   * Make an HTTP request
   * @param method - HTTP method
   * @param endpoint - API endpoint
   * @param config - Request configuration
   * @returns Promise resolving to API response
   */
  private async request<T>(
    method: string,
    endpoint: string,
    config: RequestConfig = {}
  ): Promise<ApiResponse<T>> {
    const url = this.getUrl(endpoint);
    
    // Build URL with query parameters
    let fullUrl = url;
    if (config.params && Object.keys(config.params).length > 0) {
      const queryString = this.buildQueryString(config.params);
      fullUrl = `${url}?${queryString}`;
    }

    try {
      const headers = await this.getHeaders(config, endpoint);

      // Create fetch options
      const fetchOptions: RequestInit = {
        method,
        headers,
      };

      // Add body for methods that support it
      if (config.body && ['POST', 'PUT', 'PATCH'].includes(method)) {
        // Handle FormData (for file uploads) - don't stringify it
        if (config.body instanceof FormData) {
          fetchOptions.body = config.body;
          // Remove Content-Type header for FormData - browser will set it with boundary
          delete headers['Content-Type'];
        } else {
          fetchOptions.body = JSON.stringify(config.body);
        }
      }

      // Always log API calls for bookings and dispatches
      if (endpoint.includes('/bookings') || endpoint.includes('/dispatches')) {
        console.log(`[API] ===== API CALL =====`);
        console.log(`[API] Method: ${method}`);
        console.log(`[API] URL: ${fullUrl}`);
        console.log(`[API] Endpoint: ${endpoint}`);
        console.log(`[API] Base URL: ${this.config.baseURL}`);
        console.log(`[API] Requires Auth: ${config.requiresAuth !== false}`);
        if (config.body) {
          console.log(`[API] Request Body:`, config.body);
        }
        if (config.params) {
          console.log(`[API] Query Params:`, config.params);
        }
      }

      // Debug logging (if enabled via EXPO_PUBLIC_API_DEBUG)
      if (API_DEBUG) {
        console.log(`[API] ${method} ${fullUrl}`, {
          headers: Object.fromEntries(Object.entries(headers)),
          body: config.body,
        });
      }

      // Always log the API URL being called for login debugging
      if (endpoint.includes('/auth/login')) {
        console.log(`[API] Calling login endpoint: ${fullUrl}`);
        console.log(`[API] Base URL: ${this.config.baseURL}`);
      }

      // Always log location update calls for debugging
      if (endpoint.includes('/locations/')) {
        console.log(`[API] ===== Location API Call =====`);
        console.log(`[API] Method: ${method}`);
        console.log(`[API] Full URL: ${fullUrl}`);
        console.log(`[API] Endpoint: ${endpoint}`);
        console.log(`[API] Base URL: ${this.config.baseURL}`);
        console.log(`[API] Requires Auth: ${config.requiresAuth !== false}`);
        console.log(`[API] Has Authorization Header: ${!!headers.Authorization}`);
        if (headers.Authorization) {
          const tokenPreview = headers.Authorization.substring(0, 20) + '...';
          console.log(`[API] Authorization Header Preview: ${tokenPreview}`);
        }
        if (config.body) {
          console.log(`[API] Request Body:`, JSON.stringify(config.body, null, 2));
        }
      }

      // Make the request
      const response = await fetch(fullUrl, fetchOptions);

      // Debug logging for response
      if (API_DEBUG) {
        console.log(`[API] ${method} ${fullUrl} - Status: ${response.status}`);
      }

      // Parse response (handle both JSON and plain text)
      // Read response as text first, then try to parse as JSON
      const responseText = await response.text().catch(() => '');
      let data: any = {};
      const contentType = response.headers.get('content-type');
      
      if (contentType && contentType.includes('application/json') && responseText) {
        // Try to parse as JSON
        try {
          data = JSON.parse(responseText);
        } catch {
          // If JSON parsing fails, treat as plain text
          data = { message: responseText || `HTTP ${response.status}: ${response.statusText}` };
        }
      } else {
        // Handle plain text responses (e.g., 401 "Invalid credentials")
        data = { message: responseText || `HTTP ${response.status}: ${response.statusText}` };
      }

      // Always log errors for debugging
      if (!response.ok) {
        console.error(`[API] ✗ Error: ${method} ${fullUrl} - Status: ${response.status} ${response.statusText}`);
        // For 401 errors, log authentication details
        if (response.status === 401) {
          console.error(`[API] 401 Unauthorized - Authentication failed`);
          console.error(`[API]   Has Authorization Header: ${!!headers.Authorization}`);
          if (headers.Authorization) {
            const tokenPreview = headers.Authorization.substring(0, 30) + '...';
            console.error(`[API]   Token Preview: ${tokenPreview}`);
          } else {
            console.error(`[API]   ⚠️ No Authorization header found!`);
          }
          console.error(`[API]   Response:`, responseText);
        }
        // Log location API errors with more detail
        if (endpoint.includes('/locations/')) {
          console.error(`[API] Location API Error Details:`, {
            status: response.status,
            statusText: response.statusText,
            url: fullUrl,
            endpoint,
            responseText,
            parsedData: data,
            hasAuthHeader: !!headers.Authorization,
          });
        }
      } else if (endpoint.includes('/bookings') || endpoint.includes('/dispatches') || endpoint.includes('/locations/')) {
        console.log(`[API] ✓ Success: ${method} ${fullUrl} - Status: ${response.status}`);
      }

      // Handle error responses
      if (!response.ok) {
        // For 401 errors, the API may return plain text, so use data.message or the text itself
        const errorMessage = data.message || data.error || responseText || `HTTP ${response.status}: ${response.statusText}`;
        
        const error: ApiError = {
          message: typeof errorMessage === 'string' ? errorMessage : `HTTP ${response.status}: ${response.statusText}`,
          status: response.status,
          code: data.code,
          details: data,
        };
        throw error;
      }

      // Return successful response
      return {
        data: data as T,
        success: true,
        message: data.message,
        statusCode: response.status,
      };
    } catch (error) {
      // Log request failures only when API debug is enabled
      if (API_DEBUG) {
        console.error(`[API] Request failed: ${method} ${fullUrl}`, {
          error,
          errorType: typeof error,
          errorMessage: error instanceof Error ? error.message : String(error),
          errorName: error instanceof Error ? error.name : undefined,
        });
      }

      // Re-throw ApiError as-is
      if (error && typeof error === 'object' && 'message' in error && 'status' in error) {
        throw error;
      }

      // Transform other errors
      throw this.handleError(error);
    }
  }

  /**
   * Make a GET request
   * @param endpoint - API endpoint
   * @param config - Request configuration
   * @returns Promise resolving to API response
   */
  async get<T>(endpoint: string, config?: RequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>('GET', endpoint, config);
  }

  /**
   * Make a POST request
   * @param endpoint - API endpoint
   * @param config - Request configuration
   * @returns Promise resolving to API response
   */
  async post<T>(endpoint: string, config?: RequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>('POST', endpoint, config);
  }

  /**
   * Make a PUT request
   * @param endpoint - API endpoint
   * @param config - Request configuration
   * @returns Promise resolving to API response
   */
  async put<T>(endpoint: string, config?: RequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>('PUT', endpoint, config);
  }

  /**
   * Make a PATCH request
   * @param endpoint - API endpoint
   * @param config - Request configuration
   * @returns Promise resolving to API response
   */
  async patch<T>(endpoint: string, config?: RequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>('PATCH', endpoint, config);
  }

  /**
   * Make a DELETE request
   * @param endpoint - API endpoint
   * @param config - Request configuration
   * @returns Promise resolving to API response
   */
  async delete<T>(endpoint: string, config?: RequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>('DELETE', endpoint, config);
  }
}

/**
 * Default API client instance
 * Use this instance for all API calls throughout the application
 */
export const apiClient = new ApiClient();

