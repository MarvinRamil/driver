import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '@/shared/hooks/use-theme';
import { biometricAuth } from '@/shared/services/biometricAuth';
import { biometricStorage } from '@/shared/services/biometricStorage';
import { Ionicons } from '@expo/vector-icons';
import { BeeColors } from '@/constants/theme';

interface BiometricEnablePromptProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** Callback when user dismisses the prompt */
  onDismiss: () => void;
  /** User's email for storing credentials */
  email: string;
  /** User's password for storing credentials */
  password: string;
}

/**
 * Biometric enable prompt component
 * Shows a modal asking user to enable biometric login
 */
export function BiometricEnablePrompt({
  visible,
  onDismiss,
  email,
  password,
}: BiometricEnablePromptProps) {
  const theme = useTheme();
  const [isBiometricAvailable, setIsBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState<string>('Biometric');
  const [isEnabling, setIsEnabling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkBiometric = async () => {
      try {
        const available = await biometricAuth.isAvailable();
        const type = await biometricAuth.getBiometricTypeName();
        setIsBiometricAvailable(available);
        setBiometricType(type);
      } catch (err) {
        console.warn('[BiometricEnablePrompt] Error checking biometric:', err);
        setIsBiometricAvailable(false);
      }
    };

    if (visible) {
      checkBiometric();
      setError(null);
    }
  }, [visible]);

  const handleEnable = async () => {
    if (!isBiometricAvailable || isEnabling) {
      return;
    }

    setIsEnabling(true);
    setError(null);

    try {
      // Authenticate with biometric to verify it works
      const LocalAuthentication = await import('expo-local-authentication');
      const result = await LocalAuthentication.default.authenticateAsync({
        promptMessage: `Enable ${biometricType} login?`,
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
        fallbackLabel: 'Use Password',
      });

      if (!result.success) {
        if (result.error === 'user_cancel') {
          setIsEnabling(false);
          return;
        }
        throw new Error(result.error || 'Biometric authentication failed');
      }

      // Store credentials after successful biometric verification
      await biometricStorage.storeCredentials(email, password);
      console.log('[BiometricEnablePrompt] Biometric login enabled successfully');

      // Close modal
      onDismiss();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to enable biometric login';
      console.error('[BiometricEnablePrompt] Error enabling biometric:', errorMessage);
      setError(errorMessage);
    } finally {
      setIsEnabling(false);
    }
  };

  const handleSkip = () => {
    onDismiss();
  };

  if (!isBiometricAvailable) {
    // Don't show prompt if biometric is not available
    return null;
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleSkip}
    >
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: theme.surface }]}>
          {/* Icon */}
          <View style={[styles.iconContainer, { backgroundColor: theme.primary + '20' }]}>
            <Ionicons name="finger-print" size={48} color={theme.primary} />
          </View>

          {/* Title */}
          <Text style={[styles.title, { color: theme.text }]}>
            Enable {biometricType} Login?
          </Text>

          {/* Description */}
          <Text style={[styles.description, { color: theme.textSecondary }]}>
            Use {biometricType} to quickly login without entering your password every time.
          </Text>

          {/* Error message */}
          {error && (
            <View style={[styles.errorContainer, { backgroundColor: BeeColors.red[50] }]}>
              <Ionicons name="alert-circle" size={16} color={BeeColors.red[600]} />
              <Text style={[styles.errorText, { color: BeeColors.red[700] }]}>{error}</Text>
            </View>
          )}

          {/* Buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.skipButton, { borderColor: theme.border }]}
              onPress={handleSkip}
              disabled={isEnabling}
            >
              <Text style={[styles.skipButtonText, { color: theme.textSecondary }]}>
                Maybe Later
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.enableButton,
                { backgroundColor: theme.primary },
                isEnabling && styles.enableButtonDisabled,
              ]}
              onPress={handleEnable}
              disabled={isEnabling}
            >
              {isEnabling ? (
                <ActivityIndicator size="small" color={theme.primaryText} />
              ) : (
                <Text style={[styles.enableButtonText, { color: theme.primaryText }]}>
                  Enable
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  container: {
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 24,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    gap: 8,
    width: '100%',
  },
  errorText: {
    flex: 1,
    fontSize: 12,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  skipButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  enableButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  enableButtonDisabled: {
    opacity: 0.6,
  },
  enableButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
});

