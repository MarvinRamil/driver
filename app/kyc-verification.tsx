import { BeeColors } from "@/constants/theme";
import { useTheme } from "@/shared/hooks/use-theme";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { useCameraPermissions } from "expo-camera";
import { useAuth } from "@/features/auth";
import { kycService, KycStatus, KycUnavailableError } from "@/features/kyc";

// Path marker of the Didit callback (Didit:CallbackUrl, e.g. beeapp://kyc-callback?...).
// We match on the PATH, not the scheme, so it works regardless of the backend's chosen
// scheme or this app's OS scheme (driver/customer) — and is always caught in-WebView so it
// never escapes to the OS as an unhandled deep link ("Can't open url").
const CALLBACK_MARKER = "kyc-callback";
const POLL_INTERVAL_MS = 2500;
const POLL_MAX_ATTEMPTS = 24; // ~1 minute

type Phase =
  | "loading" // checking status / creating session
  | "intro" // explain what happens, ask to start
  | "webview" // Didit hosted flow open
  | "polling" // user finished the flow, waiting for the decision
  | "approved"
  | "in-review"
  | "declined"
  | "unavailable" // Didit disabled on backend → offer legacy liveness
  | "error";

/**
 * Identity verification (KYC) during driver onboarding, before document submission.
 * Opens Didit's hosted flow in a WebView: ID document scan + selfie with liveness,
 * face-matched against the ID portrait. Result arrives via backend webhook; this
 * screen polls status after the flow completes.
 */
