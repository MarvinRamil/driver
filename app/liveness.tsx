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

const DIRECTION_LABELS: Record<string, string> = {
  left: "Look left",
  right: "Look right",
  up: "Look up",
  down: "Look down",
};

/**
 * Face liveness verification during driver onboarding.
 * Shown after email verification, before submitting documents.
 * User captures a photo for each direction (left, right, up, down).
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
    try {
      const result = await livenessService.createSession();
      setSessionId(result.sessionId);
      setDirections(result.directions);
      setCurrentIndex(0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start verification");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    startSession();
  }, [startSession]);

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

      const data = await livenessService.submitImage(
        sessionId,
        currentDirection,
        photo.uri
      );

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
  }, [sessionId, currentDirection, submitting, permission?.granted, refreshUser, router]);

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
      <SafeAreaView style={[styles.container, styles.safeContainer, { backgroundColor: theme.background }]} edges={["top", "bottom"]}>
        <View style={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
          <Text style={[styles.title, { color: theme.text }]}>
            Camera Permission Required
          </Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            We need access to your camera to verify your identity.
          </Text>
          <TouchableOpacity
            style={[styles.captureButton, { backgroundColor: theme.primary }]}
            onPress={requestPermission}
          >
            <Ionicons name="camera" size={24} color={theme.primaryText} />
            <Text style={[styles.captureButtonText, { color: theme.primaryText }]}>
              Grant Permission
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Intro: session ready but camera not started — user must tap to begin
  if (sessionId && directions.length > 0 && !cameraStarted) {
    return (
      <SafeAreaView style={[styles.container, styles.safeContainer, { backgroundColor: theme.background }]} edges={["top", "bottom"]}>
        <View style={[styles.content, styles.introContent, { paddingBottom: insets.bottom + 24 }]}>
          <Text style={[styles.title, { color: theme.text }]}>
            Verify your identity
          </Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            We need to confirm you're a real person. You'll follow on-screen directions and take a photo for each.
          </Text>
          <TouchableOpacity
            style={[styles.captureButton, styles.startButton, { backgroundColor: theme.primary }]}
            onPress={() => setCameraStarted(true)}
          >
            <Ionicons name="camera" size={24} color={theme.primaryText} />
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
            We need to confirm you're a real person. Follow the instruction and take a photo.
          </Text>

          {currentDirection && (
            <View style={[styles.directionCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={[styles.directionLabel, { color: theme.text }]}>
                {DIRECTION_LABELS[currentDirection] ?? currentDirection}
              </Text>
              <Text style={[styles.stepText, { color: theme.textSecondary }]}>
                Step {currentIndex + 1} of {directions.length}
              </Text>
            </View>
          )}

          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Camera Preview */}
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
  },
  startButton: {
    marginTop: 24,
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
  subtitle: {
    fontSize: 16,
    marginBottom: 24,
    lineHeight: 22,
  },
  directionCard: {
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 24,
    alignItems: "center",
  },
  directionLabel: {
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 4,
  },
  stepText: {
    fontSize: 14,
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
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 8,
    marginTop: 16,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
});
