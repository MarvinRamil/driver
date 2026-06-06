import { BeeColors, BRAND_YELLOW } from "@/constants/theme";
import { useAuth, useLogin } from "@/features/auth";
import { useTheme } from "@/shared/hooks/use-theme";
import { biometricAuth } from "@/shared/services/biometricAuth";
import { biometricStorage } from "@/shared/services/biometricStorage";
import {
  clearLastLoginUser,
  getLastLoginUser,
  type LastLoginUser,
} from "@/shared/services/lastLoginStorage";
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

const adaptiveIcon = require('../assets/images/adaptive-icon.png');

let hasAutoPromptedBiometricThisSession = false;

function getInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  if (parts[0]?.length >= 2) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return parts[0]?.slice(0, 1).toUpperCase() ?? "?";
}

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

  const [showPassword, setShowPassword] = useState(false);
  const [isBiometricAvailable, setIsBiometricAvailable] = useState(false);
  const [isBiometricReady, setIsBiometricReady] = useState(false);
  const [biometricType, setBiometricType] = useState<string>('Biometric');
  const [isBiometricLoading, setIsBiometricLoading] = useState(false);
  const [hasAutoPrompted, setHasAutoPrompted] = useState(false);
  const autoPromptTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [lastUser, setLastUser] = useState<LastLoginUser | null>(null);
  const [lastUserChecked, setLastUserChecked] = useState(false);

  const viewMode: "loading" | "welcome_back" | "full_login" = !lastUserChecked
    ? "loading"
    : lastUser !== null
      ? "welcome_back"
      : "full_login";
  const showWelcomeBack = viewMode === "welcome_back";

  useEffect(() => {
    getLastLoginUser()
      .then((user) => {
        setLastUser(user);
        setLastUserChecked(true);
      })
      .catch(() => {
        setLastUser(null);
        setLastUserChecked(true);
      });
  }, []);

  useEffect(() => {
    if (lastUser) setEmail(lastUser.email);
  }, [lastUser, setEmail]);

  const attemptAutoBiometricLogin = async () => {
    if (isBiometricLoading || isLoading || hasAutoPrompted || hasAutoPromptedBiometricThisSession) {
      return;
    }

    try {
      hasAutoPromptedBiometricThisSession = true;
      setHasAutoPrompted(true);
      await handleTouchIDLogin();
    } catch {
      setHasAutoPrompted(false);
    }
  };

  useEffect(() => {
    const checkBiometric = async () => {
      try {
        const available = await biometricAuth.isAvailable();
        const ready = await biometricAuth.isReady();
        const type = await biometricAuth.getBiometricTypeName();

        setIsBiometricAvailable(available);
        setIsBiometricReady(ready);
        setBiometricType(type);

        if (ready && !hasAutoPrompted && !hasAutoPromptedBiometricThisSession && !isLoading) {
          if (autoPromptTimeoutRef.current) {
            clearTimeout(autoPromptTimeoutRef.current);
          }
          autoPromptTimeoutRef.current = setTimeout(() => {
            attemptAutoBiometricLogin();
          }, 800);
        }
      } catch {
        setIsBiometricAvailable(false);
        setIsBiometricReady(false);
      }
    };

    if (lastUserChecked) {
      checkBiometric();
    }

    return () => {
      if (autoPromptTimeoutRef.current) {
        clearTimeout(autoPromptTimeoutRef.current);
        autoPromptTimeoutRef.current = null;
      }
    };
  }, [hasAutoPrompted, isLoading, lastUserChecked]);

  const handleTouchIDLogin = async () => {
    if (isBiometricLoading || isLoading) {
      return;
    }

    setIsBiometricLoading(true);
    clearError();

    try {
      const available = await biometricAuth.isAvailable();
      if (!available) {
        setError('Biometric authentication is not available. Please enable Face ID/Touch ID/Fingerprint in your device settings.');
        setIsBiometricLoading(false);
        return;
      }

      const hasCredentials = await biometricStorage.hasStoredCredentials();
      if (!hasCredentials) {
        setError('Please login with email and password first to enable biometric login');
        setIsBiometricLoading(false);
        return;
      }

      const credentials = await biometricAuth.authenticateAndGetCredentials(
        `Authenticate with ${biometricType} to login`
      );

      if (!credentials) {
        setIsBiometricLoading(false);
        setHasAutoPrompted(false);
        return;
      }

      await authLogin(credentials.email, credentials.password);
      setHasAutoPrompted(true);
      if (autoPromptTimeoutRef.current) {
        clearTimeout(autoPromptTimeoutRef.current);
        autoPromptTimeoutRef.current = null;
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Biometric login failed';
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

  const handleSignInAsDifferentUser = async () => {
    await clearLastLoginUser();
    setLastUser(null);
    setEmail("");
    setPassword("");
    clearError();
    setHasAutoPrompted(false);
    hasAutoPromptedBiometricThisSession = false;
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
    >
      <View style={[styles.content, { paddingTop: insets.top }]}>
        {showWelcomeBack && (
          <View style={styles.topHeader}>
            <View style={styles.headerSpacer} />
            <Text style={[styles.welcomeBackHeaderTitle, { color: theme.text }]}>Welcome Back</Text>
            <View style={styles.headerSpacer} />
          </View>
        )}

        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + 24 },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {viewMode === "loading" ? (
            <View style={styles.loginLoadingWrap}>
              <ActivityIndicator size="large" color={BeeColors.yellow[500]} />
            </View>
          ) : showWelcomeBack ? (
            <>
              <View style={styles.welcomeBackProfile}>
                <View style={styles.initialsAvatar}>
                  <Text style={styles.initialsText}>
                    {getInitials(lastUser!.fullName)}
                  </Text>
                  <View style={[styles.initialsBadge, { backgroundColor: BeeColors.yellow[400], borderColor: theme.background }]}>
                    <Ionicons name="checkmark" size={14} color="#000" />
                  </View>
                </View>
                <Text style={[styles.welcomeBackName, { color: theme.text }]}>{lastUser!.fullName}</Text>
                <Text style={[styles.welcomeBackEmail, { color: theme.textSecondary }]}>{lastUser!.email}</Text>
              </View>

              <View style={styles.welcomeBackForm}>
                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: theme.text }]}>Password</Text>
                  <View style={styles.passwordRow}>
                    <View style={[styles.inputContainer, { backgroundColor: theme.surface, borderColor: theme.border, flex: 1 }]}>
                      <TextInput
                        style={[styles.input, { color: theme.text }]}
                        placeholder="Enter your password"
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
                        (isBiometricLoading || isLoading || !isBiometricReady) && styles.biometricButtonDisabled,
                      ]}
                      onPress={handleTouchIDLogin}
                      disabled={isBiometricLoading || isLoading || !isBiometricReady}
                    >
                      {isBiometricLoading ? (
                        <ActivityIndicator size="small" color={theme.text} />
                      ) : (
                        <Ionicons name="finger-print" size={24} color={theme.text} />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.forgotPasswordContainer}>
                  <TouchableOpacity onPress={() => router.push('/forgot-password')}>
                    <Text style={[styles.forgotPasswordText, { color: BeeColors.yellow[500] }]}>
                      Forgot Password?
                    </Text>
                  </TouchableOpacity>
                </View>

                {error && (
                  <View style={styles.errorContainer}>
                    <Ionicons name="alert-circle" size={16} color={BeeColors.red[600]} />
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}

                <TouchableOpacity
                  style={[styles.loginButton, isLoading && styles.loginButtonDisabled, { backgroundColor: theme.primary }]}
                  onPress={handleLogin}
                  disabled={isLoading}
                  activeOpacity={0.98}
                >
                  <Text style={[styles.loginButtonText, { color: theme.primaryText }]}>
                    {isLoading ? "Logging in..." : "Sign In"}
                  </Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity onPress={handleSignInAsDifferentUser} style={styles.differentUserLink}>
                <Text style={[styles.differentUserText, { color: theme.textSecondary }]}>
                  Sign in as different user
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
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

              <View style={styles.form}>
                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: theme.text }]}>Email or Phone</Text>
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
                    {isBiometricAvailable && (
                      <TouchableOpacity
                        style={[
                          styles.biometricButtonInline,
                          { backgroundColor: theme.surface, borderColor: theme.border },
                          (isBiometricLoading || isLoading) && styles.biometricButtonDisabled,
                        ]}
                        onPress={handleTouchIDLogin}
                        disabled={isBiometricLoading || isLoading}
                      >
                        {isBiometricLoading ? (
                          <ActivityIndicator size="small" color={theme.text} />
                        ) : (
                          <Ionicons name="finger-print" size={24} color={theme.text} />
                        )}
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {error && (
                  <View style={styles.errorContainer}>
                    <Ionicons name="alert-circle" size={16} color={BeeColors.red[600]} />
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}

                <View style={styles.forgotPasswordContainer}>
                  <TouchableOpacity onPress={() => router.push('/forgot-password')}>
                    <Text style={[styles.forgotPasswordText, { color: theme.textSecondary }]}>
                      Forgot Password?
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.loginButtonContainer}>
                  <TouchableOpacity
                    style={[styles.loginButton, isLoading && styles.loginButtonDisabled, { backgroundColor: theme.primary }]}
                    onPress={handleLogin}
                    disabled={isLoading}
                    activeOpacity={0.98}
                  >
                    <Text style={[styles.loginButtonText, { color: theme.primaryText }]}>
                      {isLoading ? "Logging in..." : "Log In"}
                    </Text>
                  </TouchableOpacity>
                </View>

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
            </>
          )}
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
  topHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  headerSpacer: {
    width: 48,
  },
  welcomeBackHeaderTitle: {
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: -0.25,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
  },
  loginLoadingWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    minHeight: 200,
  },
  welcomeBackProfile: {
    alignItems: "center",
    marginBottom: 24,
    paddingHorizontal: 8,
    marginTop: 16,
  },
  initialsAvatar: {
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: BeeColors.gray[300],
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    borderWidth: 4,
    borderColor: BeeColors.yellow[400],
    shadowColor: BeeColors.gray[900],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  initialsText: {
    fontSize: 36,
    fontWeight: "700",
    color: BeeColors.gray[700],
  },
  initialsBadge: {
    position: "absolute",
    bottom: 4,
    right: 4,
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  welcomeBackName: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 4,
    textAlign: "center",
  },
  welcomeBackEmail: {
    fontSize: 16,
    fontWeight: "500",
    textAlign: "center",
  },
  welcomeBackForm: {
    width: "100%",
    maxWidth: 480,
    alignSelf: "center",
  },
  differentUserLink: {
    alignItems: "center",
    paddingVertical: 24,
  },
  differentUserText: {
    fontSize: 14,
    fontWeight: "500",
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
    marginHorizontal: 16,
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
