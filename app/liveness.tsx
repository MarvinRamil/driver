import { BeeColors } from "@/constants/theme";
import { useTheme } from "@/shared/hooks/use-theme";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState, useRef } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/features/auth";
import { livenessService } from "@/features/liveness";
import { CameraView, useCameraPermissions } from "expo-camera";

/**
 * Face liveness verification during driver onboarding.
 * Shown after email verification, before submitting documents.
 * Captures one photo per direction, verifies immediately, then advances.
 */
export default function LivenessScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const router = useRouter();
  const { refreshUser } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [directions, setDirections] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [cameraStarted, setCameraStarted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const cameraRef = useRef<CameraView>(null);

  const currentDirection = directions[currentIndex];
  const isReadyToCapture = countdown !== null && countdown > 0;
  const isCapturing = countdown === 1 || submitting;

  const startSession = useCallback(async () => {
    setError(null);
    setLoading(true);
    setCurrentIndex(0);
    setCameraStarted(false);
    setSubmitting(false);
    setCountdown(null);
    try {
      const result = await livenessService.createSession();
      setSessionId(result.sessionId);
      setDirections(result.directions);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start verification");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleRetry = useCallback(() => {
    startSession();
  }, [startSession]);

  useEffect(() => {
    startSession();
  }, [startSession]);

  const handleCapture = useCallback(async () => {
    if (!sessionId || !currentDirection || !cameraRef.current || submitting) return;

    if (!permission?.granted) {
      Alert.alert(
        "Camera required",
        "Please allow camera access to complete face verification."
      );
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: false,
      });

      if (!photo?.uri) {
        throw new Error("Failed to capture photo");
      }

      const data = await livenessService.submitImage(sessionId, currentDirection, photo.uri);

      if (data.allPassed) {
        await refreshUser?.();
        router.replace("/driver-complete");
        return;
      }

      if (data.directionPassed) {
        setCurrentIndex((i) => i + 1);
        if (data.remainingDirections.length === 0) {
          await refreshUser?.();
          router.replace("/driver-complete");
        }
      } else {
        setError(data.error || "Verification failed. Please try again.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }, [
    sessionId,
    currentDirection,
    submitting,
    permission?.granted,
    refreshUser,
    router,
  ]);

  // Auto-capture countdown when direction changes (only after user started camera)
  useEffect(() => {
    if (!cameraStarted || !sessionId || !currentDirection || submitting || !permission?.granted) {
      setCountdown(null);
      return;
    }

    setCountdown(3);

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(timer);
          if (prev === 1) {
            handleCapture();
          }
          return null;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [cameraStarted, currentIndex, sessionId, submitting, permission?.granted, currentDirection, handleCapture]);

  if (loading) {
    return (
      <SafeAreaView style={[styles.center, styles.safeContainer, { backgroundColor: theme.background }]} edges={["top", "bottom"]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
          Starting verification...
        </Text>
      </SafeAreaView>
    );
  }

  if (error && !sessionId) {
    return (
      <SafeAreaView style={[styles.center, styles.padded, styles.safeContainer, { backgroundColor: theme.background }]} edges={["top", "bottom"]}>
        <Ionicons name="alert-circle" size={48} color={BeeColors.red[500]} />
        <Text style={[styles.errorText, { color: theme.text }]}>{error}</Text>
        <TouchableOpacity
          style={[styles.retryButton, { backgroundColor: theme.primary }]}
          onPress={startSession}
        >
          <Text style={[styles.retryButtonText, { color: theme.primaryText }]}>
            Try again
          </Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (!permission) {
    return (
      <SafeAreaView style={[styles.center, styles.safeContainer, { backgroundColor: theme.background }]} edges={["top", "bottom"]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView
        style={[styles.permissionRoot, { backgroundColor: theme.background }]}
        edges={["top", "bottom"]}
      >
        <View style={[styles.permissionContent, { paddingBottom: insets.bottom + 32 }]}>
          <View style={styles.permissionIconWrap}>
            <View style={styles.permissionIconCircle}>
              <Ionicons name="camera" size={56} color="#755b00" />
            </View>
          </View>

          <Text style={[styles.permissionTitle, { color: theme.text }]}>Allow Camera Access</Text>
          <Text style={[styles.permissionSubtitle, { color: theme.textSecondary }]}>
            We need access to your camera to verify your identity and give you a better experience.
          </Text>

          <TouchableOpacity
            style={styles.permissionPrimaryButton}
            onPress={requestPermission}
            activeOpacity={0.9}
          >
            <Text style={styles.permissionPrimaryButtonText}>Grant Permission</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (sessionId && directions.length > 0 && !cameraStarted) {
    return (
      <SafeAreaView style={[styles.container, styles.safeContainer, { backgroundColor: theme.background }]} edges={["top", "bottom"]}>
        <View style={[styles.content, styles.introContent, { paddingBottom: insets.bottom + 24 }]}>
          <View style={styles.verifyHeader}>
            <View style={styles.verifyIconCircle}>
              <Ionicons name="camera" size={40} color="#755b00" />
            </View>
            <Text style={[styles.title, styles.titleCentered, { color: theme.text }]}>
              Verify your identity
            </Text>
          </View>
          <Text style={[styles.subtitle, styles.subtitleCentered, { color: theme.textSecondary }]}>
            We need to confirm you're a real person. You'll take a few photos with your front camera.
          </Text>
          <TouchableOpacity
            style={[styles.captureButton, styles.startButton, { backgroundColor: theme.primary }]}
            onPress={() => setCameraStarted(true)}
          >
            <Text style={[styles.captureButtonText, { color: theme.primaryText }]}>
              Start verification
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const frameColor = isReadyToCapture || isCapturing ? BeeColors.green[500] : theme.primary;

  return (
    <SafeAreaView style={[styles.container, styles.safeContainer, { backgroundColor: theme.background }]} edges={["top", "bottom"]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          <Text style={[styles.title, { color: theme.text }]}>
            Verify your identity
          </Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            We need to confirm you're a real person. Position your face in the frame — your photo will be captured automatically.
          </Text>

          {directions.length > 0 && (
            <Text style={[styles.stepText, { color: theme.textSecondary, marginBottom: 24 }]}>
              Photo {currentIndex + 1} of {directions.length}
            </Text>
          )}

          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity
                style={[
                  styles.retryButton,
                  { backgroundColor: theme.primary, marginTop: 12 },
                  submitting && styles.buttonDisabled,
                ]}
                onPress={handleRetry}
                disabled={submitting}
              >
                <Text style={[styles.retryButtonText, { color: theme.primaryText }]}>
                  Try again
                </Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.cameraContainer}>
            <CameraView
              ref={cameraRef}
              style={styles.camera}
              facing="front"
              mode="picture"
            >
              <View style={styles.overlay}>
                <View style={styles.guideFrameContainer}>
                  <View style={[styles.guideFrame, { borderColor: frameColor }]} />
                  {countdown !== null && countdown > 0 && (
                    <View style={styles.countdownContainer}>
                      <Text style={[styles.countdownText, { color: BeeColors.green[500] }]}>{countdown}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.guideText}>
                  {countdown !== null && countdown > 0
                    ? "Get ready..."
                    : "Position your face within the frame"}
                </Text>
              </View>
            </CameraView>
          </View>

          {submitting ? (
            <View style={[styles.captureButton, { backgroundColor: theme.primary }]}>
              <ActivityIndicator color={theme.primaryText} />
              <Text style={[styles.captureButtonText, { color: theme.primaryText, marginLeft: 10 }]}>
                Processing...
              </Text>
            </View>
          ) : (
            <View style={styles.infoContainer}>
              <Text style={[styles.infoText, { color: theme.textSecondary }]}>
                Photo will be captured automatically
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  permissionRoot: {
    flex: 1,
  },
  permissionContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  permissionIconWrap: {
    marginBottom: 40,
    alignItems: "center",
  },
  permissionIconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(255, 205, 54, 0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  permissionTitle: {
    fontSize: 24,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 12,
    letterSpacing: -0.3,
  },
  permissionSubtitle: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "500",
    textAlign: "center",
    marginBottom: 40,
    maxWidth: 300,
  },
  permissionPrimaryButton: {
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    maxWidth: 320,
    height: 52,
    borderRadius: 12,
    backgroundColor: BeeColors.yellow[400],
    shadowColor: "#caa400",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 15,
    elevation: 6,
  },
  permissionPrimaryButtonText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#715700",
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
  },
  safeContainer: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 24,
  },
  content: {
    flex: 1,
    paddingTop: 24,
  },
  introContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  verifyHeader: {
    alignItems: "center",
    marginBottom: 12,
    width: "100%",
  },
  verifyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255, 205, 54, 0.25)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  startButton: {
    marginTop: 24,
    width: "100%",
    maxWidth: 320,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  padded: {
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 8,
  },
  titleCentered: {
    textAlign: "center",
    width: "100%",
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 16,
    lineHeight: 22,
  },
  subtitleCentered: {
    textAlign: "center",
    maxWidth: 320,
  },
  stepText: {
    fontSize: 14,
    fontWeight: "500",
    textAlign: "center",
  },
  errorContainer: {
    backgroundColor: BeeColors.red[50],
    borderColor: BeeColors.red[200],
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: BeeColors.red[700],
    fontSize: 14,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  cameraContainer: {
    flex: 1,
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 24,
    minHeight: 400,
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  guideFrameContainer: {
    width: 280,
    height: 280,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  guideFrame: {
    width: 280,
    height: 280,
    borderRadius: 140,
    borderWidth: 3,
  },
  guideText: {
    marginTop: 16,
    fontSize: 14,
    fontWeight: "600",
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    color: "white",
  },
  countdownContainer: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  countdownText: {
    fontSize: 64,
    fontWeight: "700",
    color: "white",
    textShadowColor: "rgba(0,0,0,0.75)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  infoContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    marginBottom: 24,
  },
  infoText: {
    fontSize: 14,
    textAlign: "center",
  },
  captureButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    height: 52,
    borderRadius: 12,
    marginBottom: 24,
  },
  captureButtonText: {
    fontSize: 18,
    fontWeight: "600",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  retryButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
});
