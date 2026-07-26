import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
  FlatList,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, type ThemeColors } from '@/shared/hooks/use-theme';
import { BeeColors } from '@/constants/theme';
import { authService } from '../services/authService';
import { registrationService, type RegistrationStatus } from '../services/registrationService';
import { EmailVerificationScreen } from './EmailVerificationScreen';
import { ResumeRegistrationScreen } from './ResumeRegistrationScreen';
import { biometricStorage } from '@/shared/services/biometricStorage';
import { LIMITS, PATTERNS, trimToMax } from '@/shared/constants/validation';
import { useAuth as useClerkAuth, useSignUp } from '@clerk/clerk-expo';

const OTP_LENGTH = 6;
const OTP_RESEND_COOLDOWN_SECONDS = 10 * 60;
const PRIVACY_POLICY_URL = 'https://mybeeapp.com/privacy';
const TERMS_URL = 'https://mybeeapp.com/terms';

// Runs inside the policy WebViews. Two jobs: strip the site's "Sign In" nav button, and
// post a message once the reader reaches the bottom so the Accept button can unlock.
const POLICY_INJECTED_JS = `
(function () {
  var style = document.createElement('style');
  style.textContent = 'header button { display: none !important; }';
  document.head.appendChild(style);

  var sent = false;
  function checkAtEnd() {
    if (sent) return;
    var doc = document.documentElement;
    var scrollTop = window.pageYOffset || doc.scrollTop || 0;
    var viewport = window.innerHeight || doc.clientHeight || 0;
    var total = Math.max(doc.scrollHeight, document.body ? document.body.scrollHeight : 0);
    // 48px slack so a near-miss at the bottom still counts.
    if (scrollTop + viewport >= total - 48) {
      sent = true;
      window.ReactNativeWebView.postMessage('reached-end');
    }
  }

  window.addEventListener('scroll', checkAtEnd, { passive: true });
  window.addEventListener('resize', checkAtEnd, { passive: true });
  // Content shorter than the viewport never fires a scroll event - unlock after layout settles.
  setTimeout(checkAtEnd, 800);
})();
true;
`;

/** Pull a readable message out of a Clerk API error (or any error). */
function extractClerkError(err: unknown): string {
  if (err && typeof err === 'object' && 'errors' in err && Array.isArray((err as { errors?: unknown }).errors)) {
    const first = (err as { errors: { longMessage?: string; message?: string }[] }).errors[0];
    return first?.longMessage || first?.message || 'Something went wrong. Please try again.';
  }
  if (err instanceof Error) return err.message;
  return 'Something went wrong. Please try again.';
}

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
  referralCode: string;
}

/**
 * Multi-step driver registration wizard.
 * Primary: email → account details → Clerk OTP → session.
 * Secondary: phone SMS OTP → details → security questions → registerByPhone → login.
 */
