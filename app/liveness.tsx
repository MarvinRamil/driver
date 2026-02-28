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
 * Captures a single photo and sends it to backend for processing.
 */
export default function LivenessScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const router = useRouter();
  const { refreshUser } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [allDirections, setAllDirections] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [cameraStarted, setCameraStarted] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [capturedPhotos, setCapturedPhotos] = useState<string[]>([]);
  const [currentCaptureIndex, setCurrentCaptureIndex] = useState(0);
  const cameraRef = useRef<CameraView>(null);
  const hasCapturedRef = useRef<boolean>(false);
  const captureIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const startSession = useCallback(async () => {
    setError(null);
    setLoading(true);
    hasCapturedRef.current = false; // Reset capture flag
    setCapturedPhotos([]);
    setCurrentCaptureIndex(0);
    setIsCapturing(false);
    setCountdown(null);
    try {
      const result = await livenessService.createSession();
      setSessionId(result.sessionId);
      setAllDirections(result.directions);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start verification");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleRetry = useCallback(() => {
    console.log("[Liveness] Retry button pressed");
    setError(null);
    hasCapturedRef.current = false;
    setCapturedPhotos([]);
    setCurrentCaptureIndex(0);
    setIsCapturing(false);
    setCountdown(null);
    setCameraStarted(false); // Reset camera to allow restart
    // Restart session
    startSession();
  }, [startSession]);

  useEffect(() => {
    startSession();
  }, [startSession]);

  // Auto-capture countdown when camera starts - capture and submit immediately
  useEffect(() => {
    if (!cameraStarted || !sessionId || !permission?.granted || hasCapturedRef.current || allDirections.length === 0) {
      setCountdown(null);
      return;
    }
    
    console.log(`[Liveness] Auto-capture ready: sessionId=${sessionId}, directions=${allDirections.length}, directions=${JSON.stringify(allDirections)}`);

    console.log("[Liveness] Starting countdown for first capture");
    setCountdown(3);
    let mounted = true;
    const TOTAL_CAPTURES = 4;
    const CAPTURE_INTERVAL = 1000; // 1 second between captures (reduced to prevent timeout)
    let submittedDirections = new Set<string>();

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (!mounted) return null;
        if (prev === null || prev <= 1) {
          clearInterval(timer);
          if (prev === 1 && !hasCapturedRef.current && mounted) {
            console.log("[Liveness] Starting capture and submit sequence");
            // Start capturing and submitting photos at intervals
            captureAndSubmitPhotos();
          }
          return null;
        }
        return prev - 1;
      });
    }, 1000);

    const captureAndSubmitPhotos = async () => {
      setIsCapturing(true);
      let finalAllPassed = false;
      const photos: string[] = [];
      
      // Step 1: Capture all photos first (quick)
      console.log("[Liveness] Step 1: Capturing all photos...");
      for (let i = 0; i < TOTAL_CAPTURES; i++) {
        if (!mounted || hasCapturedRef.current) break;
        
        // Wait for interval (except first capture)
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, CAPTURE_INTERVAL));
        }
        
        if (!mounted || !cameraRef.current || hasCapturedRef.current) break;
        
        try {
          console.log(`[Liveness] Capturing photo ${i + 1} of ${TOTAL_CAPTURES}`);
          setCurrentCaptureIndex(i + 1);
          
          const photo = await cameraRef.current.takePictureAsync({
            quality: 0.8,
            base64: false,
          });

          if (!photo?.uri) {
            console.error(`[Liveness] Failed to capture photo ${i + 1}`);
            continue;
          }

          photos.push(photo.uri);
          setCapturedPhotos([...photos]);
          console.log(`[Liveness] Photo ${i + 1} captured`);
        } catch (e) {
          console.error(`[Liveness] Error capturing photo ${i + 1}:`, e);
        }
      }
      
      if (photos.length === 0) {
        console.error("[Liveness] ❌ No photos captured!");
        setError("Failed to capture photos. Please try again.");
        setIsCapturing(false);
        hasCapturedRef.current = false;
        return;
      }
      
      // Step 2: Submit each photo sequentially (one at a time) to avoid timeout
      console.log(`[Liveness] Step 2: Submitting ${allDirections.length} directions sequentially...`);
      console.log(`[Liveness] 📸 Photos captured: ${photos.length}, Directions: ${allDirections.length}`);
      
      for (let i = 0; i < allDirections.length; i++) {
        if (!mounted || hasCapturedRef.current || finalAllPassed) break;
        
        const direction = allDirections[i];
        const photoIndex = i % photos.length; // Cycle through photos if more directions than photos
        const photoUri = photos[photoIndex];
        
        console.log(`[Liveness] Submitting photo ${photoIndex + 1} for direction: ${direction} (${i + 1}/${allDirections.length})`);
        
        try {
          const data = await livenessService.submitImage(
            sessionId,
            direction,
            photoUri
          );
          
          console.log(`[Liveness] ✅ Direction ${direction} SUCCESS (${i + 1}/${allDirections.length}):`, { 
            allPassed: data.allPassed, 
            directionPassed: data.directionPassed 
          });
          
          if (data.allPassed) {
            finalAllPassed = true;
            console.log("[Liveness] 🎉 All directions passed!");
            break; // Stop submitting if all passed
          }
        } catch (err) {
          console.error(`[Liveness] ❌ Error submitting direction ${direction} (${i + 1}/${allDirections.length}):`, err);
          // Continue with next direction even if one fails
        }
      }
      
      // If still not passed, check session status as fallback
      if (!finalAllPassed) {
        console.log("[Liveness] Checking session status as fallback...");
        try {
          const status = await livenessService.getStatus(sessionId);
          console.log("[Liveness] Session status:", status);
          if (status.status === 'Passed') {
            finalAllPassed = true;
            console.log("[Liveness] Session status shows passed!");
          }
        } catch (statusErr) {
          console.error("[Liveness] Error checking status:", statusErr);
        }
      }

      if (mounted) {
        hasCapturedRef.current = true;
        
        if (finalAllPassed) {
          // Backend has marked user as verified, refresh user data to get updated livenessVerifiedAt
          console.log("[Liveness] All passed, refreshing user...");
          await refreshUser?.();
          // Small delay to ensure state is updated before redirect
          setTimeout(() => {
            router.replace("/driver-complete");
          }, 500);
        } else {
          console.log("[Liveness] Verification failed - allPassed never became true");
          setError("Verification failed. Please try again.");
          setIsCapturing(false);
          hasCapturedRef.current = false; // Allow retry
        }
      }
    };

    return () => {
      mounted = false;
      clearInterval(timer);
      if (captureIntervalRef.current) {
        clearInterval(captureIntervalRef.current);
      }
    };
  }, [cameraStarted, sessionId, permission?.granted, allDirections, refreshUser, router]);


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
  if (sessionId && allDirections.length > 0 && !cameraStarted) {
    return (
      <SafeAreaView style={[styles.container, styles.safeContainer, { backgroundColor: theme.background }]} edges={["top", "bottom"]}>
        <View style={[styles.content, styles.introContent, { paddingBottom: insets.bottom + 24 }]}>
          <Text style={[styles.title, { color: theme.text }]}>
            Verify your identity
          </Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            We need to confirm you're a real person. Keep your face centered and look straight at the camera.
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

  const frameColor = (countdown !== null && countdown > 0) || isCapturing ? BeeColors.green[500] : theme.primary;

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
            Keep your face centered and look straight at the camera. We'll capture 4 photos automatically.
          </Text>

          {capturedPhotos.length > 0 && (
            <View style={[styles.directionCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={[styles.directionLabel, { color: theme.text }]}>
                Captured {capturedPhotos.length} of 4 photos
              </Text>
            </View>
          )}

          {error && (
            <View style={styles.errorContainer}>
              <Text style={[styles.errorText, { marginBottom: 12 }]}>{error}</Text>
              <TouchableOpacity
                style={[
                  styles.retryButton, 
                  { backgroundColor: theme.primary },
                  isCapturing && styles.buttonDisabled
                ]}
                onPress={handleRetry}
                disabled={isCapturing}
              >
                <Ionicons name="refresh" size={20} color={theme.primaryText} />
                <Text style={[styles.retryButtonText, { color: theme.primaryText, marginLeft: 8 }]}>
                  Try Again
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Camera Preview */}
          <View style={styles.cameraContainer}>
            <CameraView
              ref={cameraRef}
              style={styles.camera}
              facing="front"
              mode="picture"
            />
            {/* Simple overlay with guide frame */}
            <View style={styles.overlay} pointerEvents="none">
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
                  : isCapturing
                  ? "Processing..."
                  : "Position your face within the frame"}
              </Text>
            </View>
          </View>

          {isCapturing ? (
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
    ...StyleSheet.absoluteFillObject,
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
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
