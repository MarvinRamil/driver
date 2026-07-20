import { BeeColors } from "@/constants/theme";
import { useClerkPasswordReset } from "@/features/auth";
import { useTheme } from "@/shared/hooks/use-theme";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * Forgot Password screen (Driver app) — Clerk-native.
 *
 * Step 1 (request): enter email → Clerk emails a reset code.
 * Step 2 (reset): enter the code + a new password → Clerk sets the password and
 * signs the user in; on success the app redirects to the welcome screen.
 *
 * Replaces the legacy backend OTP + security-question recovery.
 */
export default function ForgotPasswordScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const router = useRouter();

  const flow = useClerkPasswordReset();
  const [showPassword, setShowPassword] = useState(false);

  const navigateToLogin = () => router.replace("/login");

  const handleSubmitNewPassword = async () => {
    const success = await flow.submitNewPassword();
    if (success) {
      router.replace("/welcome");
    }
  };

  const Logo = (
    <View style={styles.logoContainer}>
      <View style={styles.logoBox}>
        <Image
          source={require("@/assets/images/bee_logo.png")}
          style={styles.logoImage}
          resizeMode="contain"
        />
      </View>
    </View>
  );

  const ErrorBanner = flow.error ? (
    <View style={styles.errorContainer}>
      <Ionicons name="alert-circle" size={16} color={BeeColors.red[600]} />
      <Text style={styles.errorText}>{flow.error}</Text>
    </View>
  ) : null;

  // ---- Step 2: code + new password ----
  if (flow.step === "reset") {
    return (
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: theme.background }]}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        <View style={[styles.content, { paddingTop: insets.top }]}>
          <View style={styles.topHeader}>
            <TouchableOpacity style={styles.backButton} onPress={flow.backToRequest}>
              <Ionicons name="arrow-back" size={24} color={theme.text} />
            </TouchableOpacity>
            <Text style={[styles.helpText, { color: theme.textSecondary }]}>Help</Text>
          </View>

          <ScrollView
            contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {Logo}

            <View style={styles.welcomeSection}>
              <Text style={[styles.title, { color: theme.text }]}>Reset password</Text>
              <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                Enter the code we sent to{"\n"}
                {flow.email}
                {"\n"}and choose a new password.
              </Text>
            </View>

            <View style={styles.form}>
              {/* Reset code */}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: theme.text }]}>Reset code</Text>
                <View style={[styles.inputContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <Ionicons name="key" size={20} color={theme.textSecondary} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, styles.codeInput, { color: theme.text }]}
                    placeholder="123456"
                    placeholderTextColor={theme.placeholder}
                    value={flow.code}
                    onChangeText={(t) => {
                      flow.setCode(t.replace(/[^0-9]/g, ""));
                      flow.clearError();
                    }}
                    keyboardType="number-pad"
                    maxLength={6}
                    autoFocus
                    editable={!flow.isResetting}
                  />
                </View>
              </View>

              {/* New password */}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: theme.text }]}>New password</Text>
                <View style={[styles.inputContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <Ionicons name="lock-closed" size={20} color={theme.textSecondary} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, { color: theme.text }]}
                    placeholder="Create a new password"
                    placeholderTextColor={theme.placeholder}
                    value={flow.password}
                    onChangeText={(t) => {
                      flow.setPassword(t);
                      flow.clearError();
                    }}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!flow.isResetting}
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.visibilityButton}>
                    <Ionicons name={showPassword ? "eye-off" : "eye"} size={20} color={theme.textSecondary} />
                  </TouchableOpacity>
                </View>
                <Text style={[styles.passwordHint, { color: theme.textSecondary }]}>
                  Must be at least 8 characters with uppercase, lowercase, number, and special character
                </Text>
              </View>

              {/* Confirm new password */}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: theme.text }]}>Confirm new password</Text>
                <View style={[styles.inputContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <Ionicons name="lock-closed" size={20} color={theme.textSecondary} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, { color: theme.text }]}
                    placeholder="Re-enter your new password"
                    placeholderTextColor={theme.placeholder}
                    value={flow.confirmPassword}
                    onChangeText={(t) => {
                      flow.setConfirmPassword(t);
                      flow.clearError();
                    }}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!flow.isResetting}
                  />
                </View>
                {flow.confirmPassword.length > 0 && flow.confirmPassword !== flow.password && (
                  <Text style={[styles.passwordHint, { color: BeeColors.red[600] }]}>Passwords do not match</Text>
                )}
              </View>

              {ErrorBanner}

              <TouchableOpacity
                style={[styles.primaryButton, flow.isResetting && styles.primaryButtonDisabled]}
                onPress={handleSubmitNewPassword}
                disabled={flow.isResetting}
                activeOpacity={0.98}
              >
                {flow.isResetting ? (
                  <ActivityIndicator size="small" color="#000000" />
                ) : (
                  <>
                    <Text style={styles.primaryButtonText}>Reset Password</Text>
                    <Ionicons name="arrow-forward" size={20} color={theme.primaryText} />
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity style={styles.resendLink} onPress={flow.resendCode} disabled={flow.isRequesting}>
                <Text style={[styles.resendLinkText, { color: theme.textSecondary }]}>
                  {flow.isRequesting ? "Resending…" : "Didn't get a code? Resend"}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // ---- Step 1: request reset code ----
  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
    >
      <View style={[styles.content, { paddingTop: insets.top }]}>
        <View style={styles.topHeader}>
          <TouchableOpacity style={styles.backButton} onPress={navigateToLogin}>
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.helpText, { color: theme.textSecondary }]}>Help</Text>
        </View>

        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {Logo}

          <View style={styles.welcomeSection}>
            <Text style={[styles.title, { color: theme.text }]}>Forgot password?</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              Enter your email and we'll send you a code to reset your password.
            </Text>
          </View>

          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.text }]}>Email</Text>
              <View style={[styles.inputContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Ionicons name="mail" size={20} color={theme.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: theme.text }]}
                  placeholder="Enter your email"
                  placeholderTextColor={theme.placeholder}
                  value={flow.email}
                  onChangeText={(t) => {
                    flow.setEmail(t);
                    flow.clearError();
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!flow.isRequesting}
                />
              </View>
            </View>

            {ErrorBanner}

            <TouchableOpacity
              style={[
                styles.primaryButton,
                (flow.isRequesting || !flow.email.trim()) && styles.primaryButtonDisabled,
              ]}
              onPress={flow.requestReset}
              disabled={flow.isRequesting || !flow.email.trim()}
              activeOpacity={0.98}
            >
              {flow.isRequesting ? (
                <ActivityIndicator size="small" color="#000000" />
              ) : (
                <>
                  <Text style={styles.primaryButtonText}>Send Reset Code</Text>
                  <Ionicons name="arrow-forward" size={20} color={theme.primaryText} />
                </>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.loginLinkContainer}>
            <Text style={[styles.loginLinkText, { color: theme.textSecondary }]}>
              Remember your password?{" "}
              <Text style={[styles.loginLink, { color: theme.text }]} onPress={navigateToLogin}>
                Log In
              </Text>
            </Text>
          </View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1 },
  topHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
    width: "100%",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  helpText: { fontSize: 14, fontWeight: "500" },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    maxWidth: 448,
    width: "100%",
    alignSelf: "center",
  },
  logoContainer: { width: "100%", marginBottom: 32, alignItems: "center", justifyContent: "center" },
  logoBox: {
    width: 128,
    height: 128,
    backgroundColor: BeeColors.yellow[400],
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: BeeColors.yellow[500],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  logoImage: { width: 80, height: 80 },
  welcomeSection: { marginBottom: 32, alignItems: "center" },
  title: { fontSize: 30, fontWeight: "700", marginBottom: 8, lineHeight: 36 },
  subtitle: { fontSize: 16, lineHeight: 24, textAlign: "center" },
  form: { width: "100%", marginBottom: 32 },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: "500", marginBottom: 8 },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    height: 56,
  },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, fontSize: 16 },
  codeInput: { letterSpacing: 8, fontSize: 20, fontWeight: "600" },
  visibilityButton: { padding: 4 },
  passwordHint: { fontSize: 12, marginTop: 4 },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: BeeColors.red[50],
    borderWidth: 1,
    borderColor: BeeColors.red[200],
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    gap: 8,
  },
  errorText: { flex: 1, fontSize: 14, color: BeeColors.red[700] },
  primaryButton: {
    width: "100%",
    height: 56,
    backgroundColor: BeeColors.yellow[400],
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 12,
    shadowColor: BeeColors.yellow[500],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonDisabled: { opacity: 0.6 },
  primaryButtonText: { fontSize: 16, fontWeight: "700", color: "#000000" },
  resendLink: { marginTop: 20, alignItems: "center", paddingVertical: 8 },
  resendLinkText: { fontSize: 14, textDecorationLine: "underline" },
  loginLinkContainer: { alignItems: "center", paddingTop: 32, paddingBottom: 16 },
  loginLinkText: { fontSize: 14 },
  loginLink: {
    fontSize: 14,
    fontWeight: "700",
    textDecorationLine: "underline",
    textDecorationColor: BeeColors.yellow[400],
  },
});
