import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/shared/hooks/use-theme';

interface ResumeRegistrationScreenProps {
  email: string;
  onContinue: () => void;
  onBack: () => void;
}

/**
 * Resume registration screen component
 * Shown when user enters an email that has been verified but registration is incomplete
 */
export function ResumeRegistrationScreen({
  email,
  onContinue,
  onBack,
}: ResumeRegistrationScreenProps) {
  const insets = useSafeAreaInsets();
  const theme = useTheme();

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: theme.background }]}>
      <View style={styles.content}>
        {/* Header */}
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>

        {/* Icon */}
        <View style={[styles.iconContainer, { backgroundColor: theme.info + '20' }]}>
          <Ionicons name="checkmark-circle-outline" size={64} color={theme.info} />
        </View>

        {/* Title */}
        <Text style={[styles.title, { color: theme.text }]}>Continue Registration</Text>

        {/* Description */}
        <Text style={[styles.description, { color: theme.textSecondary }]}>
          Your email has been verified, but your registration is not yet complete.
        </Text>
        <Text style={[styles.email, { color: theme.text }]}>{email}</Text>
        <Text style={[styles.description, { color: theme.textSecondary, marginTop: 8 }]}>
          Click continue to finish setting up your driver account.
        </Text>

        {/* Continue Button */}
        <TouchableOpacity
          style={[styles.continueButton, { backgroundColor: theme.primary }]}
          onPress={onContinue}>
          <Text style={[styles.continueButtonText, { color: theme.primaryText }]}>
            Continue Registration
          </Text>
          <Ionicons name="arrow-forward" size={20} color={theme.primaryText} />
        </TouchableOpacity>
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
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 32,
    gap: 8,
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
});
