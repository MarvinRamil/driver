import { useCallback, useState } from 'react';
import { useAuth } from './useAuth';
import { LIMITS, PATTERNS } from '@/shared/constants/validation';

/**
 * Return type for useLogin hook
 */
interface UseLoginReturn {
  /** Email input value */
  email: string;
  /** Password input value */
  password: string;
  /** Loading state */
  isLoading: boolean;
  /** Error message */
  error: string | null;
  /** Set email value */
  setEmail: (email: string) => void;
  /** Set password value */
  setPassword: (password: string) => void;
  /** Handle login submission */
  handleLogin: () => Promise<void>;
  /** Clear error */
  clearError: () => void;
  /** Set error message (e.g. for biometric login errors) */
  setError: (message: string | null) => void;
}

/**
 * Custom hook for managing login form state and submission
 * Provides form state management, validation, and login functionality
 * @returns Object containing form state, handlers, and login function
 *
 * @example
 * ```tsx
 * function LoginScreen() {
 *   const { email, password, isLoading, error, setEmail, setPassword, handleLogin } = useLogin();
 *
 *   return (
 *     <View>
 *       <TextInput value={email} onChangeText={setEmail} />
 *       <TextInput value={password} onChangeText={setPassword} secureTextEntry />
 *       {error && <Text>{error}</Text>}
 *       <Button title="Login" onPress={handleLogin} disabled={isLoading} />
 *     </View>
 *   );
 * }
 * ```
 */
export function useLogin(): UseLoginReturn {
  const { login } = useAuth();
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Validate email or phone (PH format: 9XXXXXXXXX, 09XXXXXXXXX, 639XXXXXXXXX)
   */
  const isEmailOrPhone = useCallback((value: string): boolean => {
    const trimmed = value.trim();
    if (PATTERNS.EMAIL.test(trimmed)) return true;
    const digits = trimmed.replace(/\D/g, '');
    return (
      (digits.length === 10 && digits.startsWith('9')) ||
      (digits.length === 11 && digits.startsWith('09')) ||
      (digits.length === 12 && digits.startsWith('639'))
    );
  }, []);

  /**
   * Handle login form submission
   * Validates inputs and calls login API
   */
  const handleLogin = useCallback(async () => {
    // Clear previous errors
    setError(null);

    const identifier = email.trim();
    if (!identifier) {
      setError('Email or phone is required');
      return;
    }

    if (!isEmailOrPhone(identifier)) {
      setError('Please enter a valid email or phone number');
      return;
    }

    if (identifier.length > LIMITS.EMAIL) {
      setError(`Email or phone must be at most ${LIMITS.EMAIL} characters`);
      return;
    }

    // Validate password
    if (!password) {
      setError('Password is required');
      return;
    }

    setIsLoading(true);

    try {
      // Call login function from auth context
      await login(email.trim(), password);
      // Login successful - AuthContext will update user state
      // Clear password for security
      setPassword('');
    } catch (err) {
      // Handle login errors
      const errorMessage = err instanceof Error ? err.message : 'Login failed';
      console.error('Login error:', errorMessage);
      setError(errorMessage);
      // Clear password on error for security
      setPassword('');
    } finally {
      setIsLoading(false);
    }
  }, [email, password, login, isEmailOrPhone]);

  /**
   * Clear error message
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    email,
    password,
    isLoading,
    error,
    setEmail,
    setPassword,
    handleLogin,
    clearError,
    setError,
  };
}

