import React from 'react';
import { StyleSheet, ScrollView, View, TouchableOpacity, Switch, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/shared/hooks/use-theme';
import { ThemedView } from '@/shared/components/themed-view';
import { ThemedText } from '@/shared/components/themed-text';
import { useAuth } from '@/features/auth';
import { useDriverStatusContext } from '@/features/driver/context/DriverStatusContext';
import { useDashboardStats } from '@/features/dashboard';

/**
 * More/Profile Screen
 * Central hub for profile, wallet, income, missions, history, and settings
 */
export default function MoreScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { isOnline, toggleOnlineStatus, isLoading: isStatusLoading } = useDriverStatusContext();
  const { stats } = useDashboardStats();

  const canAccessWallet = user?.role === 'Driver';
  
  // Safe defaults for stats
  const safeStats = stats || {
    totalBookings: 0,
    activeBookings: 0,
    completedBookings: 0,
    walletBalance: null,
    canAccessWallet: false,
  };

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          onPress: async () => {
            await logout();
            router.replace('/login');
          },
        },
      ],
      { cancelable: true }
    );
  };

  const menuItems = [
    {
      id: 'wallet',
      title: 'Wallet',
      icon: 'wallet-outline',
      route: '/(tabs)/wallet',
      show: canAccessWallet,
    },
    {
      id: 'income',
      title: 'Earnings & Income',
      icon: 'cash-outline',
      route: '/(tabs)/income',
      show: canAccessWallet,
    },
    {
      id: 'missions',
      title: 'Missions',
      icon: 'trophy-outline',
      route: '/(tabs)/missions',
      show: true,
    },
    {
      id: 'referrals',
      title: 'Refer & Earn',
      icon: 'people-outline',
      route: '/referrals',
      show: true,
    },
    {
      id: 'giveaways',
      title: 'Giveaways',
      icon: 'gift-outline',
      route: '/(tabs)/giveaways',
      show: true,
    },
    {
      id: 'history',
      title: 'Trip History',
      icon: 'time-outline',
      route: '/(tabs)/history',
      show: true,
    },
    {
      id: 'support',
      title: 'Support & Help',
      icon: 'help-circle-outline',
      route: '/support',
      show: true,
    },
  ].filter((item) => item.show);

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: theme.primary }]}>
          <View style={styles.profileSection}>
            <View style={[styles.avatar, { borderColor: '#111' }]}>
              <Ionicons name="person" size={32} color={theme.primary} />
            </View>
            <View style={styles.profileInfo}>
              <ThemedText style={[styles.profileName, { color: '#111' }]}>
                {user?.fullName || 'Driver'}
              </ThemedText>
              <ThemedText style={[styles.profileEmail, { color: '#111' + 'B3' }]}>
                {user?.email || ''}
              </ThemedText>
            </View>
          </View>
        </View>

        {/* Online Status */}
        <View style={[styles.statusCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.statusContent}>
            <View style={[styles.statusIcon, { backgroundColor: theme.primary + '20' }]}>
              <Ionicons name="flash" size={20} color={theme.primary} />
            </View>
            <View style={styles.statusInfo}>
              <ThemedText style={[styles.statusTitle, { color: theme.text }]}>Online Status</ThemedText>
              <ThemedText style={[styles.statusSubtitle, { color: theme.textSecondary }]}>
                {isOnline ? 'Accepting new bookings' : 'Currently offline'}
              </ThemedText>
            </View>
          </View>
          <Switch
            value={isOnline}
            onValueChange={toggleOnlineStatus}
            trackColor={{ false: theme.toggleOffTrack, true: theme.toggleOnTrack }}
            thumbColor={isOnline ? theme.toggleOnKnob : theme.toggleOffKnob}
            disabled={isStatusLoading}
          />
        </View>

        {/* Quick Stats */}
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Ionicons name="cube-outline" size={24} color={theme.primary} />
            <ThemedText style={[styles.statValue, { color: theme.text }]}>{safeStats.completedBookings}</ThemedText>
            <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>Completed Trips</ThemedText>
          </View>
          <View style={[styles.statCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Ionicons name="star-outline" size={24} color={theme.warning} />
            <ThemedText style={[styles.statValue, { color: theme.text }]}>4.9</ThemedText>
            <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>Rating</ThemedText>
          </View>
          {canAccessWallet && (
            <View style={[styles.statCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Ionicons name="wallet-outline" size={24} color={theme.success} />
              <ThemedText style={[styles.statValue, { color: theme.text }]}>
                ₱{((safeStats.walletBalance ?? 0) / 1000).toFixed(1)}k
              </ThemedText>
              <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>Balance</ThemedText>
            </View>
          )}
        </View>

        {/* Menu Items */}
        <View style={styles.menuSection}>
          <ThemedText type="subtitle" style={[styles.sectionTitle, { color: theme.text }]}>
            Menu
          </ThemedText>
          <View style={[styles.menuCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            {menuItems.map((item, index) => (
              <React.Fragment key={item.id}>
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => router.push(item.route as any)}>
                  <View style={styles.menuItemLeft}>
                    <View style={[styles.menuIcon, { backgroundColor: theme.border }]}>
                      <Ionicons name={item.icon as any} size={20} color={theme.text} />
                    </View>
                    <ThemedText style={[styles.menuItemText, { color: theme.text }]}>{item.title}</ThemedText>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
                </TouchableOpacity>
                {index < menuItems.length - 1 && (
                  <View style={[styles.menuDivider, { backgroundColor: theme.border }]} />
                )}
              </React.Fragment>
            ))}
          </View>
        </View>

        {/* Profile Section */}
        <View style={styles.menuSection}>
          <ThemedText type="subtitle" style={[styles.sectionTitle, { color: theme.text }]}>
            Profile
          </ThemedText>
          <View style={[styles.menuCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => router.push('/(tabs)/profile')}>
              <View style={styles.menuItemLeft}>
                <View style={[styles.menuIcon, { backgroundColor: theme.border }]}>
                  <Ionicons name="person-outline" size={20} color={theme.text} />
                </View>
                <ThemedText style={[styles.menuItemText, { color: theme.text }]}>Edit Profile</ThemedText>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
            </TouchableOpacity>
            <View style={[styles.menuDivider, { backgroundColor: theme.border }]} />
            <TouchableOpacity style={styles.menuItem} onPress={handleLogout}>
              <View style={styles.menuItemLeft}>
                <View style={[styles.menuIcon, { backgroundColor: theme.error + '20' }]}>
                  <Ionicons name="log-out-outline" size={20} color={theme.error} />
                </View>
                <ThemedText style={[styles.menuItemText, { color: theme.error }]}>Logout</ThemedText>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  header: {
    paddingTop: 48,
    paddingBottom: 32,
    paddingHorizontal: 24,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 3,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInfo: {
    flex: 1,
    gap: 4,
  },
  profileName: {
    fontSize: 24,
    fontWeight: '700',
  },
  profileEmail: {
    fontSize: 14,
  },
  statusCard: {
    marginHorizontal: 24,
    marginTop: -16,
    marginBottom: 24,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statusContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  statusIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusInfo: {
    gap: 4,
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  statusSubtitle: {
    fontSize: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    gap: 8,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  menuSection: {
    paddingHorizontal: 24,
    marginBottom: 24,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  menuCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuItemText: {
    fontSize: 16,
    fontWeight: '500',
  },
  menuDivider: {
    height: 1,
    marginLeft: 68,
  },
});