export function RegistrationSteps() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const router = useRouter();

  const { isLoaded: signUpLoaded, signUp, setActive } = useSignUp();
  const { isSignedIn: clerkSignedIn, signOut: clerkSignOut } = useClerkAuth();
  const [channel, setChannel] = useState<'email' | 'phone'>('email');
  const [isSigningIn, setIsSigningIn] = useState(false);

  const [currentStep, setCurrentStep] = useState<RegistrationStep>('email-entry');
  const [emailVerifiedViaOtp, setEmailVerifiedViaOtp] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registrationData, setRegistrationData] = useState<RegistrationData>({
    email: '',
    phoneNumber: '',
    password: '',
    fullName: '',
    otp: '',
    referralCode: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [registrationStatus, setRegistrationStatus] = useState<RegistrationStatus | null>(null);
  const [isCheckingRegistration, setIsCheckingRegistration] = useState(false);

  const [securityQuestionsList, setSecurityQuestionsList] = useState<Array<{ id: number; question: string }>>([]);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<[number | null, number | null, number | null]>([null, null, null]);
  const [questionAnswers, setQuestionAnswers] = useState<[string, string, string]>(['', '', '']);
  const [questionPickerIndex, setQuestionPickerIndex] = useState<0 | 1 | 2 | null>(null);
  const [registrationToken, setRegistrationToken] = useState<string | null>(null);
  const [otpResendSecondsLeft, setOtpResendSecondsLeft] = useState(0);
  const [agreedToPrivacy, setAgreedToPrivacy] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [privacyPolicyVisible, setPrivacyPolicyVisible] = useState(false);
  const [termsVisible, setTermsVisible] = useState(false);

  useEffect(() => {
    authService.getSecurityQuestions().then(setSecurityQuestionsList).catch(() => {});
  }, []);

  useEffect(() => {
    if ((currentStep !== 'enter-otp' && currentStep !== 'email-otp') || otpResendSecondsLeft <= 0) return;
    const id = setInterval(() => {
      setOtpResendSecondsLeft((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [currentStep, otpResendSecondsLeft]);

  const isValidEmail = (email: string): boolean => PATTERNS.EMAIL.test(email);
  const isValidPhone = (phone: string): boolean => PATTERNS.PHONE.test(phone);

  useEffect(() => {
    if (currentStep !== 'email-entry') return;
    const email = registrationData.email.trim();
    if (!email || !isValidEmail(email)) {
      setRegistrationStatus(null);
      setIsCheckingRegistration(false);
      return;
    }
    setIsCheckingRegistration(true);
    const timer = setTimeout(async () => {
      try {
        const status = await registrationService.checkRegistrationStatus(email);
        setRegistrationStatus(status);
      } catch {
        setRegistrationStatus(null);
      } finally {
        setIsCheckingRegistration(false);
      }
    }, 500);
    return () => {
      clearTimeout(timer);
      setIsCheckingRegistration(false);
    };
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

  const normalizePhoneForApi = (raw: string): string => {
    const digits = raw.replace(/\D/g, '');
    if (!digits) return '';
    if (digits.startsWith('639') && digits.length === 12) return digits;
    if (digits.startsWith('09') && digits.length === 11) return `63${digits.slice(1)}`;
    if (digits.startsWith('9')) return `63${digits}`;
    return `63${digits}`;
  };

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

  const navigateToLogin = () => router.replace('/login');
  const navigateBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/login');
  };

  const dismissKeyboard = () => Keyboard.dismiss();
  const withKeyboardDismiss = (fn: () => void) => () => {
    dismissKeyboard();
    fn();
  };

  const handleSendEmailOtp = () => {
    const email = registrationData.email.trim().toLowerCase();
    if (!email || !isValidEmail(email)) {
      setError('Please enter a valid email address');
      return;
    }
    setError(null);
    setEmailVerifiedViaOtp(false);
    setChannel('email');
    setCurrentStep('enter-details');
  };

  const handleStartClerkSignUp = async () => {
    const validationError = validateBasicDetailsForm();
    if (validationError) {
      setError(validationError);
      return;
    }
    if (!signUpLoaded || !signUp) {
      setError('Sign-up is not ready yet. Please try again in a moment.');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      if (clerkSignedIn) await clerkSignOut();
      const email = registrationData.email.trim().toLowerCase();
      const name = registrationData.fullName.trim();
      const sp = name.indexOf(' ');
      const firstName = sp === -1 ? name : name.slice(0, sp);
      const lastName = sp === -1 ? undefined : name.slice(sp + 1).trim() || undefined;
      await signUp.create({
        emailAddress: email,
        password: registrationData.password,
        firstName,
        lastName,
        legalAccepted: true,
        unsafeMetadata: {
          phoneNumber: registrationData.phoneNumber.trim() || null,
          referralCode: registrationData.referralCode.trim().toUpperCase() || null,
        },
      });
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      setOtpResendSecondsLeft(OTP_RESEND_COOLDOWN_SECONDS);
      setCurrentStep('email-otp');
    } catch (err) {
      const message = extractClerkError(err);
      setError(message);
      Alert.alert('Error', message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendEmailOtp = async () => {
    if (!signUpLoaded || !signUp) return;
    setIsResending(true);
    setError(null);
    try {
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      setOtpResendSecondsLeft(OTP_RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      setError(extractClerkError(err));
    } finally {
      setIsResending(false);
    }
  };

  const handleContinueFromEmailOtp = async () => {
    setError(null);
    if (!registrationData.otp || registrationData.otp.trim().length !== OTP_LENGTH) {
      setError('Please enter the 6-digit code sent to your email');
      Alert.alert('Invalid code', 'Please enter the full 6-digit code sent to your email.');
      return;
    }
    if (!signUpLoaded || !signUp) {
      setError('Sign-up is not ready yet. Please try again in a moment.');
      return;
    }
    setIsLoading(true);
    try {
      const attempt = await signUp.attemptEmailAddressVerification({ code: registrationData.otp.trim() });
      if (attempt.status === 'complete' && attempt.createdSessionId) {
        setEmailVerifiedViaOtp(true);
        setIsSigningIn(true);
        await setActive({ session: attempt.createdSessionId });
      } else {
        setError('Verification could not be completed. Please try again.');
      }
    } catch (err) {
      const message = extractClerkError(err);
      setError(message);
      Alert.alert('Invalid code', message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendOtp = async () => {
    const phone = normalizePhoneForApi(registrationData.phoneNumber);
    if (!phone || !isValidPhone(phone)) {
      setError('Please enter a valid Philippine mobile number starting with 9 (e.g. 9171234567).');
      return;
    }
    setIsLoading(true);
    setError(null);
    setEmailVerifiedViaOtp(false);
    setChannel('phone');
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

  const handleResendOtp = async () => {
    const phone = normalizePhoneForApi(registrationData.phoneNumber);
    if (!phone) return;
    setIsResending(true);
    setError(null);
    try {
      await authService.resendSmsOtp(phone);
      setOtpResendSecondsLeft(OTP_RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resend code. Please try again.');
    } finally {
      setIsResending(false);
    }
  };

  const handleContinueFromOtp = async () => {
    setError(null);
    if (!registrationData.otp || registrationData.otp.trim().length !== OTP_LENGTH) {
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
          referralCode: registrationData.referralCode.trim().toUpperCase() || null,
          ...buildSecurityQuestionsPayload(),
        });
      } else {
        await authService.registerByPhone({
          phoneNumber: normalizePhoneForApi(registrationData.phoneNumber),
          password: registrationData.password,
          fullName: registrationData.fullName.trim(),
          role: 'Driver',
          referralCode: registrationData.referralCode.trim().toUpperCase() || null,
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
    Alert.alert(
      'Email Verified',
      'Your email has been verified successfully. Please login to continue with your registration.',
      [{ text: 'Go to Login', onPress: () => router.replace('/login') }]
    );
  };

  const handleResumeRegistration = () => {
    Alert.alert(
      'Continue registration',
      'Please log in with your email and password to finish driver verification.',
      [{ text: 'Go to Login', onPress: () => router.replace('/login') }]
    );
  };

  const switchToPhone = withKeyboardDismiss(() => {
    setError(null);
    setEmailVerifiedViaOtp(false);
    setOtpResendSecondsLeft(0);
    setChannel('phone');
    setCurrentStep('enter-phone');
  });

  const switchToEmail = withKeyboardDismiss(() => {
    setError(null);
    setRegistrationToken(null);
    setOtpResendSecondsLeft(0);
    setChannel('email');
    setCurrentStep('email-entry');
  });

  const emailTaken = registrationStatus?.registrationComplete === true;

  const renderShell = (
    shellKey: string,
    onBack: (() => void) | null,
    headline: string,
    subheadline: string,
    children: React.ReactNode,
    options?: { centeredForm?: boolean; hideBack?: boolean }
  ) => (
    <View key={shellKey} style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={{ height: insets.top, backgroundColor: theme.background }} />
      <View style={styles.flex}>
        <View style={styles.content}>
          <ScrollView
            contentContainerStyle={[styles.scrollContent, { paddingBottom: 24 }]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            automaticallyAdjustKeyboardInsets
          >
            <View style={styles.headerContainer}>
              {onBack && !options?.hideBack ? (
                <TouchableOpacity style={styles.backButton} onPress={onBack}>
                  <Ionicons name="arrow-back" size={24} color={theme.text} />
                </TouchableOpacity>
              ) : (
                <View style={styles.backButton} />
              )}
              <Text style={[styles.headline, { color: theme.text }]}>{headline}</Text>
              <Text style={[styles.subheadline, { color: theme.textSecondary }]}>{subheadline}</Text>
            </View>
            <View style={[styles.form, options?.centeredForm && styles.formCentered]}>{children}</View>
          </ScrollView>
        </View>
      </View>
      <View style={{ height: insets.bottom, backgroundColor: theme.background }} />
    </View>
  );

  // ---- Email OTP: signing in ----
  if (currentStep === 'email-otp' && isSigningIn) {
    return renderShell(
      'email-otp-signing-in',
      null,
      'Email verified',
      'Signing you in…',
      <View style={styles.signingInSection}>
        <Ionicons name="checkmark-circle" size={64} color={theme.success} />
        <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 24 }} />
      </View>,
      { hideBack: true }
    );
  }

  // ---- Email OTP ----
  if (currentStep === 'email-otp') {
    return renderShell(
      'email-otp',
      withKeyboardDismiss(() => setCurrentStep('enter-details')),
      'Verification code',
      `We sent a 6-digit code to ${registrationData.email.trim().toLowerCase()}`,
      <>
        <View style={styles.otpInputWrap}>
          <Text style={[styles.label, { color: theme.text }]}>Enter the code from your email</Text>
          <View style={[styles.otpInputContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <TextInput
              style={[styles.otpInput, { color: theme.text }]}
              placeholder="000000"
              placeholderTextColor={theme.placeholder}
              value={registrationData.otp}
              onChangeText={(t) => {
                setRegistrationData({ ...registrationData, otp: t.replace(/\D/g, '').slice(0, OTP_LENGTH) });
                setError(null);
              }}
              keyboardType="number-pad"
              maxLength={OTP_LENGTH}
              autoFocus
              editable={!isLoading}
            />
          </View>
          <OtpResendControl
            theme={theme}
            secondsLeft={otpResendSecondsLeft}
            isResending={isResending}
            onResend={handleResendEmailOtp}
          />
        </View>
        <ErrorBanner error={error} />
        <SubmitButton
          theme={theme}
          label="Continue"
          loading={isLoading}
          disabled={isLoading || registrationData.otp.trim().length === 0}
          onPress={handleContinueFromEmailOtp}
        />
        <LoginFooter theme={theme} onLogin={navigateToLogin} />
      </>,
      { centeredForm: true }
    );
  }

  // ---- Email: enter details ----
  if (currentStep === 'enter-details' && channel === 'email') {
    return renderShell(
      'email-enter-details',
      withKeyboardDismiss(() => setCurrentStep('email-entry')),
      'Create your account',
      registrationData.email.trim().toLowerCase(),
      <>
        <DetailsFields
          theme={theme}
          showPassword={showPassword}
          setShowPassword={setShowPassword}
          showConfirmPassword={showConfirmPassword}
          setShowConfirmPassword={setShowConfirmPassword}
          fullName={registrationData.fullName}
          setFullName={(v) => {
            setRegistrationData({ ...registrationData, fullName: v.slice(0, LIMITS.FULL_NAME) });
            setError(null);
          }}
          password={registrationData.password}
          setPassword={(v) => {
            setRegistrationData({ ...registrationData, password: v });
            setError(null);
          }}
          confirmPassword={confirmPassword}
          setConfirmPassword={(v) => {
            setConfirmPassword(v);
            setError(null);
          }}
          referralCode={registrationData.referralCode}
          setReferralCode={(v) => {
            setRegistrationData({ ...registrationData, referralCode: v.slice(0, 20) });
            setError(null);
          }}
          disabled={isLoading}
        />
        <PolicyAgreementCheckbox
          theme={theme}
          checked={agreedToPrivacy}
          // Ticking requires reading the document first, so the box can only be checked by
          // accepting inside the modal. Unticking stays a plain toggle.
          onToggle={() => {
            if (agreedToPrivacy) setAgreedToPrivacy(false);
            else setPrivacyPolicyVisible(true);
          }}
          onOpenDocument={() => setPrivacyPolicyVisible(true)}
          leadingText="I have read and accept the"
          linkLabel="Privacy Policy"
          disabled={isLoading}
        />
        <PolicyAgreementCheckbox
          theme={theme}
          checked={agreedToTerms}
          onToggle={() => {
            if (agreedToTerms) setAgreedToTerms(false);
            else setTermsVisible(true);
          }}
          onOpenDocument={() => setTermsVisible(true)}
          leadingText="I have read and accept the"
          linkLabel="Terms and Conditions"
          disabled={isLoading}
        />
        <ErrorBanner error={error} />
        <SubmitButton
          theme={theme}
          label="Send verification code"
          loading={isLoading}
          disabled={isLoading || !agreedToPrivacy || !agreedToTerms}
          onPress={handleStartClerkSignUp}
        />
        <LoginFooter theme={theme} onLogin={navigateToLogin} />
        <PolicyDocumentModal
          theme={theme}
          visible={privacyPolicyVisible}
          title="Privacy Policy"
          url={PRIVACY_POLICY_URL}
          onClose={() => setPrivacyPolicyVisible(false)}
          onAccept={() => {
            setAgreedToPrivacy(true);
            setPrivacyPolicyVisible(false);
          }}
        />
        <PolicyDocumentModal
          theme={theme}
          visible={termsVisible}
          title="Terms and Conditions"
          url={TERMS_URL}
          onClose={() => setTermsVisible(false)}
          onAccept={() => {
            setAgreedToTerms(true);
            setTermsVisible(false);
          }}
        />
      </>
    );
  }

  // ---- Phone: security questions ----
  if (currentStep === 'enter-security-questions') {
    return (
      <>
        {renderShell(
          'phone-security-questions',
          withKeyboardDismiss(() => setCurrentStep('enter-details')),
          'Security questions',
          'Step 2 of 2: Set up security questions for account recovery',
          <>
            <SecurityQuestionsBlock
              theme={theme}
              securityQuestions={securityQuestionsList}
              securityFields={selectedQuestionIds.map((questionId, i) => ({
                questionId,
                answer: questionAnswers[i],
              })) as [{ questionId: number | null; answer: string }, { questionId: number | null; answer: string }, { questionId: number | null; answer: string }]}
              onOpenPicker={setQuestionPickerIndex}
              onAnswerChange={(index, answer) => {
                const next = [...questionAnswers] as [string, string, string];
                next[index] = trimToMax(answer, LIMITS.SECURITY_ANSWER_MAX);
                setQuestionAnswers(next);
                setError(null);
              }}
              disabled={isLoading}
            />
            <PolicyAgreementCheckbox
              theme={theme}
              checked={agreedToPrivacy}
              onToggle={() => {
                if (agreedToPrivacy) setAgreedToPrivacy(false);
                else setPrivacyPolicyVisible(true);
              }}
              onOpenDocument={() => setPrivacyPolicyVisible(true)}
              leadingText="I have read and accept the"
              linkLabel="Privacy Policy"
              disabled={isLoading}
            />
            <PolicyAgreementCheckbox
              theme={theme}
              checked={agreedToTerms}
              onToggle={() => {
                if (agreedToTerms) setAgreedToTerms(false);
                else setTermsVisible(true);
              }}
              onOpenDocument={() => setTermsVisible(true)}
              leadingText="I have read and accept the"
              linkLabel="Terms and Conditions"
              disabled={isLoading}
            />
            <ErrorBanner error={error} />
            <SubmitButton
              theme={theme}
              label="Create account"
              loading={isLoading}
              disabled={isLoading || !agreedToPrivacy || !agreedToTerms}
              onPress={handleCreateAccountAfterOtp}
            />
            <LoginFooter theme={theme} onLogin={navigateToLogin} />
          </>
        )}
        <PolicyDocumentModal
          theme={theme}
          visible={privacyPolicyVisible}
          title="Privacy Policy"
          url={PRIVACY_POLICY_URL}
          onClose={() => setPrivacyPolicyVisible(false)}
          onAccept={() => {
            setAgreedToPrivacy(true);
            setPrivacyPolicyVisible(false);
          }}
        />
        <PolicyDocumentModal
          theme={theme}
          visible={termsVisible}
          title="Terms and Conditions"
          url={TERMS_URL}
          onClose={() => setTermsVisible(false)}
          onAccept={() => {
            setAgreedToTerms(true);
            setTermsVisible(false);
          }}
        />
        <QuestionPickerModal
          visible={questionPickerIndex !== null}
          questions={securityQuestionsList}
          selectedIds={selectedQuestionIds}
          currentIndex={questionPickerIndex}
          onSelect={(questionId) => {
            if (questionPickerIndex !== null) {
              const next = [...selectedQuestionIds] as [number | null, number | null, number | null];
              next[questionPickerIndex] = questionId;
              setSelectedQuestionIds(next);
              setError(null);
            }
            setQuestionPickerIndex(null);
          }}
          onClose={() => setQuestionPickerIndex(null)}
          theme={theme}
        />
      </>
    );
  }

  // ---- Phone: enter details ----
  if (currentStep === 'enter-details' && channel === 'phone') {
    return renderShell(
      'phone-enter-details',
      withKeyboardDismiss(() => setCurrentStep('enter-otp')),
      'Create your account',
      `Step 1 of 2: +63 ${registrationData.phoneNumber}`,
      <>
        <DetailsFields
          theme={theme}
          showPassword={showPassword}
          setShowPassword={setShowPassword}
          showConfirmPassword={showConfirmPassword}
          setShowConfirmPassword={setShowConfirmPassword}
          fullName={registrationData.fullName}
          setFullName={(v) => {
            setRegistrationData({ ...registrationData, fullName: v.slice(0, LIMITS.FULL_NAME) });
            setError(null);
          }}
          password={registrationData.password}
          setPassword={(v) => {
            setRegistrationData({ ...registrationData, password: v });
            setError(null);
          }}
          confirmPassword={confirmPassword}
          setConfirmPassword={(v) => {
            setConfirmPassword(v);
            setError(null);
          }}
          referralCode={registrationData.referralCode}
          setReferralCode={(v) => {
            setRegistrationData({ ...registrationData, referralCode: v.slice(0, 20) });
            setError(null);
          }}
          disabled={isLoading}
        />
        <ErrorBanner error={error} />
        <SubmitButton
          theme={theme}
          label="Continue"
          onPress={() => {
            const validationError = validateBasicDetailsForm();
            if (validationError) {
              setError(validationError);
              return;
            }
            setError(null);
            setCurrentStep('enter-security-questions');
          }}
        />
        <LoginFooter theme={theme} onLogin={navigateToLogin} />
      </>
    );
  }

  // ---- Phone: OTP ----
  if (currentStep === 'enter-otp') {
    return renderShell(
      'phone-enter-otp',
      withKeyboardDismiss(() => setCurrentStep('enter-phone')),
      'Verification code',
      `We sent a 6-digit code to +63 ${registrationData.phoneNumber}`,
      <>
        <View style={styles.otpInputWrap}>
          <Text style={[styles.label, { color: theme.text }]}>Enter the code from your SMS</Text>
          <View style={[styles.otpInputContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <TextInput
              style={[styles.otpInput, { color: theme.text }]}
              placeholder="000000"
              placeholderTextColor={theme.placeholder}
              value={registrationData.otp}
              onChangeText={(t) => {
                setRegistrationData({ ...registrationData, otp: t.replace(/\D/g, '').slice(0, OTP_LENGTH) });
                setError(null);
              }}
              keyboardType="number-pad"
              maxLength={OTP_LENGTH}
              autoFocus
              editable={!isLoading}
            />
          </View>
          <OtpResendControl
            theme={theme}
            secondsLeft={otpResendSecondsLeft}
            isResending={isResending}
            onResend={handleResendOtp}
          />
        </View>
        <ErrorBanner error={error} />
        <SubmitButton
          theme={theme}
          label="Continue"
          loading={isLoading}
          disabled={isLoading || registrationData.otp.trim().length === 0}
          onPress={handleContinueFromOtp}
        />
        <LoginFooter theme={theme} onLogin={navigateToLogin} />
      </>,
      { centeredForm: true }
    );
  }

  // ---- Phone: enter phone ----
  if (currentStep === 'enter-phone') {
    return renderShell(
      'phone-enter-phone',
      withKeyboardDismiss(navigateBack),
      'Create Account',
      'Enter your phone number to receive a verification code',
      <>
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: theme.text }]}>Phone number</Text>
          <View
            style={[
              styles.inputContainer,
              styles.phoneInputContainer,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <View style={[styles.countryCodeBadge, { borderColor: theme.border, backgroundColor: theme.surface }]}>
              <Text style={[styles.countryCodeText, { color: theme.text }]}>+63</Text>
            </View>
            <TextInput
              style={[styles.input, styles.phoneInput, { color: theme.text }]}
              placeholder="9XXXXXXXXX"
              placeholderTextColor={theme.placeholder}
              value={registrationData.phoneNumber}
              onChangeText={(text) => {
                let next = text.replace(/\D/g, '');
                if (next.startsWith('09')) next = next.slice(1);
                if (next && !next.startsWith('9')) next = next.replace(/^[0-8]+/, '');
                next = next.slice(0, 10);
                setRegistrationData({ ...registrationData, phoneNumber: trimToMax(next, LIMITS.PHONE) });
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
        <ErrorBanner error={error} />
        <SubmitButton
          theme={theme}
          label="Send verification code"
          loading={isLoading}
          disabled={isLoading}
          onPress={handleSendOtp}
        />
        <ChannelToggle theme={theme} label="Use email instead" onPress={switchToEmail} disabled={isLoading} />
        <LoginFooter theme={theme} onLogin={navigateToLogin} />
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

  // ---- Email entry (default) ----
  return renderShell(
    'email-entry',
    withKeyboardDismiss(navigateBack),
    'Create Account',
    'Enter your email to get started',
    <>
      <View style={styles.inputGroup}>
        <Text style={[styles.label, { color: theme.text }]}>Email</Text>
        <View style={[styles.inputContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Ionicons name="mail-outline" size={20} color={theme.textSecondary} style={styles.inputLeadingIcon} />
          <TextInput
            style={[styles.input, { color: theme.text }]}
            placeholder="you@example.com"
            placeholderTextColor={theme.placeholder}
            value={registrationData.email}
            onChangeText={(v) => {
              setRegistrationData({ ...registrationData, email: trimToMax(v, LIMITS.EMAIL) });
              setError(null);
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!isLoading}
            maxLength={LIMITS.EMAIL}
          />
        </View>
        {isCheckingRegistration && (
          <Text style={[styles.statusText, { color: theme.textSecondary }]}>Checking email…</Text>
        )}
        {registrationStatus?.registrationComplete && (
          <View style={styles.statusIndicator}>
            <Text style={[styles.statusText, { color: theme.info }]}>Account exists. Please log in instead.</Text>
          </View>
        )}
        {!registrationStatus?.registrationComplete && registrationStatus?.emailVerified && (
          <View style={styles.statusIndicator}>
            <Text style={[styles.statusText, { color: theme.success }]}>
              Email verified. You can continue to create your account.
            </Text>
          </View>
        )}
      </View>
      <ErrorBanner error={error} />
      <SubmitButton
        theme={theme}
        label="Continue"
        disabled={emailTaken}
        onPress={() => {
          if (!emailTaken) handleSendEmailOtp();
        }}
      />
      {/* Phone registration — not supported yet; re-enable when backend is ready
      <ChannelToggle theme={theme} label="Use phone number instead" onPress={switchToPhone} disabled={isLoading} />
      */}
      <LoginFooter theme={theme} onLogin={navigateToLogin} />
    </>
  );
}

function OtpResendControl({
  theme,
  secondsLeft,
  isResending,
  onResend,
}: {
  theme: ThemeColors;
  secondsLeft: number;
  isResending: boolean;
  onResend: () => void;
}) {
  if (secondsLeft > 0) {
    return (
      <View style={styles.timerRow}>
        <Ionicons name="time-outline" size={16} color="#000000" />
        <Text style={styles.timerText}>
          Resend code in {Math.floor(secondsLeft / 60)}:{(secondsLeft % 60).toString().padStart(2, '0')}
        </Text>
      </View>
    );
  }

  return (
    <TouchableOpacity onPress={onResend} disabled={isResending} style={styles.resendButton}>
      <Text style={[styles.resendText, { color: theme.primary }]}>
        {isResending ? 'Resending…' : 'Resend code'}
      </Text>
    </TouchableOpacity>
  );
}

function ErrorBanner({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <View style={styles.errorContainer}>
      <Ionicons name="alert-circle" size={16} color={BeeColors.red[600]} />
      <Text style={styles.errorText}>{error}</Text>
    </View>
  );
}

function SubmitButton({
  theme,
  label,
  onPress,
  loading,
  disabled,
}: {
  theme: ThemeColors;
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  return (
    <View style={styles.buttonGroup}>
      <TouchableOpacity
        style={[
          styles.submitButton,
          { backgroundColor: theme.primary },
          (loading || disabled) && styles.submitButtonDisabled,
        ]}
        onPress={onPress}
        disabled={loading || disabled}
        activeOpacity={0.98}
      >
        {loading ? (
          <ActivityIndicator size="small" color={theme.primaryText} />
        ) : (
          <Text style={[styles.submitButtonText, { color: theme.primaryText }]}>{label}</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

function ChannelToggle({
  theme,
  label,
  onPress,
  disabled,
}: {
  theme: ThemeColors;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity style={styles.channelToggle} onPress={onPress} disabled={disabled}>
      <Text style={[styles.channelToggleText, { color: theme.primary }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function LoginFooter({ theme, onLogin }: { theme: ThemeColors; onLogin: () => void }) {
  return (
    <View style={styles.loginContainer}>
      <Text style={[styles.loginText, { color: theme.textMuted }]}>
        Already have an account?{' '}
        <Text style={[styles.loginLink, { color: theme.text }]} onPress={onLogin}>
          Log In
        </Text>
      </Text>
    </View>
  );
}

function DetailsFields({
  theme,
  showPassword,
  setShowPassword,
  showConfirmPassword,
  setShowConfirmPassword,
  fullName,
  setFullName,
  password,
  setPassword,
  confirmPassword,
  setConfirmPassword,
  referralCode,
  setReferralCode,
  disabled,
}: {
  theme: ThemeColors;
  showPassword: boolean;
  setShowPassword: (v: boolean) => void;
  showConfirmPassword: boolean;
  setShowConfirmPassword: (v: boolean) => void;
  fullName: string;
  setFullName: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  confirmPassword: string;
  setConfirmPassword: (v: string) => void;
  referralCode: string;
  setReferralCode: (v: string) => void;
  disabled: boolean;
}) {
  return (
    <>
      <View style={styles.inputGroup}>
        <Text style={[styles.label, { color: theme.text }]}>Full name</Text>
        <View style={[styles.inputContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <TextInput
            style={[styles.input, { color: theme.text }]}
            placeholder="As it appears on your ID"
            placeholderTextColor={theme.placeholder}
            value={fullName}
            onChangeText={setFullName}
            autoCapitalize="words"
            editable={!disabled}
          />
        </View>
      </View>
      <View style={styles.inputGroup}>
        <Text style={[styles.label, { color: theme.text }]}>Password</Text>
        <View style={[styles.inputContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <TextInput
            style={[styles.input, { color: theme.text }]}
            placeholder="Min. 8 characters, include uppercase, number & symbol"
            placeholderTextColor={theme.placeholder}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            editable={!disabled}
          />
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.visibilityButton}>
            <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.inputGroup}>
        <Text style={[styles.label, { color: theme.text }]}>Confirm password</Text>
        <View style={[styles.inputContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <TextInput
            style={[styles.input, { color: theme.text }]}
            placeholder="Re-enter your password"
            placeholderTextColor={theme.placeholder}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry={!showConfirmPassword}
            autoCapitalize="none"
            editable={!disabled}
          />
          <TouchableOpacity
            onPress={() => setShowConfirmPassword(!showConfirmPassword)}
            style={styles.visibilityButton}
          >
            <Ionicons name={showConfirmPassword ? 'eye-off' : 'eye'} size={20} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>
        {confirmPassword.length > 0 && confirmPassword !== password && (
          <Text style={[styles.statusText, { color: BeeColors.red[600], marginTop: 4 }]}>
            Passwords do not match
          </Text>
        )}
      </View>
      <View style={styles.inputGroup}>
        <Text style={[styles.label, { color: theme.text }]}>Referral code (optional)</Text>
        <View style={[styles.inputContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <TextInput
            style={[styles.input, { color: theme.text }]}
            placeholder="Enter a friend's referral code"
            placeholderTextColor={theme.placeholder}
            value={referralCode}
            onChangeText={setReferralCode}
            autoCapitalize="characters"
            autoCorrect={false}
            editable={!disabled}
          />
        </View>
      </View>
    </>
  );
}

function SecurityQuestionsBlock({
  theme,
  securityQuestions,
  securityFields,
  onOpenPicker,
  onAnswerChange,
  disabled,
}: {
  theme: ThemeColors;
  securityQuestions: { id: number; question: string }[];
  securityFields: [{ questionId: number | null; answer: string }, { questionId: number | null; answer: string }, { questionId: number | null; answer: string }];
  onOpenPicker: (index: 0 | 1 | 2) => void;
  onAnswerChange: (index: 0 | 1 | 2, answer: string) => void;
  disabled: boolean;
}) {
  return (
    <View style={styles.securityQuestionsSection}>
      <Text style={[styles.securityQuestionsSubtitle, { color: theme.textSecondary }]}>
        All 3 are required for account recovery (e.g. forgot password)
      </Text>
      {([0, 1, 2] as const).map((index) => {
        const field = securityFields[index];
        const selected = field.questionId ? securityQuestions.find((q) => q.id === field.questionId) : null;
        return (
          <View key={index} style={styles.securityQuestionRow}>
            <Text style={[styles.label, { color: theme.text }]}>
              Security question {index + 1} <Text style={styles.required}>*</Text>
            </Text>
            <TouchableOpacity
              style={[styles.pickerButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
              onPress={() => onOpenPicker(index)}
              disabled={disabled}
            >
              <Text
                style={[styles.pickerButtonText, { color: selected ? theme.text : theme.textSecondary }]}
                numberOfLines={1}
              >
                {selected?.question ?? 'Select a question'}
              </Text>
              <Ionicons name="chevron-down" size={20} color={theme.textSecondary} />
            </TouchableOpacity>
            <TextInput
              style={[
                styles.securityAnswerInput,
                { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border },
              ]}
              placeholder="Your answer"
              placeholderTextColor={theme.placeholder}
              value={field.answer}
              onChangeText={(v) => onAnswerChange(index, v)}
              editable={!disabled}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        );
      })}
    </View>
  );
}

function QuestionPickerModal({
  visible,
  questions,
  selectedIds,
  currentIndex,
  onSelect,
  onClose,
  theme,
}: {
  visible: boolean;
  questions: { id: number; question: string }[];
  selectedIds: (number | null)[];
  currentIndex: 0 | 1 | 2 | null;
  onSelect: (questionId: number) => void;
  onClose: () => void;
  theme: ThemeColors;
}) {
  const filtered = questions.filter(
    (q) =>
      selectedIds[currentIndex ?? -1] === q.id ||
      !selectedIds.some((id, i) => i !== currentIndex && id === q.id)
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
          <Text style={[styles.modalTitle, { color: theme.text }]}>
            Select question {(currentIndex ?? 0) + 1}
          </Text>
          <FlatList
            data={filtered}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.modalOption, { borderBottomColor: theme.border }]}
                onPress={() => onSelect(item.id)}
              >
                <Text style={[styles.modalOptionText, { color: theme.text }]}>{item.question}</Text>
              </TouchableOpacity>
            )}
          />
          <TouchableOpacity style={[styles.modalCancel, { borderColor: theme.border }]} onPress={onClose}>
            <Text style={[styles.modalCancelText, { color: theme.textSecondary }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  content: { flex: 1 },
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
    alignItems: 'center',
  },
  signingInSection: {
    alignItems: 'center',
    paddingVertical: 32,
    width: '100%',
  },
  inputGroup: {
    marginBottom: 18,
    paddingHorizontal: 16,
    width: '100%',
  },
  buttonGroup: {
    paddingHorizontal: 16,
    width: '100%',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  required: {
    color: BeeColors.red[600],
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 56,
  },
  input: {
    flex: 1,
    fontSize: 16,
  },
  inputLeadingIcon: {
    marginRight: 12,
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
    paddingHorizontal: 16,
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
    marginTop: 10,
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
    marginTop: 12,
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
    justifyContent: 'center',
    gap: 6,
    marginTop: 10,
    width: '100%',
    alignSelf: 'center',
  },
  timerText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#000000',
  },
  statusIndicator: {
    marginTop: 4,
    paddingHorizontal: 4,
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
    height: 56,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
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
  channelToggle: {
    alignItems: 'center',
    paddingTop: 16,
  },
  channelToggleText: {
    fontSize: 14,
    fontWeight: '600',
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
  securityQuestionsSection: {
    marginTop: 4,
    width: '100%',
    paddingHorizontal: 16,
  },
  securityQuestionsSubtitle: {
    fontSize: 12,
    marginBottom: 12,
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
    fontSize: 17,
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
  policyAgreementRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  policyCheckbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  policyAgreementText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  policyLink: {
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  policyModalContainer: {
    flex: 1,
  },
  policyModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  policyModalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  policyWebview: {
    flex: 1,
  },
  policyWebviewLoading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  policyModalFooter: {
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  policyScrollHint: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 10,
  },
  policyAcceptButton: {
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  policyAcceptButtonDisabled: {
    opacity: 0.45,
  },
  policyAcceptButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1d180c',
  },
});

function PolicyAgreementCheckbox({
  theme,
  checked,
  onToggle,
  onOpenDocument,
  leadingText,
  linkLabel,
  disabled,
}: {
  theme: ThemeColors;
  checked: boolean;
  onToggle: () => void;
  onOpenDocument: () => void;
  leadingText: string;
  linkLabel: string;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      style={styles.policyAgreementRow}
      onPress={onToggle}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <View
        style={[
          styles.policyCheckbox,
          { borderColor: theme.border },
          checked && { backgroundColor: BeeColors.yellow[400], borderColor: BeeColors.yellow[400] },
        ]}
      >
        {checked && <Ionicons name="checkmark" size={14} color="#1d180c" />}
      </View>
      <Text style={[styles.policyAgreementText, { color: theme.text }]}>
        {leadingText}{' '}
        {/* Nested Text handles its own press, so tapping the link opens the document
            instead of toggling the checkbox. */}
        <Text
          style={[styles.policyLink, { color: theme.text }]}
          onPress={onOpenDocument}
          suppressHighlighting
        >
          {linkLabel}
        </Text>
        .
      </Text>
    </TouchableOpacity>
  );
}

function PolicyDocumentModal({
  theme,
  visible,
  title,
  url,
  onClose,
  onAccept,
}: {
  theme: ThemeColors;
  visible: boolean;
  title: string;
  url: string;
  onClose: () => void;
  onAccept: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [reachedEnd, setReachedEnd] = useState(false);

  // Re-arm the scroll gate every time the document is reopened.
  useEffect(() => {
    if (visible) setReachedEnd(false);
  }, [visible]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View
        style={[
          styles.policyModalContainer,
          { backgroundColor: theme.surface, paddingTop: insets.top },
        ]}
      >
        <View style={[styles.policyModalHeader, { borderBottomColor: theme.border }]}>
          <Text style={[styles.policyModalTitle, { color: theme.text }]}>{title}</Text>
          <TouchableOpacity
            onPress={onClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel={`Close ${title}`}
          >
            <Ionicons name="close" size={24} color={theme.text} />
          </TouchableOpacity>
        </View>

        <WebView
          source={{ uri: url }}
          style={styles.policyWebview}
          originWhitelist={['http://*', 'https://*']}
          startInLoadingState
          renderLoading={() => (
            <View style={[styles.policyWebviewLoading, { backgroundColor: theme.surface }]}>
              <ActivityIndicator size="large" color={theme.primary} />
            </View>
          )}
          // Hides the site's sticky nav "Sign In" button (the header's only <button>) and reports
          // back once the reader hits the bottom. Injected as CSS so it survives Next.js hydration
          // re-rendering the header, which a one-shot element.remove() would not.
          injectedJavaScript={POLICY_INJECTED_JS}
          onMessage={(event) => {
            if (event.nativeEvent.data === 'reached-end') setReachedEnd(true);
          }}
        />

        <View
          style={[
            styles.policyModalFooter,
            { borderTopColor: theme.border, paddingBottom: insets.bottom + 16 },
          ]}
        >
          {!reachedEnd && (
            <Text style={[styles.policyScrollHint, { color: theme.textSecondary }]}>
              Please scroll to the end of the document to continue.
            </Text>
          )}
          <TouchableOpacity
            style={[
              styles.policyAcceptButton,
              { backgroundColor: BeeColors.yellow[400] },
              !reachedEnd && styles.policyAcceptButtonDisabled,
            ]}
            onPress={onAccept}
            disabled={!reachedEnd}
            activeOpacity={0.8}
          >
            <Text style={styles.policyAcceptButtonText}>I have read and agree</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
