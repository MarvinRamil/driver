import { BeeColors, BRAND_YELLOW } from "@/constants/theme";
import { useAuth, useLogin } from "@/features/auth";
import { useTheme } from "@/shared/hooks/use-theme";
import { biometricAuth } from "@/shared/services/biometricAuth";
import { biometricStorage } from "@/shared/services/biometricStorage";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState, useRef } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Image as ExpoImage } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LIMITS, trimToMax } from "@/shared/constants/validation";

// Import images as constants for reliable bundling in release builds
const adaptiveIcon = require('../assets/images/adaptive-icon.png');

/** Once true, we do not auto-prompt biometric again this app session (avoids retrigger on remount/return to login). */
let hasAutoPromptedBiometricThisSession = false;

/**
 * Login screen component
 * Allows drivers to authenticate with email and password
 * Uses useLogin hook for form state and submission
 * Handles safe areas to prevent content from overlapping system UI
 */
export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const router = useRouter();
  const { login: authLogin } = useAuth();
  const {
    email,
    password,
    isLoading,
    error,
    setEmail,
    setPassword,
    handleLogin,
    clearError,
    setError,
  } = useLogin();

  // Password visibility state
  const [showPassword, setShowPassword] = useState(false);
  
  // Biometric state
  const [isBiometricAvailable, setIsBiometricAvailable] = useState(false);
  const [isBiometricReady, setIsBiometricReady] = useState(false);
  const [biometricType, setBiometricType] = useState<string>('Biometric');
  const [isBiometricLoading, setIsBiometricLoading] = useState(false);
  const [hasAutoPrompted, setHasAutoPrompted] = useState(false);
  const autoPromptTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Attempt auto biometric login. Only once per app session (no retrigger on remount or return to login).
   */
  const attemptAutoBiometricLogin = async () => {
    if (isBiometricLoading || isLoading || hasAutoPrompted || hasAutoPromptedBiometricThisSession) {
      return;
    }

    try {
      hasAutoPromptedBiometricThisSession = true;
      setHasAutoPrompted(true);
      await handleTouchIDLogin();
    } catch (err) {
      // Silently fail - user can login manually; do not reset session flag so we don't retrigger
      console.log('[LoginScreen] Auto biometric login skipped');
      setHasAutoPrompted(false);
    }
  };

  /**
   * Check biometric availability on mount
   */
  useEffect(() => {
    const checkBiometric = async () => {
      try {
        const available = await biometricAuth.isAvailable();
        const ready = await biometricAuth.isReady();
        const type = await biometricAuth.getBiometricTypeName();
        
        setIsBiometricAvailable(available);
        setIsBiometricReady(ready);
        setBiometricType(type);

        // Auto-prompt only once per session; skip if already prompted (e.g. remount after signup/background)
        if (ready && !hasAutoPrompted && !hasAutoPromptedBiometricThisSession && !isLoading) {
          // Small delay to ensure UI is ready
          if (autoPromptTimeoutRef.current) {
            clearTimeout(autoPromptTimeoutRef.current);
          }
          autoPromptTimeoutRef.current = setTimeout(() => {
            attemptAutoBiometricLogin();
          }, 800);
        }
      } catch (err) {
        console.warn('[LoginScreen] Error checking biometric:', err);
        setIsBiometricAvailable(false);
        setIsBiometricReady(false);
      }
    };

    checkBiometric();

    return () => {
      if (autoPromptTimeoutRef.current) {
        clearTimeout(autoPromptTimeoutRef.current);
        autoPromptTimeoutRef.current = null;
      }
    };
  }, [hasAutoPrompted, isLoading]);

  // Do NOT auto-prompt on app state change or when returning to login (remount).
  // Session flag hasAutoPromptedBiometricThisSession ensures we only prompt once per app launch.

  /**
   * Handle biometric login
   */
  const handleTouchIDLogin = async () => {
    if (isBiometricLoading || isLoading) {
      return;
    }

    setIsBiometricLoading(true);
    clearError();

    try {
      // Check if biometric is available first
      const available = await biometricAuth.isAvailable();
      if (!available) {
        setError('Biometric authentication is not available. Please enable Face ID/Touch ID/Fingerprint in your device settings.');
        setIsBiometricLoading(false);
        return;
      }

      // Check if credentials are stored
      const hasCredentials = await biometricStorage.hasStoredCredentials();
      if (!hasCredentials) {
        setError('Please login with email and password first to enable biometric login');
        setIsBiometricLoading(false);
        return;
      }

      // Authenticate with biometric and get stored credentials
      const credentials = await biometricAuth.authenticateAndGetCredentials(
        `Authenticate with ${biometricType} to login`
      );

      if (!credentials) {
        // User cancelled or authentication failed
        setIsBiometricLoading(false);
        setHasAutoPrompted(false); // Allow retry if user cancelled
        return;
      }

      // Call auth login directly with retrieved credentials (don't use setState + handleLogin:
      // state updates are async so handleLogin would see empty email/password and show "Email is required")
      await authLogin(credentials.email, credentials.password);

      // Login successful - NavigationGuard will automatically redirect to /(tabs)
      // Keep this true so auto-biometric does not immediately retrigger during route transition.
      setHasAutoPrompted(true);
      if (autoPromptTimeoutRef.current) {
        clearTimeout(autoPromptTimeoutRef.current);
        autoPromptTimeoutRef.current = null;
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Biometric login failed';
      console.error('[LoginScreen] Biometric login error:', errorMessage);
      
      // Show user-friendly error message
      if (errorMessage.includes('not available')) {
        setError('Biometric authentication is not available. Please enable Face ID/Touch ID/Fingerprint in your device settings.');
      } else if (errorMessage.includes('No stored credentials') || errorMessage.includes('not found')) {
        setError('Please login with email and password first to enable biometric login');
      } else if (!errorMessage.includes('user_cancel') && !errorMessage.includes('cancelled')) {
        setError('Biometric authentication failed. Please try again or use email and password.');
      }
    } finally {
      setIsBiometricLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
    >
      <View style={[styles.content, { paddingTop: insets.top }]}>
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + 24 },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header Image Area */}
          <View style={styles.headerImageContainer}>
            <View style={[styles.headerImage, { backgroundColor: BRAND_YELLOW }]}>
              <View style={styles.heroContent}>
                <ExpoImage
                  source={adaptiveIcon}
                  style={styles.heroLogo}
                  contentFit="contain"
                />
                <Text style={styles.heroText}>BEE ON-DEMAND</Text>
              </View>
            </View>
          </View>

          {/* Headline */}
          <View style={styles.headlineContainer}>
            <Text style={[styles.headline, { color: theme.text }]}>
              Welcome Back, Driver!
            </Text>
            <Text style={[styles.subheadline, { color: theme.textSecondary }]}>
              Log in to start your shift
            </Text>
          </View>

          {/* Login Form */}
          <View style={styles.form}>
            {/* Email/Username Field */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.text }]}>
                Email or Phone
              </Text>
              <View style={[styles.inputContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <TextInput
                  style={[styles.input, { color: theme.text }]}
                  placeholder="Enter your email or phone number"
                  placeholderTextColor={theme.placeholder}
                  value={email}
                  onChangeText={(text) => {
                    setEmail(trimToMax(text, LIMITS.EMAIL));
                    clearError();
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isLoading}
                  maxLength={LIMITS.EMAIL}
                />
              </View>
            </View>

            {/* Password Field */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.text }]}>Password</Text>
              <View style={styles.passwordRow}>
                <View style={[styles.inputContainer, { backgroundColor: theme.surface, borderColor: theme.border, flex: 1 }]}>
                  <TextInput
                    style={[styles.input, { color: theme.text }]}
                    placeholder="Enter your Password"
                    placeholderTextColor={theme.placeholder}
                    value={password}
                    onChangeText={(text) => {
                      setPassword(text);
                      clearError();
                    }}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!isLoading}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    style={styles.visibilityButton}
                  >
                    <Ionicons
                      name={showPassword ? "eye-off" : "eye"}
                      size={24}
                      color={theme.textSecondary}
                    />
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  style={[
                    styles.biometricButtonInline,
                    { backgroundColor: theme.surface, borderColor: theme.border },
                    (isBiometricLoading || isLoading) && styles.biometricButtonDisabled
                  ]}
                  onPress={handleTouchIDLogin}
                  disabled={isBiometricLoading || isLoading}
                >
                  {isBiometricLoading ? (
                    <ActivityIndicator size="small" color={theme.text} />
                  ) : (
                    <Ionicons
                      name="finger-print"
                      size={24}
                      color={theme.text}
                    />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Error Message */}
            {error && (
              <View style={styles.errorContainer}>
                <Ionicons
                  name="alert-circle"
                  size={16}
                  color={BeeColors.red[600]}
                />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {/* Forgot Password Link */}
            <View style={styles.forgotPasswordContainer}>
              <TouchableOpacity onPress={() => router.push('/forgot-password')}>
                <Text style={[styles.forgotPasswordText, { color: theme.textSecondary }]}>
                  Forgot Password?
                </Text>
              </TouchableOpacity>
            </View>

            {/* Login Button */}
            <View style={styles.loginButtonContainer}>
              <TouchableOpacity
                style={[styles.loginButton, isLoading && styles.loginButtonDisabled, { backgroundColor: theme.primary }]}
                onPress={handleLogin}
                disabled={isLoading}
                activeOpacity={0.98}
              >
                {isLoading ? (
                  <Text style={[styles.loginButtonText, { color: theme.primaryText }]}>
                    Logging in...
                  </Text>
                ) : (
                  <Text style={[styles.loginButtonText, { color: theme.primaryText }]}>
                    Log In
                  </Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Sign up link */}
            <View style={styles.signupContainer}>
              <Text style={[styles.signupPrompt, { color: theme.textSecondary }]}>
                Don't have an account?{" "}
              </Text>
              <TouchableOpacity onPress={() => router.push("/signup")}>
                <Text style={[styles.signupLink, { color: theme.primary }]}>
                  Sign up
                </Text>
              </TouchableOpacity>
            </View>

          </View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

/**
 * Login screen styles
 * Colors match HTML design system:
 * - primary: #f4ca25 (yellow-400)
 * - background-light: #f8f8f5
 * - background-dark: #221e10
 */
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
  headerImageContainer: {
    width: "100%",
    marginTop: 16,
    marginBottom: 24,
  },
  headerImage: {
    width: "100%",
    minHeight: 260,
    borderRadius: 8,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
  heroContent: {
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  heroLogo: {
    width: 120,
    height: 120,
  },
  heroText: {
    fontSize: 28,
    fontWeight: "700",
    color: BeeColors.gray[900],
    letterSpacing: 2,
  },
  headlineContainer: {
    paddingTop: 24,
    paddingBottom: 8,
    alignItems: "center",
  },
  headline: {
    fontSize: 32,
    fontWeight: "700",
    lineHeight: 40,
    textAlign: "center",
  },
  subheadline: {
    fontSize: 14,
    fontWeight: "500",
    marginTop: 8,
    textAlign: "center",
  },
  form: {
    width: "100%",
    maxWidth: 480,
    alignSelf: "center",
    marginTop: 24,
  },
  inputGroup: {
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  passwordRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  label: {
    fontSize: 16,
    fontWeight: "500",
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
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
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
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
  forgotPasswordContainer: {
    alignItems: "flex-end",
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  forgotPasswordText: {
    fontSize: 14,
    fontWeight: "500",
  },
  loginButtonContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    width: "100%",
    alignItems: "center",
  },
  signupContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 8,
    gap: 6,
  },
  signupPrompt: {
    fontSize: 18,
    fontWeight: "500",
    lineHeight: 26,
  },
  signupLink: {
    fontSize: 19,
    fontWeight: "700",
    lineHeight: 26,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  loginButton: {
    width: "100%",
    maxWidth: 480,
    height: 48,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: BeeColors.yellow[500],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  loginButtonText: {
    fontSize: 16,
    fontWeight: "700",
  },
  biometricButtonInline: {
    width: 56,
    height: 56,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  biometricButtonDisabled: {
    opacity: 0.5,
  },
});

