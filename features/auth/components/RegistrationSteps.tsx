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
  Image,
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
import { DriverLicenseScanner } from './DriverLicenseScanner';
import { SelfieCapture } from './SelfieCapture';
import { apiClient } from '@/shared/services/apiClient';
import { useAuthContext } from '../context/AuthContext';

type RegistrationStep =
  | 'enter-email'
  | 'enter-otp'
  | 'enter-details'
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
  otp: string;
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

  const [currentStep, setCurrentStep] = useState<RegistrationStep>('enter-email');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registrationData, setRegistrationData] = useState<RegistrationData>({
    email: '',
    password: '',
    fullName: '',
    otp: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [registrationStatus, setRegistrationStatus] = useState<RegistrationStatus | null>(null);
  const { refreshUser } = useAuthContext();

  // Security questions (required for account recovery)
  const [securityQuestionsList, setSecurityQuestionsList] = useState<Array<{ id: number; question: string }>>([]);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<[number | null, number | null, number | null]>([null, null, null]);
  const [questionAnswers, setQuestionAnswers] = useState<[string, string, string]>(['', '', '']);
  const [questionPickerIndex, setQuestionPickerIndex] = useState<number | null>(null);

  useEffect(() => {
    authService.getSecurityQuestions().then(setSecurityQuestionsList).catch(() => {});
  }, []);

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
    for (let i = 0; i < 3; i++) {
      if (!selectedQuestionIds[i]) return `Please select security question ${i + 1}`;
      if (!questionAnswers[i] || questionAnswers[i].trim().length < 3) {
        return `Please provide an answer for security question ${i + 1} (at least 3 characters)`;
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

  /** Step 1: Send OTP to email (OTP-first flow) */
  const handleSendOtp = async () => {
    if (!registrationData.email || !isValidEmail(registrationData.email)) {
      setError('Please enter a valid email address');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      await authService.sendOtp({ email: registrationData.email.trim() });
      setCurrentStep('enter-otp');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send verification code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  /** Resend OTP */
  const handleResendOtp = async () => {
    if (!registrationData.email) return;
    setIsLoading(true);
    setError(null);
    try {
      await authService.resendOtp(registrationData.email.trim());
      Alert.alert('Code sent', 'A new verification code has been sent to your email.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resend code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  /** Step 2: Verify OTP only. Show clear success or invalid feedback, then proceed to details. */
  const handleContinueFromOtp = async () => {
    setError(null);
    if (!registrationData.otp || registrationData.otp.trim().length !== 6) {
      setError('Please enter the 6-digit code from your email');
      Alert.alert('Invalid code', 'Please enter the full 6-digit code from your email.');
      return;
    }
    setIsLoading(true);
    try {
      await authService.verifyOtp({
        email: registrationData.email.trim(),
        otp: registrationData.otp.trim(),
      });
      Alert.alert(
        'Code verified',
        'Your email is verified. Enter your name and password to create your account.',
        [{ text: 'Continue', onPress: () => setCurrentStep('enter-details') }]
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Invalid or expired code. Please try again.';
      setError(message);
      Alert.alert('Invalid code', message);
    } finally {
      setIsLoading(false);
    }
  };

  /** Step 3: Create account using existing Register endpoint (email already verified via OTP), then login. */
  const handleCreateAccountAfterOtp = async () => {
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      await authService.register({
        email: registrationData.email.trim(),
        password: registrationData.password,
        fullName: registrationData.fullName.trim(),
        role: 'Driver',
        ...buildSecurityQuestionsPayload(),
      });
      await authService.login({
        email: registrationData.email.trim(),
        password: registrationData.password,
      });
      await refreshUser();
      Alert.alert(
        'Account created',
        'Please log in to continue with your driver registration and submit your documents.',
        [
          {
            text: 'Continue',
            onPress: () => router.replace('/(tabs)'),
          },
        ]
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Registration failed. Please try again.';
      setError(message);
      Alert.alert('Error', message);
    } finally {
      setIsLoading(false);
    }
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
      let status: RegistrationStatus | null = null;
      try {
        status = await registrationService.checkRegistrationStatus(registrationData.email.trim());
        setRegistrationStatus(status);
      } catch (statusErr) {
        console.warn('[RegistrationSteps] Status check failed, proceeding to register:', statusErr);
      }

      if (status?.registrationComplete) {
        Alert.alert(
          'Account Exists',
          'This email is already registered. Please login instead.',
          [{ text: 'Go to Login', onPress: () => router.replace('/login') }]
        );
        setIsLoading(false);
        return;
      }

      if (status?.emailVerified && !status.registrationComplete && status.canResume) {
        setCurrentStep('resume-prompt');
        setIsLoading(false);
        return;
      }

      try {
        const response = await authService.register({
          email: registrationData.email.trim(),
          password: registrationData.password,
          fullName: registrationData.fullName.trim(),
          role: 'Driver',
          ...buildSecurityQuestionsPayload(),
        });
        if (response.requiresEmailVerification || response.message?.includes('verify')) {
          setCurrentStep('email-verification');
        } else {
          setCurrentStep('license-scan');
        }
      } catch (registerErr) {
        const errorMessage = registerErr instanceof Error ? registerErr.message : String(registerErr);
        if (
          errorMessage.toLowerCase().includes('already registered') ||
          errorMessage.toLowerCase().includes('already exists')
        ) {
          try {
            const existingStatus = await registrationService.checkRegistrationStatus(
              registrationData.email.trim()
            );
            setRegistrationStatus(existingStatus);
            if (existingStatus.emailVerified && !existingStatus.registrationComplete) {
              setCurrentStep('resume-prompt');
              setIsLoading(false);
              return;
            }
            if (!existingStatus.emailVerified) {
              setCurrentStep('email-verification');
              setIsLoading(false);
              return;
            }
          } catch {
            setError(errorMessage);
          }
        } else {
          setError(errorMessage);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed. Please try again.');
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

  // OTP flow: Step 1 - Enter email and send OTP
  if (currentStep === 'enter-email') {
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
              <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                <Ionicons name="arrow-back" size={24} color={theme.text} />
              </TouchableOpacity>
              <Text style={[styles.headline, { color: theme.text }]}>Create Driver Account</Text>
              <Text style={[styles.subheadline, { color: theme.textSecondary }]}>
                Enter your email to receive a verification code
              </Text>
            </View>
            <View style={styles.form}>
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: theme.text }]}>Email address</Text>
                <View style={[styles.inputContainer, styles.inputContainerLarge, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <TextInput
                    style={[styles.input, styles.inputLarge, { color: theme.text }]}
                    placeholder="e.g. you@example.com"
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

  // OTP flow: Step 2 – Code only (email already in state)
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
              <TouchableOpacity style={styles.backButton} onPress={() => setCurrentStep('enter-email')}>
                <Ionicons name="arrow-back" size={24} color={theme.text} />
              </TouchableOpacity>
              <Text style={[styles.headline, { color: theme.text }]}>Verification code</Text>
              <Text style={[styles.subheadline, { color: theme.textSecondary }]}>
                We sent a 6-digit code to {registrationData.email}
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
                      setRegistrationData({ ...registrationData, otp: text.replace(/\D/g, '').slice(0, 6) });
                      setError(null);
                    }}
                    keyboardType="number-pad"
                    maxLength={6}
                    editable={!isLoading}
                  />
                </View>
                <TouchableOpacity onPress={handleResendOtp} disabled={isLoading} style={styles.resendButton}>
                  <Text style={[styles.resendText, { color: theme.primary }]}>Resend code</Text>
                </TouchableOpacity>
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

  // Reusable security questions block + picker modal
  const securityQuestionsBlock = (
    <View style={[styles.securityQuestionsSection, { borderTopColor: theme.border }]}>
      <Text style={[styles.securityQuestionsTitle, { color: theme.text }]}>
        Security questions <Text style={styles.required}>*</Text>
      </Text>
      <Text style={[styles.securityQuestionsSubtitle, { color: theme.textSecondary }]}>
        All 3 are required for account recovery (e.g. forgot password)
      </Text>
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
                next[index] = text;
                setQuestionAnswers(next);
                setError(null);
              }}
              editable={!isLoading}
              autoCapitalize="none"
              autoCorrect={false}
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

  // OTP flow: Step 3 – Full name + password (email and OTP already in state)
  if (currentStep === 'enter-details') {
    return (
      <>
        {questionPickerModal}
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: theme.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
        {questionPickerModal}
        <View style={[styles.content, { paddingTop: insets.top }]}>
          <ScrollView
            contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
            keyboardShouldPersistTaps="handled">
            <View style={styles.headerContainer}>
              <TouchableOpacity style={styles.backButton} onPress={() => setCurrentStep('enter-otp')}>
                <Ionicons name="arrow-back" size={24} color={theme.text} />
              </TouchableOpacity>
              <Text style={[styles.headline, { color: theme.text }]}>Create your account</Text>
              <Text style={[styles.subheadline, { color: theme.textSecondary }]}>
                Use the email we sent the code to: {registrationData.email}
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
                      setRegistrationData({ ...registrationData, fullName: text });
                      setError(null);
                    }}
                    autoCapitalize="words"
                    editable={!isLoading}
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
              {securityQuestionsBlock}
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
      </>
    );
  }

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
    <>
      {questionPickerModal}
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

            {securityQuestionsBlock}

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
    </>
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
  securityQuestionsSection: {
    marginTop: 24,
    paddingTop: 20,
    borderTopWidth: 1,
    width: '100%',
  },
  securityQuestionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  required: {
    color: BeeColors.red[600],
  },
  securityQuestionsSubtitle: {
    fontSize: 12,
    marginBottom: 16,
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
