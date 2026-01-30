import React from 'react';
import { StyleSheet, ScrollView, View, RefreshControl, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '@/shared/hooks/use-theme';
import { useWallet } from '@/features/wallet';
import { useWalletTransactions } from '@/features/wallet';
import { ThemedView } from '@/shared/components/themed-view';
import { ThemedText } from '@/shared/components/themed-text';
import { useAuth } from '@/features/auth';
import { Ionicons } from '@expo/vector-icons';

export default function WalletScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const { wallet, isLoading, error, refresh } = useWallet(user?.id || '');
  const { transactions, isLoading: transactionsLoading } = useWalletTransactions(user?.id || '');

  const canAccessWallet = user?.role === 'Driver';

  if (!canAccessWallet) {
    return (
      <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.accessDenied}>
          <Ionicons name="lock-closed-outline" size={64} color={theme.textMuted} />
          <ThemedText type="title" style={[styles.accessDeniedTitle, { color: theme.text }]}>
            Access Restricted
          </ThemedText>
          <ThemedText style={[styles.accessDeniedText, { color: theme.textSecondary }]}>
            Wallet access is only available for solo drivers and operators.
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  const balance = wallet?.balance ?? 0;
  const pendingBalance = wallet?.pendingBalance ?? 0;

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refresh} />}
        showsVerticalScrollIndicator={false}>
        
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={[styles.profileImage, { borderColor: theme.primary }]}>
              <Ionicons name="person" size={20} color={theme.primary} />
            </View>
            <View>
              <ThemedText style={[styles.welcomeText, { color: theme.textSecondary }]}>
                Welcome back,
              </ThemedText>
              <ThemedText style={[styles.userName, { color: theme.text }]}>
                {user?.fullName || 'Driver'}
              </ThemedText>
            </View>
          </View>
          <TouchableOpacity style={[styles.notificationButton, { backgroundColor: theme.surface }]}>
            <Ionicons name="notifications-outline" size={20} color={theme.text} />
            <View style={[styles.notificationBadge, { backgroundColor: theme.error }]} />
          </TouchableOpacity>
        </View>

        {/* Wallet Card */}
        <View style={styles.walletCardContainer}>
          <View style={[styles.walletCard, { backgroundColor: '#111111' }]}>
            {/* Decorative background elements */}
            <View style={styles.walletCardBg1} />
            <View style={styles.walletCardBg2} />
            
            <View style={styles.walletCardContent}>
              <View style={styles.walletCardHeader}>
                <ThemedText style={[styles.walletCardLabel, { color: '#9ca3af' }]}>
                  Total Balance
                </ThemedText>
                <View style={[styles.verifiedBadge, { backgroundColor: '#1f2937' }]}>
                  <Ionicons name="checkmark-circle" size={12} color={theme.primary} />
                  <ThemedText style={[styles.verifiedText, { color: theme.primary }]}>
                    VERIFIED
                  </ThemedText>
                </View>
              </View>
              
              <ThemedText style={[styles.walletBalance, { color: '#fff' }]}>
                ₱{balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </ThemedText>
              
              <View style={styles.walletCardFooter}>
                <View>
                  <ThemedText style={[styles.beeIdLabel, { color: '#9ca3af' }]}>
                    Bee ID
                  </ThemedText>
                  <ThemedText style={[styles.beeIdValue, { color: '#fff' }]}>
                    **** {user?.id?.slice(-4) || '8924'}
                  </ThemedText>
                </View>
                <View style={styles.chipIcon}>
                  <Ionicons name="card-outline" size={32} color="#fff" />
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.quickAction}>
            <View style={[styles.quickActionIcon, { backgroundColor: theme.primary }]}>
              <Ionicons name="add" size={24} color="#111" />
            </View>
            <ThemedText style={[styles.quickActionLabel, { color: theme.textSecondary }]}>
              Top Up
            </ThemedText>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickAction}>
            <View style={[styles.quickActionIcon, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Ionicons name="arrow-up-outline" size={24} color={theme.text} />
            </View>
            <ThemedText style={[styles.quickActionLabel, { color: theme.textSecondary }]}>
              Transfer
            </ThemedText>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickAction}>
            <View style={[styles.quickActionIcon, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Ionicons name="qr-code-outline" size={24} color={theme.text} />
            </View>
            <ThemedText style={[styles.quickActionLabel, { color: theme.textSecondary }]}>
              Scan
            </ThemedText>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickAction}>
            <View style={[styles.quickActionIcon, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Ionicons name="ellipsis-horizontal-outline" size={24} color={theme.text} />
            </View>
            <ThemedText style={[styles.quickActionLabel, { color: theme.textSecondary }]}>
              More
            </ThemedText>
          </TouchableOpacity>
        </View>

        {/* Recent Activity */}
        <View style={styles.activitySection}>
          <View style={styles.activityHeader}>
            <ThemedText type="subtitle" style={[styles.activityTitle, { color: theme.text }]}>
              Recent Activity
            </ThemedText>
            <TouchableOpacity>
              <ThemedText style={[styles.seeAllText, { color: theme.primary }]}>
                See All
              </ThemedText>
            </TouchableOpacity>
          </View>

          {error ? (
            <View style={[styles.errorCard, { backgroundColor: theme.surface }]}>
              <ThemedText style={[styles.errorText, { color: theme.error }]}>
                {error}
              </ThemedText>
            </View>
          ) : transactions.length === 0 ? (
            <View style={[styles.emptyState, { backgroundColor: theme.surface }]}>
              <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
                No recent transactions
              </ThemedText>
            </View>
          ) : (
            <View style={styles.transactionsList}>
              {transactions.slice(0, 10).map((transaction) => {
                const isCredit = transaction.type === 'Credit' || transaction.type === 'Earning';
                const iconName = isCredit ? 'car-outline' : transaction.type === 'Withdrawal' ? 'arrow-down-outline' : 'card-outline';
                const iconColor = isCredit ? theme.success : theme.error;
                const iconBg = isCredit ? theme.success + '20' : theme.error + '20';

                return (
                  <View
                    key={transaction.id}
                    style={[styles.transactionCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                    <View style={styles.transactionLeft}>
                      <View style={[styles.transactionIcon, { backgroundColor: iconBg }]}>
                        <Ionicons name={iconName} size={20} color={iconColor} />
                      </View>
                      <View style={styles.transactionInfo}>
                        <ThemedText style={[styles.transactionTitle, { color: theme.text }]}>
                          {transaction.description}
                        </ThemedText>
                        <ThemedText style={[styles.transactionDate, { color: theme.textSecondary }]}>
                          {new Date(transaction.date).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </ThemedText>
                      </View>
                    </View>
                    <ThemedText
                      style={[
                        styles.transactionAmount,
                        { color: isCredit ? theme.success : theme.text },
                      ]}>
                      {isCredit ? '+' : '-'}
                      ₱{Math.abs(transaction.amount ?? 0).toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </ThemedText>
                  </View>
                );
              })}
            </View>
          )}
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 24,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  profileImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  welcomeText: {
    fontSize: 14,
    fontWeight: '500',
  },
  userName: {
    fontSize: 18,
    fontWeight: '700',
  },
  notificationButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  notificationBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#fff',
  },
  walletCardContainer: {
    paddingHorizontal: 24,
    marginBottom: 32,
  },
  walletCard: {
    borderRadius: 24,
    padding: 24,
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  walletCardBg1: {
    position: 'absolute',
    top: -64,
    right: -64,
    width: 256,
    height: 256,
    borderRadius: 128,
    backgroundColor: '#FFD700',
    opacity: 0.1,
  },
  walletCardBg2: {
    position: 'absolute',
    bottom: -64,
    left: -64,
    width: 192,
    height: 192,
    borderRadius: 96,
    backgroundColor: '#FFD700',
    opacity: 0.05,
  },
  walletCardContent: {
    position: 'relative',
    zIndex: 10,
  },
  walletCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  walletCardLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#374151',
  },
  verifiedText: {
    fontSize: 10,
    fontWeight: '700',
  },
  walletBalance: {
    fontSize: 36,
    fontWeight: '700',
    letterSpacing: -0.5,
    marginBottom: 32,
  },
  walletCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  beeIdLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  beeIdValue: {
    fontSize: 14,
    fontFamily: 'monospace',
    letterSpacing: 2,
  },
  chipIcon: {
    opacity: 0.8,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 24,
    marginBottom: 32,
  },
  quickAction: {
    alignItems: 'center',
    gap: 8,
  },
  quickActionIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  quickActionLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  activitySection: {
    paddingHorizontal: 24,
    gap: 16,
  },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  activityTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: '600',
  },
  errorCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
  },
  emptyState: {
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
  },
  transactionsList: {
    gap: 12,
  },
  transactionCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  transactionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    flex: 1,
  },
  transactionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  transactionInfo: {
    flex: 1,
    gap: 4,
  },
  transactionTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  transactionDate: {
    fontSize: 12,
  },
  transactionAmount: {
    fontSize: 14,
    fontWeight: '700',
  },
  accessDenied: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 16,
  },
  accessDeniedTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginTop: 16,
  },
  accessDeniedText: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
});
