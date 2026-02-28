import { BeeColors } from '@/constants/theme';
import { useTheme } from '@/shared/hooks/use-theme';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import React, { useState, useRef, useEffect } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { authService } from '@/features/auth/services/authService';
import { LIMITS, trimToMax } from '@/shared/constants/validation';

type Step = 'email' | 'otp' | 'security-questions' | 'new-password' | 'success';

/**
 * Forgot Password screen (Driver app)
 * Flow: Email → OTP → Security Questions → New Password → Success (then login)
 * Resets local tokens after password reset.
 */
export default function ForgotPasswordScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const router = useRouter();

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const verifiedOtpRef = useRef('');
  const [securityQuestions, setSecurityQuestions] = useState<Array<{ number: number; questionId: number; question: string }>>([]);
  const [securityAnswers, setSecurityAnswers] = useState<Array<{ questionNumber: number; answer: string }>>([]);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleRequestOtp = async () => {
    if (!email.trim()) {
      setError('Email is required');
      return;
    }
    if (email.trim().length > LIMITS.EMAIL) {
      setError(`Email must be at most ${LIMITS.EMAIL} characters`);
      return;
    }
    setError(null);
    const normalizedEmail = email.trim().toLowerCase();
    setEmail(normalizedEmail);
    setOtp('');
    verifiedOtpRef.current = '';
    setIsLoading(true);
    try {
      await authService.forgotPasswordMobile({ email: normalizedEmail });
      setStep('otp');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send verification code');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = () => {
    const digits = (otp || '').trim().replace(/\D/g, '').slice(0, LIMITS.OTP_LENGTH);
    if (digits.length !== LIMITS.OTP_LENGTH) {
      setError('Please enter a valid 6-digit code');
      return;
    }
    setOtp(digits);
    verifiedOtpRef.current = digits;
    setError(null);
    setStep('security-questions');
  };

  useEffect(() => {
    if (step !== 'security-questions' || !email) return;
    let cancelled = false;
    authService.getForgotPasswordQuestions(email).then((questions) => {
      if (!cancelled) {
        if (questions.length > 0) {
          setSecurityQuestions(questions);
          setError(null);
        } else {
          setError('Security questions not found. Please contact support for password reset.');
        }
      }
    }).catch(() => {
      if (!cancelled) setSecurityQuestions([]);
    });
    return () => { cancelled = true; };
  }, [step, email]);

  const handleSecurityAnswerChange = (questionNumber: number, answer: string) => {
    setSecurityAnswers((prev) => {
      const filtered = prev.filter((a) => a.questionNumber !== questionNumber);
      if (answer.trim()) return [...filtered, { questionNumber, answer: answer.trim() }];
      return filtered;
    });
    setError(null);
  };

  const handleContinueFromSecurityQuestions = () => {
    if (securityQuestions.length > 0 && securityAnswers.length === 0) {
      setError('Please answer at least one security question');
      return;
    }
    setError(null);
    setStep('new-password');
  };

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < LIMITS.PASSWORD_MIN) {
      setError(`Password must be at least ${LIMITS.PASSWORD_MIN} characters`);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    const otpToUse = verifiedOtpRef.current || otp || '';
    const otpCleaned = otpToUse.trim().replace(/\D/g, '').slice(0, LIMITS.OTP_LENGTH);
    if (!otpCleaned || otpCleaned.length !== LIMITS.OTP_LENGTH) {
      setError('Please enter a valid 6-digit verification code');
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      await authService.resetPassword({
        email: email.trim().toLowerCase(),
        otp: otpCleaned,
        newPassword,
        securityAnswers: securityAnswers.length > 0 ? securityAnswers : undefined,
      });
      setStep('success');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to reset password');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToLogin = () => {
    router.replace('/login');
  };

  const goBack = () => {
    if (step === 'email') router.back();
    else if (step === 'otp') {
      setStep('email');
      setOtp('');
      verifiedOtpRef.current = '';
    } else if (step === 'security-questions') setStep('otp');
    else if (step === 'new-password') setStep('security-questions');
    setError(null);
  };

  if (step === 'success') {
    return (
      <KeyboardAvoidingView style={[styles.container, { backgroundColor: theme.background }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={[styles.content, { paddingTop: insets.top }]}>
          <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]} showsVerticalScrollIndicator={false}>
            <View style={styles.topHeader}>
              <TouchableOpacity onPress={handleBackToLogin} style={styles.backButton}>
                <Ionicons name="arrow-back" size={24} color={theme.text} />
              </TouchableOpacity>
              <Text style={[styles.helpText, { color: theme.textSecondary }]}>Help</Text>
            </View>
            <View style={styles.successContainer}>
              <View style={[styles.successIconContainer, { backgroundColor: BeeColors.green[50] }]}>
                <Ionicons name="checkmark-circle" size={64} color={BeeColors.green[600]} />
              </View>
              <Text style={[styles.successTitle, { color: theme.text }]}>Password reset successful</Text>
              <Text style={[styles.successMessage, { color: theme.textSecondary }]}>
                Please log in with your new password.
              </Text>
              <TouchableOpacity style={[styles.submitButton, { backgroundColor: BeeColors.yellow[400] }]} onPress={handleBackToLogin}>
                <Text style={styles.submitButtonText}>Go to Login</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView style={[styles.container, { backgroundColor: theme.background }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
      <View style={[styles.content, { paddingTop: insets.top }]}>
        <View style={styles.topHeader}>
          <TouchableOpacity onPress={goBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.helpText, { color: theme.textSecondary }]}>Help</Text>
        </View>

        <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {step === 'email' && (
            <>
              <View style={styles.titleSection}>
                <Text style={[styles.title, { color: theme.text }]}>Forgot password?</Text>
                <Text style={[styles.subtitle, { color: theme.textSecondary }]}>Enter your email and we'll send a verification code.</Text>
              </View>
              <View style={styles.form}>
                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: theme.text }]}>Email</Text>
                  <View style={[styles.inputContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                    <Ionicons name="mail" size={20} color={theme.textSecondary} style={styles.inputIcon} />
                    <TextInput style={[styles.input, { color: theme.text }]} placeholder="Enter your email" placeholderTextColor={theme.placeholder} value={email} onChangeText={(t) => { setEmail(trimToMax(t, LIMITS.EMAIL)); setError(null); }} keyboardType="email-address" autoCapitalize="none" editable={!isLoading} maxLength={LIMITS.EMAIL} />
                  </View>
                </View>
                {error ? <View style={styles.errorContainer}><Ionicons name="alert-circle" size={16} color={BeeColors.red[600]} /><Text style={styles.errorText}>{error}</Text></View> : null}
                <TouchableOpacity style={[styles.submitButton, isLoading && styles.submitButtonDisabled, { backgroundColor: theme.primary }]} onPress={handleRequestOtp} disabled={isLoading || !email.trim()}>
                  <Text style={styles.submitButtonText}>{isLoading ? 'Sending...' : 'Send verification code'}</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {step === 'otp' && (
            <>
              <View style={styles.titleSection}>
                <Text style={[styles.title, { color: theme.text }]}>Enter verification code</Text>
                <Text style={[styles.subtitle, { color: theme.textSecondary }]}>We sent a 6-digit code to{"\n"}<Text style={{ fontWeight: '600' }}>{email}</Text></Text>
              </View>
              <View style={styles.form}>
                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: theme.text }]}>Code</Text>
                  <View style={[styles.inputContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                    <TextInput style={[styles.input, { color: theme.text }]} placeholder="000000" placeholderTextColor={theme.placeholder} value={otp} onChangeText={(t) => { setOtp(t.replace(/\D/g, '').slice(0, LIMITS.OTP_LENGTH)); setError(null); }} keyboardType="number-pad" maxLength={LIMITS.OTP_LENGTH} autoFocus />
                  </View>
                </View>
                {error ? <View style={styles.errorContainer}><Ionicons name="alert-circle" size={16} color={BeeColors.red[600]} /><Text style={styles.errorText}>{error}</Text></View> : null}
                <TouchableOpacity style={[styles.submitButton, { backgroundColor: theme.primary }]} onPress={handleVerifyOtp} disabled={(otp || '').replace(/\D/g, '').length !== LIMITS.OTP_LENGTH}>
                  <Text style={styles.submitButtonText}>Continue</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.resendButton} onPress={handleRequestOtp} disabled={isLoading}>
                  <Text style={[styles.resendButtonText, { color: theme.textSecondary }]}>{isLoading ? 'Resending...' : 'Resend code'}</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {step === 'security-questions' && (
            <>
              <View style={styles.titleSection}>
                <Text style={[styles.title, { color: theme.text }]}>Security questions</Text>
                <Text style={[styles.subtitle, { color: theme.textSecondary }]}>Answer at least one of your security questions.</Text>
              </View>
              <View style={styles.form}>
                {securityQuestions.length > 0 ? (
                  <>
                    {securityQuestions.map((q) => (
                      <View key={q.number} style={styles.inputGroup}>
                        <Text style={[styles.label, { color: theme.text }]}>{q.question}</Text>
                        <View style={[styles.inputContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                          <TextInput style={[styles.input, { color: theme.text }]} placeholder="Your answer" placeholderTextColor={theme.placeholder} value={securityAnswers.find((a) => a.questionNumber === q.number)?.answer ?? ''} onChangeText={(t) => handleSecurityAnswerChange(q.number, trimToMax(t, LIMITS.SECURITY_ANSWER_MAX))} autoCapitalize="none" maxLength={LIMITS.SECURITY_ANSWER_MAX} />
                        </View>
                      </View>
                    ))}
                    {error ? <View style={styles.errorContainer}><Ionicons name="alert-circle" size={16} color={BeeColors.red[600]} /><Text style={styles.errorText}>{error}</Text></View> : null}
                    <TouchableOpacity style={[styles.submitButton, { backgroundColor: theme.primary }]} onPress={handleContinueFromSecurityQuestions}>
                      <Text style={styles.submitButtonText}>Continue</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    {error ? <View style={styles.errorContainer}><Ionicons name="alert-circle" size={16} color={BeeColors.red[600]} /><Text style={styles.errorText}>{error}</Text></View> : null}
                    <TouchableOpacity style={[styles.submitButton, styles.submitButtonDisabled]} disabled>
                      <Text style={styles.submitButtonText}>Loading...</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </>
          )}

          {step === 'new-password' && (
            <>
              <View style={styles.titleSection}>
                <Text style={[styles.title, { color: theme.text }]}>New password</Text>
                <Text style={[styles.subtitle, { color: theme.textSecondary }]}>Enter your new password below.</Text>
              </View>
              <View style={styles.form}>
                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: theme.text }]}>New password</Text>
                  <View style={[styles.inputContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                    <Ionicons name="lock-closed" size={20} color={theme.textSecondary} style={styles.inputIcon} />
                    <TextInput style={[styles.input, { color: theme.text }]} placeholder="New password" placeholderTextColor={theme.placeholder} value={newPassword} onChangeText={(t) => { setNewPassword(t); setError(null); }} secureTextEntry={!showPassword} autoCapitalize="none" />
                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.visibilityButton}>
                      <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color={theme.textSecondary} />
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: theme.text }]}>Confirm password</Text>
                  <View style={[styles.inputContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                    <Ionicons name="lock-closed" size={20} color={theme.textSecondary} style={styles.inputIcon} />
                    <TextInput style={[styles.input, { color: theme.text }]} placeholder="Confirm new password" placeholderTextColor={theme.placeholder} value={confirmPassword} onChangeText={(t) => { setConfirmPassword(t); setError(null); }} secureTextEntry={!showConfirmPassword} autoCapitalize="none" />
                    <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)} style={styles.visibilityButton}>
                      <Ionicons name={showConfirmPassword ? 'eye-off' : 'eye'} size={20} color={theme.textSecondary} />
                    </TouchableOpacity>
                  </View>
                </View>
                {error ? <View style={styles.errorContainer}><Ionicons name="alert-circle" size={16} color={BeeColors.red[600]} /><Text style={styles.errorText}>{error}</Text></View> : null}
                <TouchableOpacity style={[styles.submitButton, isLoading && styles.submitButtonDisabled, { backgroundColor: theme.primary }]} onPress={handleResetPassword} disabled={isLoading || !newPassword || !confirmPassword}>
                  <Text style={styles.submitButtonText}>{isLoading ? 'Resetting...' : 'Reset password'}</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1 },
  topHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16, width: '100%' },
  backButton: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  helpText: { fontSize: 14, fontWeight: '500' },
  scrollContent: { flexGrow: 1, paddingHorizontal: 16, maxWidth: 448, width: '100%', alignSelf: 'center' },
  titleSection: { marginBottom: 32, alignItems: 'center' },
  title: { fontSize: 30, fontWeight: '700', marginBottom: 8, lineHeight: 36 },
  subtitle: { fontSize: 16, lineHeight: 24, textAlign: 'center' },
  form: { width: '100%' },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '500', marginBottom: 8 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 8, paddingHorizontal: 16, height: 56 },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, fontSize: 16 },
  visibilityButton: { padding: 4 },
  errorContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: BeeColors.red[50], borderWidth: 1, borderColor: BeeColors.red[200], borderRadius: 8, padding: 12, marginBottom: 20, gap: 8 },
  errorText: { flex: 1, fontSize: 14, color: BeeColors.red[700] },
  submitButton: { width: '100%', height: 56, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginTop: 12 },
  submitButtonDisabled: { opacity: 0.6 },
  submitButtonText: { fontSize: 16, fontWeight: '700', color: '#000' },
  resendButton: { marginTop: 16, alignItems: 'center' },
  resendButtonText: { fontSize: 14, fontWeight: '500' },
  successContainer: { alignItems: 'center', paddingVertical: 32 },
  successIconContainer: { width: 120, height: 120, borderRadius: 60, justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
  successTitle: { fontSize: 24, fontWeight: '700', marginBottom: 12, textAlign: 'center' },
  successMessage: { fontSize: 16, lineHeight: 24, textAlign: 'center', marginBottom: 32 },
});
