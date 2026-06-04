import React, { useState, useEffect } from 'react';
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
  Modal,
  FlatList,
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
import { biometricStorage } from '@/shared/services/biometricStorage';
import { LIMITS, PATTERNS, trimToMax } from '@/shared/constants/validation';

type RegistrationStep =
  | 'email-entry'
  | 'email-otp'
  | 'enter-phone'
  | 'enter-otp'
  | 'enter-details'
  | 'enter-security-questions'
  | 'email-verification'
  | 'resume-prompt';

interface RegistrationData {
  email: string;
  phoneNumber: string;
  password: string;
  fullName: string;
  otp: string;
}

/**
 * Multi-step driver registration wizard.
 * Primary: email OTP → account details → security questions → register (Driver) → login.
 * Secondary: phone SMS OTP → same details flow → registerByPhone → login.
 * Post-login onboarding (liveness, documents) is handled outside this screen.
 */
export function RegistrationSteps() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const router = useRouter();

  const [currentStep, setCurrentStep] = useState<RegistrationStep>('email-entry');
  const [emailVerifiedViaOtp, setEmailVerifiedViaOtp] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registrationData, setRegistrationData] = useState<RegistrationData>({
    email: '',
    phoneNumber: '',
    password: '',
    fullName: '',
    otp: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [registrationStatus, setRegistrationStatus] = useState<RegistrationStatus | null>(null);

  // Security questions (required for account recovery)
  const [securityQuestionsList, setSecurityQuestionsList] = useState<Array<{ id: number; question: string }>>([]);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<[number | null, number | null, number | null]>([null, null, null]);
  const [questionAnswers, setQuestionAnswers] = useState<[string, string, string]>(['', '', '']);
  const [questionPickerIndex, setQuestionPickerIndex] = useState<number | null>(null);
  /** Token from verify-otp; sent with register so backend trusts OTP when cache is not shared (e.g. multiple API instances) */
  const [registrationToken, setRegistrationToken] = useState<string | null>(null);
  /** 10-minute countdown on OTP screen before resend is allowed (seconds left) */
  const OTP_RESEND_COOLDOWN_SECONDS = 10 * 60;
  const [otpResendSecondsLeft, setOtpResendSecondsLeft] = useState(0);

  useEffect(() => {
    authService.getSecurityQuestions().then(setSecurityQuestionsList).catch(() => {});
  }, []);

  // 10-minute countdown timer on OTP verification steps
  useEffect(() => {
    if ((currentStep !== 'enter-otp' && currentStep !== 'email-otp') || otpResendSecondsLeft <= 0) return;
    const id = setInterval(() => {
      setOtpResendSecondsLeft((prev) => (prev <= 0 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [currentStep, otpResendSecondsLeft]);

  const isValidEmail = (email: string): boolean => PATTERNS.EMAIL.test(email);

  const isValidPhone = (phone: string): boolean => PATTERNS.PHONE.test(phone);

  // Debounced registration-status check on email entry (not on every keystroke)
  useEffect(() => {
    if (currentStep !== 'email-entry') return;
    const email = registrationData.email.trim();
    if (!email || !isValidEmail(email)) {
      setRegistrationStatus(null);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const status = await registrationService.checkRegistrationStatus(email);
        setRegistrationStatus(status);
      } catch {
        setRegistrationStatus(null);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [registrationData.email, currentStep]);

  const knownSteps: RegistrationStep[] = [
    'email-entry',
    'email-otp',
    'enter-phone',
    'enter-otp',
    'enter-details',
    'enter-security-questions',
    'email-verification',
    'resume-prompt',
  ];
  useEffect(() => {
    if (!knownSteps.includes(currentStep)) {
      setCurrentStep('email-entry');
    }
  }, [currentStep]);

  /**
   * Normalize local PH mobile number input into international format for API calls.
   * - Accepts inputs like: 9XXXXXXXXX, 09XXXXXXXXX, 639XXXXXXXXX
   * - Returns: 639XXXXXXXXX
   */
  const normalizePhoneForApi = (raw: string): string => {
    const digits = raw.replace(/\D/g, '');
    if (!digits) return '';
    if (digits.startsWith('639') && digits.length === 12) {
      return digits;
    }
    if (digits.startsWith('09') && digits.length === 11) {
      return `63${digits.slice(1)}`;
    }
    if (digits.startsWith('9')) {
      return `63${digits}`;
    }
    return `63${digits}`;
  };

  /** Validates full name and password only (Step 1 of account creation) */
  const validateBasicDetailsForm = (): string | null => {
    if (!registrationData.fullName || registrationData.fullName.trim().length < 2) {
      return 'Please enter your full name (at least 2 characters)';
    }
    if (registrationData.fullName.trim().length > LIMITS.FULL_NAME) {
      return `Full name must be at most ${LIMITS.FULL_NAME} characters`;
    }
    if (!registrationData.password || registrationData.password.length < LIMITS.PASSWORD_MIN) {
      return `Password must be at least ${LIMITS.PASSWORD_MIN} characters`;
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

  /** Validates full form including security questions (Step 2) */
  const validateForm = (): string | null => {
    const basicError = validateBasicDetailsForm();
    if (basicError) return basicError;
    for (let i = 0; i < 3; i++) {
      if (!selectedQuestionIds[i]) return `Please select security question ${i + 1}`;
      if (!questionAnswers[i] || questionAnswers[i].trim().length < LIMITS.SECURITY_ANSWER_MIN) {
        return `Please provide an answer for security question ${i + 1} (at least ${LIMITS.SECURITY_ANSWER_MIN} characters)`;
      }
    }
    return null;
  };

  const buildSecurityQuestionsPayload = () => ({
    securityQuestion1: selectedQuestionIds[0] && questionAnswers[0]
      ? { questionId: selectedQuestionIds[0], answer: questionAnswers[0].trim() }
      : undefined,
    securityQuestion2: selectedQuestionIds[1] && questionAnswers[1]
      ? { questionId: selectedQuestionIds[1], answer: questionAnswers[1].trim() }
      : undefined,
    securityQuestion3: selectedQuestionIds[2] && questionAnswers[2]
      ? { questionId: selectedQuestionIds[2], answer: questionAnswers[2].trim() }
      : undefined,
  });

  const redirectToLoginAfterSignup = () => {
    Alert.alert(
      'Account created',
      'Please log in to complete driver verification and document upload.',
      [{ text: 'OK', onPress: () => router.replace('/login') }]
    );
  };

  /** Email flow: send OTP to email */
  const handleSendEmailOtp = async () => {
    const email = registrationData.email.trim().toLowerCase();
    if (!email || !isValidEmail(email)) {
      setError('Please enter a valid email address');
      return;
    }
    setIsLoading(true);
    setError(null);
    setEmailVerifiedViaOtp(false);
    try {
      let status: RegistrationStatus | null = null;
      try {
        status = await registrationService.checkRegistrationStatus(email);
        setRegistrationStatus(status);
      } catch {
        // proceed to send OTP
      }
      if (status?.registrationComplete) {
        Alert.alert(
          'Account exists',
          'This email is already registered. Please log in instead.',
          [{ text: 'Go to Login', onPress: () => router.replace('/login') }]
        );
        return;
      }
      if (status?.emailVerified && !status.registrationComplete && status.canResume) {
        setCurrentStep('resume-prompt');
        return;
      }
      await authService.sendOtp({ email });
      setOtpResendSecondsLeft(OTP_RESEND_COOLDOWN_SECONDS);
      setCurrentStep('email-otp');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send verification code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  /** Email flow: resend OTP */
  const handleResendEmailOtp = async () => {
    const email = registrationData.email.trim().toLowerCase();
    if (!email) return;
    setIsLoading(true);
    setError(null);
    try {
      await authService.resendOtp(email);
      setOtpResendSecondsLeft(OTP_RESEND_COOLDOWN_SECONDS);
      Alert.alert('Code sent', 'A new verification code has been sent to your email.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resend code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  /** Email flow: verify OTP then continue to account details */
  const handleContinueFromEmailOtp = async () => {
    setError(null);
    const email = registrationData.email.trim().toLowerCase();
    if (!registrationData.otp || registrationData.otp.trim().length !== 6) {
      setError('Please enter the 6-digit code sent to your email');
      Alert.alert('Invalid code', 'Please enter the full 6-digit code sent to your email.');
      return;
    }
    setIsLoading(true);
    try {
      await authService.verifyOtp({ email, otp: registrationData.otp.trim() });
      setEmailVerifiedViaOtp(true);
      setCurrentStep('enter-details');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Invalid or expired code. Please try again.';
      setError(message);
      Alert.alert('Invalid code', message);
    } finally {
      setIsLoading(false);
    }
  };

  /** Step 1: Send SMS OTP to phone (secondary flow) */
  const handleSendOtp = async () => {
    const phone = normalizePhoneForApi(registrationData.phoneNumber);
    if (!phone || !isValidPhone(phone)) {
      setError('Please enter a valid Philippine mobile number starting with 9 (e.g. 9171234567).');
      return;
    }
    setIsLoading(true);
    setError(null);
    setEmailVerifiedViaOtp(false);
    try {
      await authService.sendSmsOtp({ phoneNumber: phone });
      setOtpResendSecondsLeft(OTP_RESEND_COOLDOWN_SECONDS);
      setCurrentStep('enter-otp');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send verification code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  /** Resend SMS OTP */
  const handleResendOtp = async () => {
    const phone = normalizePhoneForApi(registrationData.phoneNumber);
    if (!phone) return;
    setIsLoading(true);
    setError(null);
    try {
      await authService.resendSmsOtp(phone);
      setOtpResendSecondsLeft(OTP_RESEND_COOLDOWN_SECONDS);
      Alert.alert('Code sent', 'A new verification code has been sent via SMS.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resend code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  /** Step 2: Verify SMS OTP only. Show clear success or invalid feedback, then proceed to details. */
  const handleContinueFromOtp = async () => {
    setError(null);
    if (!registrationData.otp || registrationData.otp.trim().length !== 6) {
      setError('Please enter the 6-digit code sent to your phone');
      Alert.alert('Invalid code', 'Please enter the full 6-digit code sent to your phone.');
      return;
    }
    setIsLoading(true);
    try {
      setEmailVerifiedViaOtp(false);
      const verifyResponse = await authService.verifySmsOtp({
        phoneNumber: normalizePhoneForApi(registrationData.phoneNumber),
        otp: registrationData.otp.trim(),
      });
      setRegistrationToken(verifyResponse.registrationToken ?? null);
      setCurrentStep('enter-details');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Invalid or expired code. Please try again.';
      setError(message);
      Alert.alert('Invalid code', message);
    } finally {
      setIsLoading(false);
    }
  };

  /** Create account after details + security questions (email or phone path). */
  const handleCreateAccountAfterOtp = async () => {
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }
    if (emailVerifiedViaOtp && !registrationData.email.trim()) {
      setError('Email is required');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      if (emailVerifiedViaOtp) {
        await authService.register({
          email: registrationData.email.trim().toLowerCase(),
          password: registrationData.password,
          fullName: registrationData.fullName.trim(),
          role: 'Driver',
          ...buildSecurityQuestionsPayload(),
        });
      } else {
        await authService.registerByPhone({
          phoneNumber: normalizePhoneForApi(registrationData.phoneNumber),
          password: registrationData.password,
          fullName: registrationData.fullName.trim(),
          role: 'Driver',
          ...buildSecurityQuestionsPayload(),
          ...(registrationToken ? { registrationToken } : {}),
        });
      }
      try {
        await biometricStorage.clearCredentials();
      } catch {
        // Non-fatal
      }
      redirectToLoginAfterSignup();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Registration failed. Please try again.';
      setError(message);
      Alert.alert('Error', message);
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
    Alert.alert(
      'Continue registration',
      'Please log in with your email and password to finish driver verification.',
      [{ text: 'Go to Login', onPress: () => router.replace('/login') }]
    );
  };

  const renderChannelToggle = (target: 'email' | 'phone') => (
    <TouchableOpacity
      style={styles.channelToggle}
      onPress={() => {
        setError(null);
        if (target === 'phone') {
          setEmailVerifiedViaOtp(false);
          setCurrentStep('enter-phone');
        } else {
          setRegistrationToken(null);
          setCurrentStep('email-entry');
        }
      }}
      disabled={isLoading}>
      <Text style={[styles.channelToggleText, { color: theme.primary }]}>
        {target === 'phone' ? 'Use phone number instead' : 'Use email instead'}
      </Text>
    </TouchableOpacity>
  );

  const renderLoginFooter = () => (
    <View style={styles.loginContainer}>
      <Text style={[styles.loginText, { color: theme.textMuted }]}>
        Already have an account?{' '}
        <Text style={[styles.loginLink, { color: theme.text }]} onPress={() => router.replace('/login')}>
          Log In
        </Text>
      </Text>
    </View>
  );

  // Email flow: enter email and send OTP
  if (currentStep === 'email-entry') {
    return (
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: theme.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
        <View style={[styles.content, { paddingTop: insets.top }]}>
          <ScrollView
            contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
            keyboardShouldPersistTaps="handled">
            <View style={styles.headerContainer}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => (router.canGoBack() ? router.back() : router.replace('/welcome'))}>
                <Ionicons name="arrow-back" size={24} color={theme.text} />
              </TouchableOpacity>
              <Text style={[styles.headline, { color: theme.text }]}>Create Driver Account</Text>
              <Text style={[styles.subheadline, { color: theme.textSecondary }]}>
                Enter your email to receive a verification code
              </Text>
            </View>
            <View style={styles.form}>
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: theme.text }]}>Email</Text>
                <View style={[styles.inputContainer, styles.inputContainerLarge, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <Ionicons name="mail-outline" size={20} color={theme.textSecondary} style={styles.inputLeadingIcon} />
                  <TextInput
                    style={[styles.input, styles.inputLarge, { color: theme.text }]}
                    placeholder="you@example.com"
                    placeholderTextColor={theme.placeholder}
                    value={registrationData.email}
                    onChangeText={(text) => {
                      setRegistrationData({ ...registrationData, email: trimToMax(text, LIMITS.EMAIL) });
                      setError(null);
                    }}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!isLoading}
                    maxLength={LIMITS.EMAIL}
                  />
                </View>
                {registrationStatus && (
                  <View style={styles.statusIndicator}>
                    {registrationStatus.registrationComplete ? (
                      <Text style={[styles.statusText, { color: theme.info }]}>
                        Account exists. Please log in instead.
                      </Text>
                    ) : registrationStatus.emailVerified ? (
                      <Text style={[styles.statusText, { color: theme.success }]}>
                        Email verified. Log in to continue registration.
                      </Text>
                    ) : null}
                  </View>
                )}
              </View>
              {error && (
                <View style={styles.errorContainer}>
                  <Ionicons name="alert-circle" size={16} color={BeeColors.red[600]} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}
              <TouchableOpacity
                style={[styles.submitButton, isLoading && styles.submitButtonDisabled, { backgroundColor: theme.primary }]}
                onPress={handleSendEmailOtp}
                disabled={isLoading}>
                {isLoading ? (
                  <ActivityIndicator size="small" color={theme.primaryText} />
                ) : (
                  <Text style={[styles.submitButtonText, { color: theme.primaryText }]}>Send verification code</Text>
                )}
              </TouchableOpacity>
              {renderChannelToggle('phone')}
              {renderLoginFooter()}
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // Email flow: verify OTP
  if (currentStep === 'email-otp') {
    return (
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: theme.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
        <View style={[styles.content, { paddingTop: insets.top }]}>
          <ScrollView
            contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
            keyboardShouldPersistTaps="handled">
            <View style={styles.headerContainer}>
              <TouchableOpacity style={styles.backButton} onPress={() => setCurrentStep('email-entry')}>
                <Ionicons name="arrow-back" size={24} color={theme.text} />
              </TouchableOpacity>
              <Text style={[styles.headline, { color: theme.text }]}>Verification code</Text>
              <Text style={[styles.subheadline, { color: theme.textSecondary }]}>
                We sent a 6-digit code to {registrationData.email.trim().toLowerCase()}
              </Text>
            </View>
            <View style={[styles.form, styles.formCentered]}>
              <View style={styles.otpInputWrap}>
                <Text style={[styles.label, { color: theme.text }]}>Enter the code from your email</Text>
                <View style={[styles.otpInputContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <TextInput
                    style={[styles.otpInput, { color: theme.text }]}
                    placeholder="000000"
                    placeholderTextColor={theme.placeholder}
                    value={registrationData.otp}
                    onChangeText={(text) => {
                      setRegistrationData({ ...registrationData, otp: text.replace(/\D/g, '').slice(0, LIMITS.OTP_LENGTH) });
                      setError(null);
                    }}
                    keyboardType="number-pad"
                    maxLength={LIMITS.OTP_LENGTH}
                    editable={!isLoading}
                  />
                </View>
                {otpResendSecondsLeft > 0 ? (
                  <View style={styles.timerRow}>
                    <Ionicons name="time-outline" size={18} color={theme.textSecondary} />
                    <Text style={[styles.timerText, { color: theme.textSecondary }]}>
                      Resend code in {Math.floor(otpResendSecondsLeft / 60)}:{(otpResendSecondsLeft % 60).toString().padStart(2, '0')}
                    </Text>
                  </View>
                ) : (
                  <TouchableOpacity onPress={handleResendEmailOtp} disabled={isLoading} style={styles.resendButton}>
                    <Text style={[styles.resendText, { color: theme.primary }]}>Resend code</Text>
                  </TouchableOpacity>
                )}
              </View>
              {error && (
                <View style={styles.errorContainer}>
                  <Ionicons name="alert-circle" size={16} color={BeeColors.red[600]} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}
              <TouchableOpacity
                style={[styles.submitButton, isLoading && styles.submitButtonDisabled, { backgroundColor: theme.primary }]}
                onPress={handleContinueFromEmailOtp}
                disabled={isLoading}>
                {isLoading ? (
                  <ActivityIndicator size="small" color={theme.primaryText} />
                ) : (
                  <Text style={[styles.submitButtonText, { color: theme.primaryText }]}>Continue</Text>
                )}
              </TouchableOpacity>
              {renderLoginFooter()}
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // Phone flow: enter phone and send SMS OTP
  if (currentStep === 'enter-phone') {
    return (
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: theme.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
        <View style={[styles.content, { paddingTop: insets.top }]}>
          <ScrollView
            contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
            keyboardShouldPersistTaps="handled">
            <View style={styles.headerContainer}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => (router.canGoBack() ? router.back() : router.replace('/welcome'))}>
                <Ionicons name="arrow-back" size={24} color={theme.text} />
              </TouchableOpacity>
              <Text style={[styles.headline, { color: theme.text }]}>Create Driver Account</Text>
              <Text style={[styles.subheadline, { color: theme.textSecondary }]}>
                Enter your phone number to receive a verification code
              </Text>
            </View>
            <View style={styles.form}>
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: theme.text }]}>Phone number</Text>
                <View
                  style={[
                    styles.inputContainer,
                    styles.inputContainerLarge,
                    styles.phoneInputContainer,
                    { backgroundColor: theme.surface, borderColor: theme.border },
                  ]}>
                  <View style={[styles.countryCodeBadge, { borderColor: theme.border, backgroundColor: theme.surface }]}>
                    <Text style={[styles.countryCodeText, { color: theme.text }]}>+63</Text>
                  </View>
                  <TextInput
                    style={[styles.input, styles.inputLarge, styles.phoneInput, { color: theme.text }]}
                    placeholder="9XXXXXXXXX"
                    placeholderTextColor={theme.placeholder}
                    value={registrationData.phoneNumber}
                    onChangeText={(text) => {
                      // Keep only digits and enforce starting with 9 for PH mobiles
                      let next = text.replace(/\D/g, '');
                      if (next.startsWith('09')) {
                        next = next.slice(1);
                      }
                      if (next && !next.startsWith('9')) {
                        next = next.replace(/^[0-8]+/, '');
                      }
                      next = next.slice(0, 10); // 9 + 9 digits
                      setRegistrationData({
                        ...registrationData,
                        phoneNumber: trimToMax(next, LIMITS.PHONE),
                      });
                      setError(null);
                    }}
                    keyboardType="phone-pad"
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!isLoading}
                    maxLength={10}
                  />
                </View>
              </View>
              {error && (
                <View style={styles.errorContainer}>
                  <Ionicons name="alert-circle" size={16} color={BeeColors.red[600]} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}
              <TouchableOpacity
                style={[
                  styles.submitButton,
                  isLoading && styles.submitButtonDisabled,
                  { backgroundColor: theme.primary },
                ]}
                onPress={handleSendOtp}
                disabled={isLoading}>
                {isLoading ? (
                  <ActivityIndicator size="small" color={theme.primaryText} />
                ) : (
                  <Text style={[styles.submitButtonText, { color: theme.primaryText }]}>
                    Send verification code
                  </Text>
                )}
              </TouchableOpacity>
              {renderChannelToggle('email')}
              {renderLoginFooter()}
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // Phone flow: verify SMS OTP
  if (currentStep === 'enter-otp') {
    return (
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: theme.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
        <View style={[styles.content, { paddingTop: insets.top }]}>
          <ScrollView
            contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
            keyboardShouldPersistTaps="handled">
            <View style={styles.headerContainer}>
              <TouchableOpacity style={styles.backButton} onPress={() => setCurrentStep('enter-phone')}>
                <Ionicons name="arrow-back" size={24} color={theme.text} />
              </TouchableOpacity>
              <Text style={[styles.headline, { color: theme.text }]}>Verification code</Text>
              <Text style={[styles.subheadline, { color: theme.textSecondary }]}>
                We sent a 6-digit code to +63 {registrationData.phoneNumber}
              </Text>
            </View>
            <View style={[styles.form, styles.formCentered]}>
              <View style={styles.otpInputWrap}>
                <Text style={[styles.label, { color: theme.text }]}>Enter the code from your SMS</Text>
                <View style={[styles.otpInputContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <TextInput
                    style={[styles.otpInput, { color: theme.text }]}
                    placeholder="000000"
                    placeholderTextColor={theme.placeholder}
                    value={registrationData.otp}
                    onChangeText={(text) => {
                      setRegistrationData({ ...registrationData, otp: text.replace(/\D/g, '').slice(0, LIMITS.OTP_LENGTH) });
                      setError(null);
                    }}
                    keyboardType="number-pad"
                    maxLength={LIMITS.OTP_LENGTH}
                    editable={!isLoading}
                  />
                </View>
                {otpResendSecondsLeft > 0 ? (
                  <View style={styles.timerRow}>
                    <Ionicons name="time-outline" size={18} color={theme.textSecondary} />
                    <Text style={[styles.timerText, { color: theme.textSecondary }]}>
                      Resend code in {Math.floor(otpResendSecondsLeft / 60)}:{(otpResendSecondsLeft % 60).toString().padStart(2, '0')}
                    </Text>
                  </View>
                ) : (
                  <TouchableOpacity onPress={handleResendOtp} disabled={isLoading} style={styles.resendButton}>
                    <Text style={[styles.resendText, { color: theme.primary }]}>Resend code</Text>
                  </TouchableOpacity>
                )}
              </View>
              {error && (
                <View style={styles.errorContainer}>
                  <Ionicons name="alert-circle" size={16} color={BeeColors.red[600]} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}
              <TouchableOpacity
                style={[
                  styles.submitButton,
                  isLoading && styles.submitButtonDisabled,
                  { backgroundColor: theme.primary },
                ]}
                onPress={handleContinueFromOtp}
                disabled={isLoading}>
                {isLoading ? (
                  <ActivityIndicator size="small" color={theme.primaryText} />
                ) : (
                  <Text style={[styles.submitButtonText, { color: theme.primaryText }]}>Continue</Text>
                )}
              </TouchableOpacity>
              {renderLoginFooter()}
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // Reusable security questions block + picker modal
  const renderSecurityQuestionsBlock = (showSectionHeader: boolean) => (
    <View style={styles.securityQuestionsSection}>
      {showSectionHeader && (
        <>
          <Text style={[styles.securityQuestionsTitle, { color: theme.text }]}>
            Security questions <Text style={styles.required}>*</Text>
          </Text>
          <Text style={[styles.securityQuestionsSubtitle, { color: theme.textSecondary }]}>
            All 3 are required for account recovery (e.g. forgot password)
          </Text>
        </>
      )}
      {([0, 1, 2] as const).map((index) => {
        const selectedId = selectedQuestionIds[index];
        const selectedQuestion = selectedId ? securityQuestionsList.find((q) => q.id === selectedId) : null;
        return (
          <View key={index} style={styles.securityQuestionRow}>
            <Text style={[styles.label, { color: theme.text }]}>Security question {index + 1}</Text>
            <TouchableOpacity
              style={[styles.pickerButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
              onPress={() => setQuestionPickerIndex(index)}
              disabled={isLoading}>
              <Text style={[styles.pickerButtonText, { color: selectedQuestion ? theme.text : theme.textSecondary }]} numberOfLines={1}>
                {selectedQuestion ? selectedQuestion.question : 'Select a question'}
              </Text>
              <Ionicons name="chevron-down" size={20} color={theme.textSecondary} />
            </TouchableOpacity>
            <TextInput
              style={[styles.input, styles.inputLarge, { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border }, styles.securityAnswerInput]}
              placeholder="Your answer"
              placeholderTextColor={theme.placeholder}
              value={questionAnswers[index]}
              onChangeText={(text) => {
                const next = [...questionAnswers] as [string, string, string];
                next[index] = trimToMax(text, LIMITS.SECURITY_ANSWER_MAX);
                setQuestionAnswers(next);
                setError(null);
              }}
              editable={!isLoading}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={LIMITS.SECURITY_ANSWER_MAX}
            />
          </View>
        );
      })}
    </View>
  );

  const questionPickerModal = questionPickerIndex !== null && (
    <Modal visible transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setQuestionPickerIndex(null)} />
        <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
          <Text style={[styles.modalTitle, { color: theme.text }]}>Select question {questionPickerIndex + 1}</Text>
          <FlatList
            data={securityQuestionsList.filter(
              (q) =>
                selectedQuestionIds[questionPickerIndex] === q.id ||
                !selectedQuestionIds.some((id, i) => i !== questionPickerIndex && id === q.id)
            )}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.modalOption, { borderBottomColor: theme.border }]}
                onPress={() => {
                  const next = [...selectedQuestionIds];
                  next[questionPickerIndex] = item.id;
                  setSelectedQuestionIds(next);
                  setQuestionPickerIndex(null);
                }}>
                <Text style={[styles.modalOptionText, { color: theme.text }]}>{item.question}</Text>
              </TouchableOpacity>
            )}
          />
          <TouchableOpacity style={[styles.modalCancel, { borderColor: theme.border }]} onPress={() => setQuestionPickerIndex(null)}>
            <Text style={[styles.modalCancelText, { color: theme.textSecondary }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  // OTP flow: Step 3a – Full name + password only
  if (currentStep === 'enter-details') {
    return (
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: theme.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
        <View style={[styles.content, { paddingTop: insets.top }]}>
          <ScrollView
            contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
            keyboardShouldPersistTaps="handled">
            <View style={styles.headerContainer}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => setCurrentStep(emailVerifiedViaOtp ? 'email-otp' : 'enter-otp')}>
                <Ionicons name="arrow-back" size={24} color={theme.text} />
              </TouchableOpacity>
              <Text style={[styles.headline, { color: theme.text }]}>Create your account</Text>
              <Text style={[styles.subheadline, { color: theme.textSecondary }]}>
                Step 1 of 2: Enter your name and password
              </Text>
            </View>
            <View style={styles.form}>
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: theme.text }]}>Full name</Text>
                <View style={[styles.inputContainer, styles.inputContainerLarge, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <TextInput
                    style={[styles.input, styles.inputLarge, { color: theme.text }]}
                    placeholder="As it appears on your ID"
                    placeholderTextColor={theme.placeholder}
                    value={registrationData.fullName}
                    onChangeText={(text) => {
                      setRegistrationData({ ...registrationData, fullName: text.slice(0, LIMITS.FULL_NAME) });
                      setError(null);
                    }}
                    autoCapitalize="words"
                    editable={!isLoading}
                    maxLength={LIMITS.FULL_NAME}
                  />
                </View>
              </View>
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: theme.text }]}>Password</Text>
                <View style={[styles.inputContainer, styles.inputContainerLarge, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <TextInput
                    style={[styles.input, styles.inputLarge, { color: theme.text }]}
                    placeholder="Min. 8 characters, include uppercase, number & symbol"
                    placeholderTextColor={theme.placeholder}
                    value={registrationData.password}
                    onChangeText={(text) => {
                      setRegistrationData({ ...registrationData, password: text });
                      setError(null);
                    }}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    editable={!isLoading}
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.visibilityButton}>
                    <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={24} color={theme.textSecondary} />
                  </TouchableOpacity>
                </View>
              </View>
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: theme.text }]}>Confirm password</Text>
                <View style={[styles.inputContainer, styles.inputContainerLarge, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <TextInput
                    style={[styles.input, styles.inputLarge, { color: theme.text }]}
                    placeholder="Re-enter your password"
                    placeholderTextColor={theme.placeholder}
                    value={confirmPassword}
                    onChangeText={(text) => {
                      setConfirmPassword(text);
                      setError(null);
                    }}
                    secureTextEntry={!showConfirmPassword}
                    autoCapitalize="none"
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
              {error && (
                <View style={styles.errorContainer}>
                  <Ionicons name="alert-circle" size={16} color={BeeColors.red[600]} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}
              <TouchableOpacity
                style={[
                  styles.submitButton,
                  isLoading && styles.submitButtonDisabled,
                  { backgroundColor: theme.primary },
                ]}
                onPress={() => {
                  const validationError = validateBasicDetailsForm();
                  if (validationError) {
                    setError(validationError);
                    return;
                  }
                  setError(null);
                  setCurrentStep('enter-security-questions');
                }}
                disabled={isLoading}>
                <Text style={[styles.submitButtonText, { color: theme.primaryText }]}>Continue</Text>
              </TouchableOpacity>
              {renderLoginFooter()}
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // Step 2: Security questions
  if (currentStep === 'enter-security-questions') {
    return (
      <>
        {questionPickerModal}
        <KeyboardAvoidingView
          style={[styles.container, { backgroundColor: theme.background }]}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
          <View style={[styles.content, { paddingTop: insets.top }]}>
            <ScrollView
              contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
              keyboardShouldPersistTaps="handled">
              <View style={styles.headerContainer}>
                <TouchableOpacity style={styles.backButton} onPress={() => setCurrentStep('enter-details')}>
                  <Ionicons name="arrow-back" size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={[styles.headline, { color: theme.text }]}>Security questions</Text>
                <Text style={[styles.subheadline, { color: theme.textSecondary }]}>
                  Step 2 of 2: Set up security questions for account recovery
                </Text>
              </View>
              <View style={styles.form}>
                {renderSecurityQuestionsBlock(false)}
                {error && (
                  <View style={styles.errorContainer}>
                    <Ionicons name="alert-circle" size={16} color={BeeColors.red[600]} />
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}
                <TouchableOpacity
                  style={[
                    styles.submitButton,
                    isLoading && styles.submitButtonDisabled,
                    { backgroundColor: theme.primary },
                  ]}
                  onPress={handleCreateAccountAfterOtp}
                  disabled={isLoading}>
                  {isLoading ? (
                    <ActivityIndicator size="small" color={theme.primaryText} />
                  ) : (
                    <Text style={[styles.submitButtonText, { color: theme.primaryText }]}>Create account</Text>
                  )}
                </TouchableOpacity>
                {renderLoginFooter()}
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </>
    );
  }

  if (currentStep === 'email-verification') {
    return (
      <EmailVerificationScreen
        email={registrationData.email}
        onVerified={handleEmailVerified}
        onBack={() => setCurrentStep('email-entry')}
      />
    );
  }

  if (currentStep === 'resume-prompt') {
    return (
      <ResumeRegistrationScreen
        email={registrationData.email}
        onContinue={handleResumeRegistration}
        onBack={() => setCurrentStep('email-entry')}
      />
    );
  }

  return null;
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
  formCentered: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    marginTop: 24,
    alignItems: 'center',
  },
  inputGroup: {
    marginBottom: 20,
    paddingHorizontal: 16,
    width: '100%',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 18,
    minHeight: 56,
    height: 56,
  },
  inputContainerLarge: {
    minHeight: 64,
    height: 64,
    borderRadius: 14,
    paddingHorizontal: 20,
  },
  input: {
    flex: 1,
    fontSize: 17,
    paddingVertical: 4,
  },
  inputLarge: {
    fontSize: 19,
  },
  phoneInputContainer: {
    gap: 8,
  },
  countryCodeBadge: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginRight: 4,
  },
  countryCodeText: {
    fontSize: 16,
    fontWeight: '600',
  },
  phoneInput: {
    flex: 1,
  },
  otpInputWrap: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 24,
  },
  otpInputContainer: {
    width: '100%',
    maxWidth: 280,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderRadius: 16,
    paddingHorizontal: 24,
    minHeight: 72,
    height: 72,
  },
  otpInput: {
    flex: 1,
    fontSize: 32,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 8,
    paddingVertical: 8,
  },
  visibilityButton: {
    padding: 4,
  },
  resendButton: {
    marginTop: 8,
    paddingHorizontal: 16,
    alignSelf: 'flex-start',
  },
  resendText: {
    fontSize: 14,
    fontWeight: '600',
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingHorizontal: 4,
  },
  timerText: {
    fontSize: 14,
    fontWeight: '500',
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
  channelToggle: {
    alignItems: 'center',
    paddingTop: 16,
  },
  channelToggleText: {
    fontSize: 14,
    fontWeight: '600',
  },
  inputLeadingIcon: {
    marginRight: 8,
  },
  securityQuestionsSection: {
    marginTop: 4,
    width: '100%',
  },
  securityQuestionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  required: {
    color: BeeColors.red[600],
  },
  securityQuestionsSubtitle: {
    fontSize: 12,
    marginBottom: 4,
  },
  securityQuestionRow: {
    marginBottom: 16,
  },
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 52,
    marginBottom: 8,
  },
  pickerButtonText: {
    flex: 1,
    fontSize: 16,
    marginRight: 8,
  },
  securityAnswerInput: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 52,
    marginTop: 0,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 20,
    paddingBottom: 32,
    maxHeight: '70%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  modalOption: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
  },
  modalOptionText: {
    fontSize: 16,
  },
  modalCancel: {
    marginTop: 12,
    marginHorizontal: 20,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
