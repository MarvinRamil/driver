import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/shared/hooks/use-theme';
import { BeeColors } from '@/constants/theme';
import { authService } from '../services/authService';
import { registrationService, type RegistrationStatus } from '../services/registrationService';
import { EmailVerificationScreen } from './EmailVerificationScreen';
import { ResumeRegistrationScreen } from './ResumeRegistrationScreen';
import { DriverLicenseScanner } from './DriverLicenseScanner';
import { SelfieCapture } from './SelfieCapture';
import { apiClient } from '@/shared/services/apiClient';

type RegistrationStep =
  | 'basic-info'
  | 'check-status'
  | 'email-verification'
  | 'resume-prompt'
  | 'license-scan'
  | 'selfie-capture'
  | 'review';

interface RegistrationData {
  email: string;
  password: string;
  fullName: string;
  licenseImageUri?: string;
  selfieImageUri?: string;
}

/**
 * Multi-step registration wizard component
 * Handles the complete driver registration flow with email verification
 */
export function RegistrationSteps() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const router = useRouter();

  const [currentStep, setCurrentStep] = useState<RegistrationStep>('basic-info');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registrationData, setRegistrationData] = useState<RegistrationData>({
    email: '',
    password: '',
    fullName: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [registrationStatus, setRegistrationStatus] = useState<RegistrationStatus | null>(null);

  // Registration status is checked once when user clicks Continue (see handleSubmitBasicInfo).
  // We do not check on every keystroke to avoid many API calls and exposing partial emails in logs/URLs.

  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validateForm = (): string | null => {
    if (!registrationData.fullName || registrationData.fullName.trim().length < 2) {
      return 'Please enter your full name (at least 2 characters)';
    }
    if (!registrationData.email || !isValidEmail(registrationData.email)) {
      return 'Please enter a valid email address';
    }
    if (!registrationData.password || registrationData.password.length < 8) {
      return 'Password must be at least 8 characters';
    }
    const hasUpperCase = /[A-Z]/.test(registrationData.password);
    const hasLowerCase = /[a-z]/.test(registrationData.password);
    const hasNumber = /[0-9]/.test(registrationData.password);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(registrationData.password);

    if (!(hasUpperCase && hasLowerCase && hasNumber && hasSpecial)) {
      return 'Password must contain uppercase, lowercase, number, and special character';
    }
    if (registrationData.password !== confirmPassword) {
      return 'Passwords do not match';
    }
    return null;
  };

  const handleSubmitBasicInfo = async () => {
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Check registration status once when user submits (not on every keystroke).
      // Backend should rate-limit this endpoint to prevent email enumeration.
      // NOTE: Backend returns same structure whether user exists or not, so we can't distinguish
      // between "user doesn't exist" vs "user exists but not verified". We'll try registration
      // and handle "already exists" error if it occurs.
      let status: RegistrationStatus | null = null;
      try {
        status = await registrationService.checkRegistrationStatus(registrationData.email.trim());
        setRegistrationStatus(status);
      } catch (statusErr) {
        console.warn('[RegistrationSteps] Status check failed, proceeding to register:', statusErr);
      }

      // Only handle status if we have clear indicators that user exists
      if (status) {
        // User is fully registered - redirect to login
        if (status.registrationComplete) {
          console.log('[RegistrationSteps] Email already registered, showing alert');
          Alert.alert(
            'Account Exists',
            'This email is already registered. Please login instead.',
            [
              {
                text: 'Go to Login',
                onPress: () => router.replace('/login'),
              },
            ]
          );
          setIsLoading(false);
          return;
        }

        // User exists, email verified, but registration incomplete - resume
        if (status.emailVerified && !status.registrationComplete && status.canResume) {
          console.log('[RegistrationSteps] Resuming incomplete registration');
          setCurrentStep('resume-prompt');
          setIsLoading(false);
          return;
        }

        // If status shows emailVerified=false, it could mean:
        // 1. User doesn't exist (backend returns all false)
        // 2. User exists but not verified
        // We can't distinguish, so we'll try registration and handle errors
      }

      // Try to register new account
      // If user already exists, backend will return "Email already registered" error
      console.log('[RegistrationSteps] Calling auth/register for', registrationData.email.trim());
      try {
        const response = await authService.register({
          email: registrationData.email.trim(),
          password: registrationData.password,
          fullName: registrationData.fullName.trim(),
          role: 'Driver',
        });

        console.log('[RegistrationSteps] Register response:', JSON.stringify(response, null, 2));

        // Registration successful - proceed to email verification
        if (response.requiresEmailVerification || response.message?.includes('verify')) {
          console.log('[RegistrationSteps] Registration successful, moving to email-verification step');
          setCurrentStep('email-verification');
        } else {
          console.log('[RegistrationSteps] Registration successful, moving to license-scan step');
          setCurrentStep('license-scan');
        }
      } catch (registerErr) {
        // Registration failed - check if it's because email already exists
        const errorMessage = registerErr instanceof Error ? registerErr.message : String(registerErr);
        console.log('[RegistrationSteps] Register failed:', errorMessage);

        // If email already exists, check status again to see if we can resume or need verification
        // Backend returns: "This email is already registered. Please use a different email or sign in."
        if (
          errorMessage.toLowerCase().includes('already registered') ||
          errorMessage.toLowerCase().includes('already exists')
        ) {
          // Re-check status now that we know user exists
          try {
            const existingStatus = await registrationService.checkRegistrationStatus(
              registrationData.email.trim()
            );
            setRegistrationStatus(existingStatus);

            if (existingStatus.emailVerified && !existingStatus.registrationComplete) {
              console.log('[RegistrationSteps] User exists and email verified, resuming registration');
              setCurrentStep('resume-prompt');
              setIsLoading(false);
              return;
            } else if (!existingStatus.emailVerified) {
              console.log('[RegistrationSteps] User exists but email not verified, showing verification step');
              setCurrentStep('email-verification');
              setIsLoading(false);
              return;
            }
          } catch (statusErr) {
            // Status check failed, show generic error
            console.error('[RegistrationSteps] Failed to check status after registration error:', statusErr);
            setError(errorMessage);
            setIsLoading(false);
            return;
          }
        }

        // Other registration errors - show error message
        setError(errorMessage);
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Registration failed. Please try again.';
      console.error('[RegistrationSteps] Submit error:', errorMessage, err);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailVerified = () => {
    // After email verification, redirect to login
    // User will complete registration after logging in
    Alert.alert(
      'Email Verified',
      'Your email has been verified successfully. Please login to continue with your registration.',
      [
        {
          text: 'Go to Login',
          onPress: () => router.replace('/login'),
        },
      ]
    );
  };

  const handleResumeRegistration = () => {
    setCurrentStep('license-scan');
  };

  const handleLicenseScanned = (imageUri: string) => {
    setRegistrationData({
      ...registrationData,
      licenseImageUri: imageUri,
    });
    setCurrentStep('selfie-capture');
  };

  const handleSelfieCaptured = (imageUri: string) => {
    setRegistrationData({
      ...registrationData,
      selfieImageUri: imageUri,
    });
    setCurrentStep('review');
  };

  const handleCompleteRegistration = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Create FormData for file upload
      const formData = new FormData();

      // Add email (required for backend to identify user)
      formData.append('email', registrationData.email);

      // Add license image
      if (registrationData.licenseImageUri) {
        const licenseFile = {
          uri: registrationData.licenseImageUri,
          type: 'image/jpeg',
          name: 'license.jpg',
        } as any;
        formData.append('licenseImage', licenseFile);
      }

      // Add selfie image
      if (registrationData.selfieImageUri) {
        const selfieFile = {
          uri: registrationData.selfieImageUri,
          type: 'image/jpeg',
          name: 'selfie.jpg',
        } as any;
        formData.append('selfieImage', selfieFile);
      }


      // Complete registration
      const response = await apiClient.post('api/auth/register/driver/complete', {
        body: formData,
        requiresAuth: false,
      });

      if (!response.success) {
        throw new Error(response.message || 'Failed to complete registration');
      }

      Alert.alert(
        'Registration Complete',
        'Your driver account has been created successfully. Please login to continue.',
        [
          {
            text: 'Go to Login',
            onPress: () => router.replace('/login'),
          },
        ]
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to complete registration. Please try again.';
      setError(errorMessage);
      Alert.alert('Error', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Render current step
  if (currentStep === 'email-verification') {
    return (
      <EmailVerificationScreen
        email={registrationData.email}
        onVerified={handleEmailVerified}
        onBack={() => setCurrentStep('basic-info')}
      />
    );
  }

  if (currentStep === 'resume-prompt') {
    return (
      <ResumeRegistrationScreen
        email={registrationData.email}
        onContinue={handleResumeRegistration}
        onBack={() => setCurrentStep('basic-info')}
      />
    );
  }

  if (currentStep === 'license-scan') {
    return (
      <DriverLicenseScanner
        onLicenseScanned={handleLicenseScanned}
        onBack={() => setCurrentStep('basic-info')}
      />
    );
  }

  if (currentStep === 'selfie-capture') {
    return (
      <SelfieCapture
        onSelfieCaptured={handleSelfieCaptured}
        onBack={() => setCurrentStep('license-scan')}
      />
    );
  }

  if (currentStep === 'review') {
    return (
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: theme.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
        <View style={[styles.content, { paddingTop: insets.top }]}>
          <ScrollView
            contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
            showsVerticalScrollIndicator={false}>
            {/* Header */}
            <View style={styles.headerContainer}>
              <TouchableOpacity style={styles.backButton} onPress={() => setCurrentStep('selfie-capture')}>
                <Ionicons name="arrow-back" size={24} color={theme.text} />
              </TouchableOpacity>
              <Text style={[styles.headline, { color: theme.text }]}>Review & Submit</Text>
              <Text style={[styles.subheadline, { color: theme.textSecondary }]}>
                Please review your information before submitting
              </Text>
            </View>

            {/* Review Content */}
            <View style={styles.reviewContainer}>
              <View style={[styles.reviewSection, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Personal Information</Text>
                <View style={styles.reviewItem}>
                  <Text style={[styles.reviewLabel, { color: theme.textSecondary }]}>Full Name</Text>
                  <Text style={[styles.reviewValue, { color: theme.text }]}>{registrationData.fullName}</Text>
                </View>
                <View style={styles.reviewItem}>
                  <Text style={[styles.reviewLabel, { color: theme.textSecondary }]}>Email</Text>
                  <Text style={[styles.reviewValue, { color: theme.text }]}>{registrationData.email}</Text>
                </View>
              </View>

              {registrationData.licenseImageUri && (
                <View style={[styles.reviewSection, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <Text style={[styles.sectionTitle, { color: theme.text }]}>License Photo</Text>
                  <Image source={{ uri: registrationData.licenseImageUri }} style={styles.reviewImage} />
                </View>
              )}

              {registrationData.selfieImageUri && (
                <View style={[styles.reviewSection, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <Text style={[styles.sectionTitle, { color: theme.text }]}>Selfie</Text>
                  <Image source={{ uri: registrationData.selfieImageUri }} style={styles.reviewImage} />
                </View>
              )}
            </View>

            {/* Error Message */}
            {error && (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={16} color={BeeColors.red[600]} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.submitButton, isLoading && styles.submitButtonDisabled, { backgroundColor: theme.primary }]}
              onPress={handleCompleteRegistration}
              disabled={isLoading}>
              {isLoading ? (
                <ActivityIndicator size="small" color={theme.primaryText} />
              ) : (
                <Text style={[styles.submitButtonText, { color: theme.primaryText }]}>Submit Registration</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // Basic Info Step (default)
  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
      <View style={[styles.content, { paddingTop: insets.top }]}>
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          {/* Header */}
          <View style={styles.headerContainer}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={24} color={theme.text} />
            </TouchableOpacity>
            <Text style={[styles.headline, { color: theme.text }]}>Create Driver Account</Text>
            <Text style={[styles.subheadline, { color: theme.textSecondary }]}>
              Sign up to start accepting bookings
            </Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {/* Full Name */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.text }]}>Full Name</Text>
              <View style={[styles.inputContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <TextInput
                  style={[styles.input, { color: theme.text }]}
                  placeholder="Enter your full name"
                  placeholderTextColor={theme.placeholder}
                  value={registrationData.fullName}
                  onChangeText={(text) => {
                    setRegistrationData({ ...registrationData, fullName: text });
                    setError(null);
                  }}
                  autoCapitalize="words"
                  autoCorrect={false}
                  editable={!isLoading}
                />
              </View>
            </View>

            {/* Email */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.text }]}>Email Address</Text>
              <View style={[styles.inputContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <TextInput
                  style={[styles.input, { color: theme.text }]}
                  placeholder="Enter your email"
                  placeholderTextColor={theme.placeholder}
                  value={registrationData.email}
                  onChangeText={(text) => {
                    setRegistrationData({ ...registrationData, email: text });
                    setError(null);
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isLoading}
                />
              </View>
              {registrationStatus && (
                <View style={styles.statusIndicator}>
                  {registrationStatus.registrationComplete ? (
                    <Text style={[styles.statusText, { color: theme.info }]}>
                      Account exists. Please login instead.
                    </Text>
                  ) : registrationStatus.emailVerified ? (
                    <Text style={[styles.statusText, { color: theme.success }]}>
                      Email verified. You can continue registration.
                    </Text>
                  ) : (
                    <Text style={[styles.statusText, { color: theme.warning }]}>
                      Email not verified. Verification email will be sent.
                    </Text>
                  )}
                </View>
              )}
            </View>

            {/* Password */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.text }]}>Password</Text>
              <View style={[styles.inputContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <TextInput
                  style={[styles.input, { color: theme.text }]}
                  placeholder="Enter your password"
                  placeholderTextColor={theme.placeholder}
                  value={registrationData.password}
                  onChangeText={(text) => {
                    setRegistrationData({ ...registrationData, password: text });
                    setError(null);
                  }}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isLoading}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.visibilityButton}>
                  <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={24} color={theme.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Confirm Password */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.text }]}>Confirm Password</Text>
              <View style={[styles.inputContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <TextInput
                  style={[styles.input, { color: theme.text }]}
                  placeholder="Confirm your password"
                  placeholderTextColor={theme.placeholder}
                  value={confirmPassword}
                  onChangeText={(text) => {
                    setConfirmPassword(text);
                    setError(null);
                  }}
                  secureTextEntry={!showConfirmPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isLoading}
                />
                <TouchableOpacity
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={styles.visibilityButton}>
                  <Ionicons
                    name={showConfirmPassword ? 'eye-off' : 'eye'}
                    size={24}
                    color={theme.textSecondary}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Error Message */}
            {error && (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={16} color={BeeColors.red[600]} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {/* Submit Button */}
            <TouchableOpacity
              style={[
                styles.submitButton,
                isLoading && styles.submitButtonDisabled,
                { backgroundColor: theme.primary },
              ]}
              onPress={handleSubmitBasicInfo}
              disabled={isLoading}>
              {isLoading ? (
                <ActivityIndicator size="small" color={theme.primaryText} />
              ) : (
                <Text style={[styles.submitButtonText, { color: theme.primaryText }]}>Continue</Text>
              )}
            </TouchableOpacity>

            {/* Login Link */}
            <View style={styles.loginContainer}>
              <Text style={[styles.loginText, { color: theme.textMuted }]}>
                Already have an account?{' '}
                <Text style={[styles.loginLink, { color: theme.text }]} onPress={() => router.replace('/login')}>
                  Log In
                </Text>
              </Text>
            </View>
          </View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
  },
  headerContainer: {
    paddingTop: 16,
    paddingBottom: 24,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  headline: {
    fontSize: 32,
    fontWeight: '700',
    lineHeight: 40,
    marginBottom: 8,
  },
  subheadline: {
    fontSize: 14,
    fontWeight: '500',
  },
  form: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    marginTop: 24,
  },
  inputGroup: {
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 15,
    height: 56,
  },
  input: {
    flex: 1,
    fontSize: 16,
  },
  visibilityButton: {
    padding: 4,
  },
  statusIndicator: {
    marginTop: 4,
    paddingHorizontal: 16,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BeeColors.red[50],
    borderWidth: 1,
    borderColor: BeeColors.red[200],
    borderRadius: 8,
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 12,
    gap: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: BeeColors.red[700],
  },
  submitButton: {
    width: '100%',
    maxWidth: 480,
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginHorizontal: 16,
    marginTop: 12,
    shadowColor: BeeColors.yellow[500],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  loginContainer: {
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 24,
    marginTop: 16,
  },
  loginText: {
    fontSize: 14,
  },
  loginLink: {
    fontSize: 14,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  reviewContainer: {
    gap: 16,
    marginTop: 24,
  },
  reviewSection: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  reviewItem: {
    marginBottom: 12,
  },
  reviewLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 4,
  },
  reviewValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  reviewImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginTop: 8,
  },
});