export default function KycVerificationScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const router = useRouter();
  const { refreshUser } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const [phase, setPhase] = useState<Phase>("loading");
  const [verificationUrl, setVerificationUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusReason, setStatusReason] = useState<string | null>(null);
  const pollAttempts = useRef(0);

  const goToApplication = useCallback(async () => {
    await refreshUser?.();
    router.replace("/complete-registration");
  }, [refreshUser, router]);

  const applyStatus = useCallback(
    (status: string, reason?: string | null): boolean => {
      switch (status) {
        case KycStatus.Approved:
        case KycStatus.Legacy:
          setPhase("approved");
          return true;
        case KycStatus.InReview:
          setPhase("in-review");
          return true;
        case KycStatus.Declined:
        case KycStatus.Abandoned:
        case KycStatus.Expired:
          setStatusReason(reason ?? null);
          setPhase("declined");
          return true;
        default:
          return false; // NotStarted / Pending / InProgress
      }
    },
    []
  );

  // On mount: resolve current status first (user may already be verified or in review).
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const status = await kycService.getStatus();
        if (!mounted) return;
        if (!applyStatus(status.status, status.statusReason)) {
          setPhase("intro");
        }
      } catch {
        if (mounted) setPhase("intro");
      }
    })();
    return () => {
      mounted = false;
    };
  }, [applyStatus]);

  const startVerification = useCallback(async () => {
    setError(null);
    setPhase("loading");

    // The hosted flow uses the in-page camera; grant the app-level permission first
    // so the WebView can pass it through.
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        setError("Camera access is required to verify your identity.");
        setPhase("error");
        return;
      }
    }

    try {
      const session = await kycService.createSession();
      setVerificationUrl(session.verificationUrl);
      setPhase("webview");
    } catch (e) {
      if (e instanceof KycUnavailableError) {
        setPhase("unavailable");
        return;
      }
      setError(e instanceof Error ? e.message : "Failed to start verification");
      setPhase("error");
    }
  }, [permission?.granted, requestPermission]);

  // After the hosted flow redirects back, poll until the webhook has landed.
  const pollStatus = useCallback(async () => {
    setPhase("polling");
    pollAttempts.current = 0;

    const poll = async () => {
      pollAttempts.current += 1;
      try {
        const status = await kycService.getStatus();
        if (applyStatus(status.status, status.statusReason)) return;
      } catch {
        // transient — keep polling
      }
      if (pollAttempts.current >= POLL_MAX_ATTEMPTS) {
        // Decision still pending after ~1 min — most likely manual review.
        setPhase("in-review");
        return;
      }
      setTimeout(poll, POLL_INTERVAL_MS);
    };

    poll();
  }, [applyStatus]);

  if (phase === "loading") {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: theme.background }]} edges={["top", "bottom"]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
          Preparing verification...
        </Text>
      </SafeAreaView>
    );
  }

  if (phase === "webview" && verificationUrl) {
    return (
      <SafeAreaView style={[styles.webviewContainer, { backgroundColor: theme.background }]} edges={["top", "bottom"]}>
        <WebView
          source={{ uri: verificationUrl }}
          style={styles.webview}
          // Whitelist the callback scheme so the WebView hands it to onShouldStartLoadWithRequest
          // instead of Linking.openURL (which fails: "Can't open url beeapp://...").
          originWhitelist={["http://*", "https://*", "beeapp://*"]}
          javaScriptEnabled
          domStorageEnabled
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          mediaCapturePermissionGrantType="grant"
          startInLoadingState
          renderLoading={() => (
            <View style={[styles.center, StyleSheet.absoluteFill, { backgroundColor: theme.background }]}>
              <ActivityIndicator size="large" color={theme.primary} />
            </View>
          )}
          onShouldStartLoadWithRequest={(request) => {
            if (request.url.includes(CALLBACK_MARKER)) {
              pollStatus();
              return false;
            }
            return true;
          }}
          onError={() => {
            setError("Could not load the verification page. Check your connection and try again.");
            setPhase("error");
          }}
        />
      </SafeAreaView>
    );
  }

  if (phase === "polling") {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: theme.background }]} edges={["top", "bottom"]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
          Checking your verification result...
        </Text>
      </SafeAreaView>
    );
  }

  if (phase === "approved") {
    return (
      <ResultView
        icon="checkmark-circle"
        iconColor={BeeColors.green[500]}
        title="Identity verified!"
        subtitle="Your ID and selfie were verified successfully. Next, submit your driver application."
        buttonLabel="Continue"
        onPress={goToApplication}
        insetsBottom={insets.bottom}
      />
    );
  }

  if (phase === "in-review") {
    return (
      <ResultView
        icon="time"
        iconColor={BeeColors.yellow[500]}
        title="Verification under review"
        subtitle="Your verification needs a manual check. This usually takes a few minutes — you'll be able to continue once it's approved."
        buttonLabel="Check again"
        onPress={pollStatus}
        insetsBottom={insets.bottom}
      />
    );
  }

  if (phase === "declined") {
    return (
      <ResultView
        icon="close-circle"
        iconColor={BeeColors.red[500]}
        title="Verification not approved"
        subtitle={
          statusReason ||
          "We couldn't verify your identity. Make sure you use your own valid ID and take the selfie yourself in good lighting."
        }
        buttonLabel="Try again"
        onPress={startVerification}
        insetsBottom={insets.bottom}
      />
    );
  }

  if (phase === "unavailable") {
    return (
      <ResultView
        icon="cloud-offline"
        iconColor={BeeColors.yellow[500]}
        title="Verification unavailable"
        subtitle="Identity verification is temporarily unavailable. You can complete a basic face check instead."
        buttonLabel="Continue with face check"
        onPress={() => router.replace("/liveness")}
        insetsBottom={insets.bottom}
      />
    );
  }

  if (phase === "error") {
    return (
      <ResultView
        icon="alert-circle"
        iconColor={BeeColors.red[500]}
        title="Something went wrong"
        subtitle={error || "Please try again."}
        buttonLabel="Try again"
        onPress={startVerification}
        insetsBottom={insets.bottom}
      />
    );
  }

  // intro
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={["top", "bottom"]}>
      <View style={[styles.introContent, { paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.iconCircle}>
          <Ionicons name="shield-checkmark" size={40} color="#755b00" />
        </View>
        <Text style={[styles.title, { color: theme.text }]}>Verify your identity</Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
          To keep the platform safe, we'll scan a valid government ID and take a quick
          selfie to confirm it's really you. This takes about 2 minutes.
        </Text>
        <View style={styles.stepsList}>
          <IntroStep icon="card" text="Scan your government ID or driver's license" theme={theme} />
          <IntroStep icon="happy" text="Take a selfie — we match it to your ID photo" theme={theme} />
          <IntroStep icon="checkmark-done" text="Submit your driver documents after verification" theme={theme} />
        </View>
        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: theme.primary }]}
          onPress={startVerification}
        >
          <Text style={[styles.primaryButtonText, { color: theme.primaryText }]}>
            Start verification
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function IntroStep({
  icon,
  text,
  theme,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  text: string;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <View style={styles.stepRow}>
      <Ionicons name={icon} size={22} color={theme.primary} />
      <Text style={[styles.stepText, { color: theme.text }]}>{text}</Text>
    </View>
  );
}

function ResultView({
  icon,
  iconColor,
  title,
  subtitle,
  buttonLabel,
  onPress,
  insetsBottom,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  iconColor: string;
  title: string;
  subtitle: string;
  buttonLabel: string;
  onPress: () => void;
  insetsBottom: number;
}) {
  const theme = useTheme();
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={["top", "bottom"]}>
      <View style={[styles.introContent, { paddingBottom: insetsBottom + 24 }]}>
        <Ionicons name={icon} size={64} color={iconColor} />
        <Text style={[styles.title, { color: theme.text, marginTop: 16 }]}>{title}</Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{subtitle}</Text>
        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: theme.primary }]}
          onPress={onPress}
        >
          <Text style={[styles.primaryButtonText, { color: theme.primaryText }]}>{buttonLabel}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
  },
  webviewContainer: {
    flex: 1,
  },
  webview: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  introContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255, 205, 54, 0.25)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 22,
    textAlign: "center",
    maxWidth: 320,
    marginBottom: 24,
  },
  stepsList: {
    width: "100%",
    maxWidth: 320,
    gap: 14,
    marginBottom: 32,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  stepText: {
    fontSize: 15,
    flex: 1,
    lineHeight: 20,
  },
  primaryButton: {
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    maxWidth: 320,
    height: 52,
    borderRadius: 12,
  },
  primaryButtonText: {
    fontSize: 18,
    fontWeight: "600",
  },
});
