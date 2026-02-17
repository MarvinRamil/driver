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
 * Captures multiple images over 20 seconds and averages the results.
 */
export default function LivenessScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const router = useRouter();
  const { refreshUser } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [direction, setDirection] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [cameraStarted, setCameraStarted] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number>(20);
  const [capturedCount, setCapturedCount] = useState(0);
  const [passedCount, setPassedCount] = useState(0);
  const [totalCaptures, setTotalCaptures] = useState(5);
  const cameraRef = useRef<CameraView>(null);
  const captureIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const startSession = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const result = await livenessService.createSession();
      setSessionId(result.sessionId);
      // Use the first direction for all captures (we'll use same direction for all images)
      setDirection(result.directions[0] || "front");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start verification");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    startSession();
  }, [startSession]);

  const handleCapture = useCallback(async (imageUri: string): Promise<boolean> => {
    if (!sessionId || !direction) return false;

    try {
      const data = await livenessService.submitImage(
        sessionId,
        direction,
        imageUri
      );

      // If backend says all passed (shouldn't happen with single direction, but handle it)
      if (data.allPassed) {
        await refreshUser?.();
        router.replace("/driver-complete");
        return true;
      }

      // Return whether this image passed
      return data.directionPassed;
    } catch (e) {
      console.error("Error submitting image:", e);
      return false;
    }
  }, [sessionId, direction, refreshUser, router]);

  const evaluateResults = useCallback(async (finalPassedCount: number, finalCapturedCount: number) => {
    setIsCapturing(false);
    
    // Need at least 3 out of 5 passes (60% success rate)
    const successThreshold = Math.ceil(totalCaptures * 0.6);
    
    if (finalPassedCount >= successThreshold) {
      // Success - mark as verified
      await refreshUser?.();
      router.replace("/driver-complete");
    } else {
      // Failed - show error
      setError(
        `Verification failed. Only ${finalPassedCount} out of ${finalCapturedCount} images passed. Please try again.`
      );
    }
  }, [totalCaptures, refreshUser, router]);

  // Start 20-second timer and auto-capture when camera starts
  useEffect(() => {
    if (!cameraStarted || !sessionId || !direction || !permission?.granted) {
      return;
    }

    // Reset state
    setTimeRemaining(20);
    setCapturedCount(0);
    setPassedCount(0);
    setError(null);
    setIsCapturing(true);

    let passedCountLocal = 0;
    let capturedCountLocal = 0;

    // Start countdown timer
    timerIntervalRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Capture images at intervals: 0s, 4s, 8s, 12s, 16s (5 images total)
    const captureTimes = [0, 4, 8, 12, 16];
    const capturePromises: Promise<void>[] = [];

    captureTimes.forEach((delaySeconds, index) => {
      const promise = new Promise<void>((resolve) => {
        setTimeout(async () => {
          if (!cameraRef.current || !sessionId || !direction) {
            resolve();
            return;
          }

          try {
            const photo = await cameraRef.current.takePictureAsync({
              quality: 0.8,
              base64: false,
            });

            if (photo?.uri) {
              capturedCountLocal++;
              setCapturedCount(capturedCountLocal);
              
              const passed = await handleCapture(photo.uri);
              if (passed) {
                passedCountLocal++;
                setPassedCount(passedCountLocal);
              }
            }
          } catch (e) {
            console.error("Error capturing photo:", e);
          }
          
          resolve();
        }, delaySeconds * 1000);
      });
      
      capturePromises.push(promise);
    });

    // Wait for all captures to complete, then evaluate
    Promise.all(capturePromises).then(() => {
      // Wait a bit more to ensure all state updates are processed
      setTimeout(() => {
        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current);
        }
        evaluateResults(passedCountLocal, capturedCountLocal);
      }, 500);
    });

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [cameraStarted, sessionId, direction, permission?.granted, handleCapture, evaluateResults]);

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
  if (sessionId && direction && !cameraStarted) {
    return (
      <SafeAreaView style={[styles.container, styles.safeContainer, { backgroundColor: theme.background }]} edges={["top", "bottom"]}>
        <View style={[styles.content, styles.introContent, { paddingBottom: insets.bottom + 24 }]}>
          <Text style={[styles.title, { color: theme.text }]}>
            Verify your identity
          </Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            We'll capture a few photos over 20 seconds. Keep your face centered and look straight at the camera.
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

  const frameColor = isCapturing ? BeeColors.green[500] : theme.primary;

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
            Keep your face centered and look straight at the camera. Photos will be captured automatically.
          </Text>

          {isCapturing && (
            <View style={[styles.directionCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={[styles.directionLabel, { color: theme.text }]}>
                {timeRemaining} seconds remaining
              </Text>
              <Text style={[styles.stepText, { color: theme.textSecondary }]}>
                Captured {capturedCount} of {totalCaptures} photos
                {passedCount > 0 && ` • ${passedCount} passed`}
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
                  {isCapturing && timeRemaining > 0 && (
                    <View style={styles.countdownContainer}>
                      <Text style={[styles.countdownText, { color: BeeColors.green[500] }]}>{timeRemaining}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.guideText}>
                  {isCapturing
                    ? timeRemaining > 0
                      ? "Keep your face centered..."
                      : "Processing results..."
                    : "Position your face within the frame"}
                </Text>
              </View>
            </CameraView>
          </View>

          {isCapturing ? (
            <View style={[styles.captureButton, { backgroundColor: theme.primary }]}>
              <ActivityIndicator color={theme.primaryText} />
              <Text style={[styles.captureButtonText, { color: theme.primaryText, marginLeft: 10 }]}>
                Capturing photos... ({capturedCount}/{totalCaptures})
              </Text>
            </View>
          ) : !cameraStarted ? (
            <View style={styles.infoContainer}>
              <Text style={[styles.infoText, { color: theme.textSecondary }]}>
                Tap "Start verification" to begin
              </Text>
            </View>
          ) : (
            <View style={styles.infoContainer}>
              <Text style={[styles.infoText, { color: theme.textSecondary }]}>
                Verification complete
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
