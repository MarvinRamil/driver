import { BeeColors } from "@/constants/theme";
import { useTheme } from "@/shared/hooks/use-theme";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { useAuth } from "@/features/auth";
import { apiClient } from "@/shared/services/apiClient";

/**
 * Complete driver registration with documents (license + selfie).
 * Shown after liveness verification. Requires email (from logged-in user).
 */
export default function DriverCompleteScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const [licenseUri, setLicenseUri] = useState<string | null>(null);
  const [selfieUri, setSelfieUri] = useState<string | null>(null);
  const [licenseNumber, setLicenseNumber] = useState("");
  const [licenseExpiryDate, setLicenseExpiryDate] = useState("");
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const email = user?.email;
  if (!email) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <Text style={[styles.errorText, { color: theme.text }]}>
          Please log in to complete registration.
        </Text>
        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: theme.primary }]}
          onPress={() => router.replace("/login")}
        >
          <Text style={[styles.primaryButtonText, { color: theme.primaryText }]}>Go to login</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const pickImage = async (type: "license" | "selfie") => {
    // For selfie, show option to use camera or gallery
    if (type === "selfie") {
      Alert.alert(
        "Take Selfie",
        "Choose an option",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Take Photo",
            onPress: async () => {
              const { status } = await ImagePicker.requestCameraPermissionsAsync();
              if (status !== "granted") {
                Alert.alert("Permission needed", "Allow camera access to take a photo.");
                return;
              }
              const result = await ImagePicker.launchCameraAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                quality: 0.8,
              });
              if (result.canceled || !result.assets?.[0]?.uri) return;
              setSelfieUri(result.assets[0].uri);
              setError(null);
            },
          },
          {
            text: "Choose from Library",
            onPress: async () => {
              const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
              if (status !== "granted") {
                Alert.alert("Permission needed", "Allow photo library access to upload images.");
                return;
              }
              const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                quality: 0.8,
              });
              if (result.canceled || !result.assets?.[0]?.uri) return;
              setSelfieUri(result.assets[0].uri);
              setError(null);
            },
          },
        ]
      );
    } else {
      // For license, use gallery only (or add camera option here too if needed)
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission needed", "Allow photo library access to upload images.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });
      if (result.canceled || !result.assets?.[0]?.uri) return;
      setLicenseUri(result.assets[0].uri);
      setError(null);
    }
  };

  const onSubmit = async () => {
    if (!licenseUri || !selfieUri) {
      setError("Please add both license and selfie photos.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      console.log("[DriverComplete] Starting registration submission...");
      console.log("[DriverComplete] Email:", email);
      console.log("[DriverComplete] License URI:", licenseUri);
      console.log("[DriverComplete] Selfie URI:", selfieUri);
      
      const formData = new FormData();
      formData.append("email", email);
      formData.append("licenseImage", {
        uri: licenseUri,
        name: "license.jpg",
        type: "image/jpeg",
      } as unknown as Blob);
      formData.append("selfieImage", {
        uri: selfieUri,
        name: "selfie.jpg",
        type: "image/jpeg",
      } as unknown as Blob);
      if (licenseNumber.trim()) formData.append("licenseNumber", licenseNumber.trim());
      if (licenseExpiryDate.trim()) formData.append("licenseExpiryDate", licenseExpiryDate.trim());
      if (address.trim()) formData.append("address", address.trim());

      console.log("[DriverComplete] Submitting form data...");
      // File uploads can take longer - use 120 seconds timeout
      const response = await apiClient.post<{ success: boolean; message?: string; data?: any }>(
        "api/auth/register/driver/complete",
        {
          body: formData,
          requiresAuth: false,
          headers: {},
          timeout: 120000, // 120 seconds for file uploads
        }
      );

      console.log("[DriverComplete] API Response:", {
        success: response.success,
        message: response.message,
        statusCode: response.statusCode,
        data: response.data,
      });

      if (!response.success) {
        const errorMsg = response.message || "Submission failed";
        console.error("[DriverComplete] Submission failed:", errorMsg);
        throw new Error(errorMsg);
      }

      console.log("[DriverComplete] Submission successful, refreshing user...");
      await refreshUser?.();
      
      Alert.alert(
        "Registration complete",
        "Your documents have been submitted. You can now use the app.",
        [{ text: "OK", onPress: () => router.replace("/(tabs)") }]
      );
    } catch (e) {
      console.error("[DriverComplete] Error during submission:", e);
      
      let errorMessage = "Something went wrong";
      if (e && typeof e === 'object' && 'message' in e) {
        errorMessage = String(e.message);
      } else if (e instanceof Error) {
        errorMessage = e.message;
      } else if (typeof e === 'string') {
        errorMessage = e;
      }
      
      // Log full error details
      console.error("[DriverComplete] Full error details:", {
        error: e,
        errorType: typeof e,
        errorMessage,
        errorString: String(e),
        errorJson: JSON.stringify(e, null, 2),
      });
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
    >
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top, paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={true}
        nestedScrollEnabled={true}
      >
        <View style={styles.content}>
          <Text style={[styles.title, { color: theme.text }]}>Complete registration</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            Upload your driver's license and a selfie. Your application will be reviewed.
          </Text>

          <View style={styles.field}>
            <Text style={[styles.label, { color: theme.text }]}>Driver's license photo *</Text>
            <TouchableOpacity
              style={[styles.uploadBox, { backgroundColor: theme.surface, borderColor: theme.border }]}
              onPress={() => pickImage("license")}
            >
              {licenseUri ? (
                <Ionicons name="checkmark-circle" size={32} color={BeeColors.green[600]} />
              ) : (
                <Ionicons name="document-attach" size={32} color={theme.textSecondary} />
              )}
              <Text style={[styles.uploadLabel, { color: theme.textSecondary }]}>
                {licenseUri ? "License added" : "Tap to add"}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.field}>
            <Text style={[styles.label, { color: theme.text }]}>Selfie photo *</Text>
            <TouchableOpacity
              style={[styles.uploadBox, { backgroundColor: theme.surface, borderColor: theme.border }]}
              onPress={() => pickImage("selfie")}
            >
              {selfieUri ? (
                <Ionicons name="checkmark-circle" size={32} color={BeeColors.green[600]} />
              ) : (
                <Ionicons name="person" size={32} color={theme.textSecondary} />
              )}
              <Text style={[styles.uploadLabel, { color: theme.textSecondary }]}>
                {selfieUri ? "Selfie added" : "Tap to add"}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.text }]}>License number (optional)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
              value={licenseNumber}
              onChangeText={setLicenseNumber}
              placeholder="e.g. D01-23-456789"
              placeholderTextColor={theme.placeholder}
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.text }]}>License expiry (optional)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
              value={licenseExpiryDate}
              onChangeText={setLicenseExpiryDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={theme.placeholder}
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.text }]}>Address (optional)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
              value={address}
              onChangeText={setAddress}
              placeholder="Your address"
              placeholderTextColor={theme.placeholder}
            />
          </View>

          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: theme.primary }, loading && styles.buttonDisabled]}
            onPress={onSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={theme.primaryText} />
            ) : (
              <Text style={[styles.primaryButtonText, { color: theme.primaryText }]}>Submit</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 100 },
  content: { paddingTop: 24 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  title: { fontSize: 24, fontWeight: "700", marginBottom: 8 },
  subtitle: { fontSize: 16, marginBottom: 24, lineHeight: 22 },
  field: { marginBottom: 16 },
  label: { fontSize: 16, fontWeight: "500", marginBottom: 8 },
  uploadBox: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 120,
  },
  uploadLabel: { marginTop: 8, fontSize: 14 },
  inputGroup: { marginBottom: 16 },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  errorContainer: {
    backgroundColor: BeeColors.red[50],
    borderColor: BeeColors.red[200],
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: { color: BeeColors.red[700], fontSize: 14 },
  primaryButton: {
    height: 52,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  primaryButtonText: { fontSize: 18, fontWeight: "600" },
  buttonDisabled: { opacity: 0.6 },
});
