import React from 'react';
import { RegistrationSteps } from '@/features/auth/components/RegistrationSteps';

/**
 * Signup screen component
 * Uses the multi-step RegistrationSteps component for complete registration flow
 * Includes email verification, license scanning, and selfie capture
 */
export default function SignupScreen() {
  return <RegistrationSteps />;
}

