import { BeeColors } from "@/constants/theme";
import { useTheme } from "@/shared/hooks/use-theme";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/features/auth";
import { livenessService } from "@/features/liveness";

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
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [directions, setDirections] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentDirection = directions[currentIndex];

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

  const handleCapture = async () => {
    if (!sessionId || !currentDirection) return;

    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Camera required",
        "Please allow camera access to complete face verification."
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      allowsEditing: false,
      quality: 0.8,
    });

    if (result.canceled || !result.assets?.[0]?.uri) return;

    setSubmitting(true);
    setError(null);
    try {
      const data = await livenessService.submitImage(
        sessionId,
        currentDirection,
        result.assets[0].uri
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
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
          Starting verification...
        </Text>
      </View>
    );
  }

  if (error && !sessionId) {
    return (
      <View style={[styles.center, styles.padded, { backgroundColor: theme.background }]}>
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
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top }]}>
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

        <TouchableOpacity
          style={[
            styles.captureButton,
            { backgroundColor: theme.primary },
            submitting && styles.buttonDisabled,
          ]}
          onPress={handleCapture}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color={theme.primaryText} />
          ) : (
            <>
              <Ionicons name="camera" size={24} color={theme.primaryText} />
              <Text style={[styles.captureButtonText, { color: theme.primaryText }]}>
                Take photo
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
  },
  content: {
    flex: 1,
    paddingTop: 24,
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
  captureButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    height: 52,
    borderRadius: 12,
    marginTop: "auto",
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
