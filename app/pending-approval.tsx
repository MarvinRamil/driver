import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/shared/hooks/use-theme';
import { BeeColors } from '@/constants/theme';
import { useAuth } from '@/features/auth';

/**
 * Pending Approval screen
 * Shown when the driver has submitted their application and is waiting for admin approval.
 * Avoids showing "complete your registration" again and clarifies that nothing else is needed.
 */
export default function PendingApprovalScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const router = useRouter();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout().then(() => router.replace('/login'));
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24, backgroundColor: theme?.background ?? '#FFFFFF' }]}>
      <View style={styles.card}>
        <View style={[styles.iconWrap, { backgroundColor: BeeColors.amber[100] }]}>
          <Ionicons name="time-outline" size={48} color={BeeColors.amber[600]} />
        </View>
        <Text style={[styles.title, { color: theme?.text ?? '#212121' }]}>
          Application under review
        </Text>
        <Text style={[styles.message, { color: theme?.textSecondary ?? '#616161' }]}>
          Your driver registration has been submitted successfully. Our team is reviewing your application and will notify you once it’s approved.
        </Text>
        <Text style={[styles.subMessage, { color: theme?.textSecondary ?? '#616161' }]}>
          You don’t need to do anything else. If you have questions, contact support.
        </Text>
      </View>
      <Text
        style={[styles.logoutLink, { color: theme?.textSecondary ?? '#616161' }]}
        onPress={handleLogout}
      >
        Sign out
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 12,
  },
  subMessage: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  logoutLink: {
    marginTop: 32,
    fontSize: 16,
    textDecorationLine: 'underline',
  },
});
