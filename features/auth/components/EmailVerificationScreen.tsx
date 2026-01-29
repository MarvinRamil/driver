import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/shared/hooks/use-theme';
import { BeeColors } from '@/constants/theme';
import { registrationService } from '../services/registrationService';
import * as Linking from 'expo-linking';

interface EmailVerificationScreenProps {
  email: string;
  onVerified: () => void;
  onBack: () => void;
}

/**
 * Email verification screen component
 * Shows "Check your email" message with resend option
 * Handles deep linking for email verification
 */
export function EmailVerificationScreen({
  email,
  onVerified,
  onBack,
}: EmailVerificationScreenProps) {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const [isResending, setIsResending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  // Handle deep link for email verification
  useEffect(() => {
    const handleDeepLink = async (url: string) => {
      try {
        const parsedUrl = Linking.parse(url);
        const emailParam = parsedUrl.queryParams?.email as string;
        const tokenParam = parsedUrl.queryParams?.token as string;

        if (emailParam && tokenParam && emailParam.toLowerCase() === email.toLowerCase()) {
          setIsVerifying(true);
          const result = await registrationService.verifyEmail(emailParam, tokenParam);
          
          if (result.success) {
            Alert.alert('Email Verified', result.message, [
              {
                text: 'Continue',
                onPress: onVerified,
              },
            ]);
          } else {
            Alert.alert('Verification Failed', result.message);
          }
        }
      } catch (error) {
        console.error('[EmailVerificationScreen] Error handling deep link:', error);
      } finally {
        setIsVerifying(false);
      }
    };

    // Check if app was opened via deep link
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleDeepLink(url);
      }
    });

    // Listen for deep links while app is running
    const subscription = Linking.addEventListener('url', (event) => {
      handleDeepLink(event.url);
    });

    return () => {
      subscription.remove();
    };
  }, [email, onVerified]);

  const handleResendEmail = async () => {
    setIsResending(true);
    try {
      const result = await registrationService.resendVerificationEmail(email);
      if (result.success) {
        Alert.alert('Email Sent', result.message);
      } else {
        Alert.alert('Error', result.message);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to resend verification email. Please try again.');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: theme.background }]}>
      <View style={styles.content}>
        {/* Header */}
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>

        {/* Icon */}
        <View style={[styles.iconContainer, { backgroundColor: theme.primary + '20' }]}>
          <Ionicons name="mail-outline" size={64} color={theme.primary} />
        </View>

        {/* Title */}
        <Text style={[styles.title, { color: theme.text }]}>Check Your Email</Text>

        {/* Description */}
        <Text style={[styles.description, { color: theme.textSecondary }]}>
          We've sent a verification link to
        </Text>
        <Text style={[styles.email, { color: theme.primary }]}>{email}</Text>
        <Text style={[styles.description, { color: theme.textSecondary, marginTop: 8 }]}>
          Please click the link in the email to verify your account and continue registration.
        </Text>

        {/* Loading indicator if verifying */}
        {isVerifying && (
          <View style={styles.verifyingContainer}>
            <ActivityIndicator size="small" color={theme.primary} />
            <Text style={[styles.verifyingText, { color: theme.textSecondary }]}>
              Verifying...
            </Text>
          </View>
        )}

        {/* Resend Button */}
        <TouchableOpacity
          style={[
            styles.resendButton,
            { backgroundColor: theme.surface, borderColor: theme.border },
            isResending && styles.resendButtonDisabled,
          ]}
          onPress={handleResendEmail}
          disabled={isResending}>
          {isResending ? (
            <ActivityIndicator size="small" color={theme.text} />
          ) : (
            <>
              <Ionicons name="refresh-outline" size={20} color={theme.text} />
              <Text style={[styles.resendButtonText, { color: theme.text }]}>
                Resend Verification Email
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* Help Text */}
        <View style={styles.helpContainer}>
          <Ionicons name="information-circle-outline" size={16} color={theme.textMuted} />
          <Text style={[styles.helpText, { color: theme.textMuted }]}>
            Didn't receive the email? Check your spam folder or try resending.
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 8,
  },
  email: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  verifyingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    gap: 8,
  },
  verifyingText: {
    fontSize: 14,
  },
  resendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 32,
    gap: 8,
  },
  resendButtonDisabled: {
    opacity: 0.6,
  },
  resendButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  helpContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 24,
    paddingHorizontal: 16,
    gap: 8,
  },
  helpText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
});
