import { useAuth, useSignIn } from '@clerk/clerk-expo';
import { useCallback, useState } from 'react';

/**
 * Step in the Clerk-backed password reset flow.
 * - `request`: enter email; Clerk emails a reset code.
 * - `reset`: enter the code + a new password; on success Clerk signs the user in.
 */
export type ClerkPasswordResetStep = 'request' | 'reset';

export interface UseClerkPasswordResetReturn {
  step: ClerkPasswordResetStep;

  email: string;
  setEmail: (v: string) => void;
  code: string;
  setCode: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  confirmPassword: string;
  setConfirmPassword: (v: string) => void;

  error: string | null;
  clearError: () => void;
  isReady: boolean;
  isRequesting: boolean;
  isResetting: boolean;

  requestReset: () => Promise<void>;
  submitNewPassword: () => Promise<void>;
  resendCode: () => Promise<void>;
  backToRequest: () => void;
}

function extractClerkError(err: unknown): string {
  if (
    err &&
    typeof err === 'object' &&
    'errors' in err &&
    Array.isArray((err as { errors?: unknown }).errors)
  ) {
    const first = (err as { errors: { longMessage?: string; message?: string }[] }).errors[0];
    return first?.longMessage || first?.message || 'Something went wrong. Please try again.';
  }
  if (err instanceof Error) {
    return err.message;
  }
  return 'Something went wrong. Please try again.';
}

/** Validate a new password against the standard policy; returns an error string or null. */
function validatePassword(password: string): string | null {
  if (password.length < 8) return 'Password must be at least 8 characters long';
  if (!/\d/.test(password)) return 'Password must contain at least one digit (0-9)';
  if (!/[a-z]/.test(password)) return 'Password must contain at least one lowercase letter (a-z)';
  if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter (A-Z)';
  if (!/[^a-zA-Z0-9]/.test(password)) return 'Password must contain at least one special character (!@#$%^&* etc.)';
  return null;
}

/**
 * Clerk-native "forgot password" for the driver app: request a reset code by
 * email, then set a new password with that code. Replaces the legacy backend OTP
 * + security-question recovery. On success Clerk activates a session, so the root
 * guard redirects into the app.
 */
export function useClerkPasswordReset(): UseClerkPasswordResetReturn {
  const { isLoaded, signIn, setActive } = useSignIn();
  const { isSignedIn, signOut } = useAuth();

  const [step, setStep] = useState<ClerkPasswordResetStep>('request');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [isRequesting, setIsRequesting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const clearError = useCallback(() => setError(null), []);

  const requestReset = useCallback(async () => {
    setError(null);
    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }
    if (!isLoaded || !signIn) {
      setError('Password reset is not ready yet. Please try again in a moment.');
      return;
    }
    setIsRequesting(true);
    try {
      // Single-session: a leftover session blocks signIn.create. Clear it first.
      if (isSignedIn) {
        await signOut();
      }
      await signIn.create({
        strategy: 'reset_password_email_code',
        identifier: email.trim().toLowerCase(),
      });
      setStep('reset');
    } catch (err) {
      setError(extractClerkError(err));
    } finally {
      setIsRequesting(false);
    }
  }, [email, isLoaded, signIn, isSignedIn, signOut]);

  const submitNewPassword = useCallback(async () => {
    setError(null);
    if (!isLoaded || !signIn) {
      setError('Password reset is not ready yet. Please try again in a moment.');
      return;
    }
    if (code.trim().length === 0) {
      setError('Please enter the reset code from your email.');
      return;
    }
    const pwError = validatePassword(password);
    if (pwError) {
      setError(pwError);
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsResetting(true);
    try {
      const result = await signIn.attemptFirstFactor({
        strategy: 'reset_password_email_code',
        code: code.trim(),
        password,
      });
      if (result.status === 'complete' && result.createdSessionId) {
        // New password set; Clerk signs the user in. Root guard redirects.
        await setActive({ session: result.createdSessionId });
      } else {
        // e.g. needs_second_factor (MFA) — not enabled on the free tier.
        setError('Additional verification is required and is not available yet.');
      }
    } catch (err) {
      setError(extractClerkError(err));
    } finally {
      setIsResetting(false);
    }
  }, [code, password, confirmPassword, isLoaded, signIn, setActive]);

  const resendCode = useCallback(async () => {
    setError(null);
    if (!isLoaded || !signIn) {
      return;
    }
    setIsRequesting(true);
    try {
      await signIn.create({
        strategy: 'reset_password_email_code',
        identifier: email.trim().toLowerCase(),
      });
    } catch (err) {
      setError(extractClerkError(err));
    } finally {
      setIsRequesting(false);
    }
  }, [email, isLoaded, signIn]);

  const backToRequest = useCallback(() => {
    setStep('request');
    setCode('');
    setError(null);
  }, []);

  return {
    step,
    email,
    setEmail,
    code,
    setCode,
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    error,
    clearError,
    isReady: isLoaded,
    isRequesting,
    isResetting,
    requestReset,
    submitNewPassword,
    resendCode,
    backToRequest,
  };
}
