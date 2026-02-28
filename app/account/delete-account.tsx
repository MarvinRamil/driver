import { BeeColors } from "@/constants/theme";
import { useAuth } from "@/features/auth";
import { authService } from "@/features/auth";
import { useTheme } from "@/shared/hooks/use-theme";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const CONFIRMATION_TEXT = "DELETE";

export default function DeleteAccountScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { logout } = useAuth();
  const [confirmText, setConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    if (confirmText !== CONFIRMATION_TEXT) return;
    setError(null);
    setIsDeleting(true);

    try {
      await authService.deleteAccount();
      Alert.alert(
        "Account Deleted",
        "Your account has been deleted successfully.",
        [
          {
            text: "OK",
            onPress: () => {
              logout();
              router.replace("/login");
            },
          },
        ]
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete account");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Delete Account</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.warning, { color: theme.text }]}>
          This action cannot be undone. Your personal information will be anonymized and your account deactivated.
        </Text>

        <Text style={[styles.sectionTitle, { color: theme.text }]}>When you delete your account:</Text>
        <View style={styles.bulletList}>
          <Text style={[styles.bullet, { color: theme.textSecondary }]}>• Your name, email, phone, and profile data will be anonymized</Text>
          <Text style={[styles.bullet, { color: theme.textSecondary }]}>• Your account will be deactivated</Text>
        </View>

        {error && (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={16} color={BeeColors.red[600]} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <Text style={[styles.label, { color: theme.text }]}>
          Type <Text style={styles.confirmLabel}>{CONFIRMATION_TEXT}</Text> to confirm
        </Text>
        <TextInput
          style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
          value={confirmText}
          onChangeText={(t) => setConfirmText(t.toUpperCase())}
          placeholder={CONFIRMATION_TEXT}
          placeholderTextColor={theme.placeholder}
          autoCapitalize="characters"
          editable={!isDeleting}
        />

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.cancelButton, { borderColor: theme.border }]}
            onPress={() => router.back()}
            disabled={isDeleting}
          >
            <Text style={[styles.cancelText, { color: theme.text }]}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.deleteButton, isDeleting && styles.deleteButtonDisabled]}
            onPress={handleDelete}
            disabled={confirmText !== CONFIRMATION_TEXT || isDeleting}
          >
            <Text style={styles.deleteText}>
              {isDeleting ? "Deleting..." : "Delete my account"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  headerSpacer: {
    width: 40,
    height: 40,
  },
  content: {
    padding: 16,
  },
  warning: {
    fontSize: 16,
    marginBottom: 20,
    lineHeight: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  bulletList: {
    marginBottom: 24,
  },
  bullet: {
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 4,
  },
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
  errorText: {
    flex: 1,
    fontSize: 14,
    color: BeeColors.red[700],
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 8,
  },
  confirmLabel: {
    fontFamily: "monospace",
    fontWeight: "700",
    color: BeeColors.red[600],
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    marginBottom: 24,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelText: {
    fontSize: 16,
    fontWeight: "700",
  },
  deleteButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: BeeColors.red[600],
    alignItems: "center",
    justifyContent: "center",
  },
  deleteButtonDisabled: {
    opacity: 0.6,
  },
  deleteText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
  },
});
