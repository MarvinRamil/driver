import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, ScrollView, View, RefreshControl, TouchableOpacity, Modal, TextInput, Alert, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/shared/hooks/use-theme';
import { useWallet } from '@/features/wallet';
import { useWalletTransactions } from '@/features/wallet';
import { useCashEligibility, useTopUp, useTopUpHistory, useWalletTopUpEvents, walletService } from '@/features/wallet';
import { ThemedView } from '@/shared/components/themed-view';
import { ThemedText } from '@/shared/components/themed-text';
import { useAuth } from '@/features/auth';
import { Ionicons } from '@expo/vector-icons';

export default function WalletScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { user } = useAuth();
  const { wallet, isLoading, error, refresh } = useWallet();
  const { transactions } = useWalletTransactions();
  const { data: cashEligibility, refresh: refreshEligibility } = useCashEligibility();
  const { topUps, refresh: refreshTopUps } = useTopUpHistory();
  const { createTopUp, isSubmitting: topUpSubmitting } = useTopUp();
  const [topUpModalVisible, setTopUpModalVisible] = useState(false);
  const [transferModalVisible, setTransferModalVisible] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState('200');
  const [transferAmount, setTransferAmount] = useState('100');
  const [transferFrom, setTransferFrom] = useState<'Personal' | 'TopUp'>('Personal');

  const onRefreshAll = useCallback(async () => {
    await Promise.all([refresh(), refreshEligibility(), refreshTopUps()]);
  }, [refresh, refreshEligibility, refreshTopUps]);

  // Real-time: when webhook marks top-up as paid, backend pushes TopUpPaid via SignalR; refresh wallet and history
  useWalletTopUpEvents(user?.id, () => {
    onRefreshAll();
  });

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

  const personalBalance = wallet?.personalBalance ?? 0;
  const topUpBalance = wallet?.topUpBalance ?? 0;
  const pendingBalance = wallet?.pendingPayout ?? 0;
  const canAcceptCashJobs = wallet?.canAcceptCashJobs ?? true;
  const effectiveCashEligibility = cashEligibility?.canAcceptCashJobs ?? canAcceptCashJobs;

  const topUpStatusText = useMemo(() => {
    if (!cashEligibility) return '';
    const threshold = Number.isFinite(cashEligibility.blockThreshold) ? cashEligibility.blockThreshold : 0;
    const current = Number.isFinite(cashEligibility.currentTopUpBalance) ? cashEligibility.currentTopUpBalance : 0;
    return `Threshold: ₱${threshold.toFixed(2)} | Current: ₱${current.toFixed(2)}`;
  }, [cashEligibility]);

  const handleCancelTopUp = (topUpId: string) => {
    if (!user?.id) return;
    Alert.alert(
      'Cancel top-up',
      'Are you sure you want to cancel this top-up? You will need to create a new one to pay.',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              await walletService.cancelTopUp(user.id, topUpId);
              await refreshTopUps();
            } catch (e) {
              Alert.alert('Error', e instanceof Error ? e.message : 'Failed to cancel top-up');
            }
          },
        },
      ]
    );
  };

  const handleCreateTopUp = async () => {
    const amount = Number(topUpAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid top-up amount.');
      return;
    }

    try {
      const topUp = await createTopUp(amount, undefined, 'Driver top-up wallet funding');
      setTopUpModalVisible(false);
      if (topUp.xenditInvoiceUrl) {
        try {
          const canOpen = await Linking.canOpenURL(topUp.xenditInvoiceUrl);
          if (canOpen) {
            await Linking.openURL(topUp.xenditInvoiceUrl);
          } else {
            Alert.alert('Top-up Created', 'Invoice was created, but your device cannot open the payment link.');
          }
        } catch {
          Alert.alert('Top-up Created', 'Invoice created, but failed to open link automatically.');
        }
      } else {
        Alert.alert('Top-up Created', 'Top-up request created. You can open it from Top-up History.');
      }
      await onRefreshAll();
    } catch (err) {
      Alert.alert('Top-up Failed', err instanceof Error ? err.message : 'Unable to create top-up');
    }
  };

  const handleTransfer = async () => {
    if (!user?.id) return;
    const amount = Number(transferAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid transfer amount.');
      return;
    }

    const to = transferFrom === 'Personal' ? 'TopUp' : 'Personal';
    try {
      await walletService.transferWalletBalance(user.id, transferFrom, to, amount);
      setTransferModalVisible(false);
      Alert.alert('Transfer Complete', `Moved ₱${amount.toFixed(2)} from ${transferFrom} to ${to}.`);
      await onRefreshAll();
    } catch (err) {
      Alert.alert('Transfer Failed', err instanceof Error ? err.message : 'Unable to transfer funds');
    }
  };

  const openTopUpLink = async (url?: string | null) => {
    if (!url) {
      Alert.alert('No Link', 'This top-up has no invoice URL.');
      return;
    }

    try {
      const canOpen = await Linking.canOpenURL(url);
      if (!canOpen) {
        Alert.alert('Cannot Open Link', 'Your device cannot open this URL.');
        return;
      }
      await Linking.openURL(url);
    } catch {
      Alert.alert('Open Failed', 'Failed to open invoice URL.');
    }
  };

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={onRefreshAll} />}
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
                  Personal Wallet
                </ThemedText>
                <View style={[styles.verifiedBadge, { backgroundColor: '#1f2937' }]}>
                  <Ionicons name="checkmark-circle" size={12} color={theme.primary} />
                  <ThemedText style={[styles.verifiedText, { color: theme.primary }]}>
                    VERIFIED
                  </ThemedText>
                </View>
              </View>
              
              <ThemedText style={[styles.walletBalance, { color: '#fff' }]}>
                ₱{personalBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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

        {/* Top-up wallet status */}
        <View style={[styles.summaryCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <ThemedText style={[styles.summaryTitle, { color: theme.text }]}>Top-up Wallet</ThemedText>
          <ThemedText style={[styles.summaryValue, { color: theme.text }]}>
            ₱{topUpBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </ThemedText>
          <ThemedText style={[styles.summarySubtext, { color: effectiveCashEligibility ? theme.success : theme.error }]}>
            {effectiveCashEligibility ? 'Eligible for cash jobs' : 'Cash jobs temporarily blocked'}
          </ThemedText>
          {!!topUpStatusText && (
            <ThemedText style={[styles.summarySubtext, { color: theme.textSecondary }]}>
              {topUpStatusText}
            </ThemedText>
          )}
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.quickAction} onPress={() => setTopUpModalVisible(true)}>
            <View style={[styles.quickActionIcon, { backgroundColor: theme.primary }]}>
              <Ionicons name="add" size={24} color="#111" />
            </View>
            <ThemedText style={[styles.quickActionLabel, { color: theme.textSecondary }]}>
              Top Up
            </ThemedText>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickAction} onPress={() => setTransferModalVisible(true)}>
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
                const isCredit = ['Earning', 'TopUp', 'WalletTransferIn', 'Refund'].includes(transaction.type);
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

        {/* Top-up History */}
        <View style={styles.activitySection}>
          <View style={styles.activityHeader}>
            <ThemedText type="subtitle" style={[styles.activityTitle, { color: theme.text }]}>
              Top-up History
            </ThemedText>
          </View>
          {topUps.length === 0 ? (
            <View style={[styles.emptyState, { backgroundColor: theme.surface }]}>
              <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
                No top-up records yet
              </ThemedText>
            </View>
          ) : (
            <View style={styles.transactionsList}>
              {topUps.slice(0, 8).map((topUp) => {
                const statusColor =
                  topUp.status === 'Paid'
                    ? theme.success
                    : topUp.status === 'Pending'
                    ? theme.primary
                    : topUp.status === 'Expired' || topUp.status === 'Cancelled'
                    ? theme.textSecondary
                    : theme.error;
                const statusBg = `${statusColor}20`;
                const statusIcon =
                  topUp.status === 'Paid'
                    ? 'checkmark-circle-outline'
                    : topUp.status === 'Pending'
                    ? 'time-outline'
                    : topUp.status === 'Expired' || topUp.status === 'Cancelled'
                    ? 'ban-outline'
                    : 'close-circle-outline';
                const isPending = topUp.status === 'Pending';
                const isPaid = topUp.status === 'Paid';

                return (
                  <View
                    key={topUp.id}
                    style={[styles.transactionCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                    <View style={styles.transactionLeft}>
                      <View style={[styles.transactionIcon, { backgroundColor: statusBg }]}>
                        <Ionicons name={statusIcon} size={20} color={statusColor} />
                      </View>
                      <View style={styles.transactionInfo}>
                        <ThemedText style={[styles.transactionTitle, { color: theme.text }]}>
                          Top-up #{topUp.externalId.slice(-8)}
                        </ThemedText>
                        <ThemedText style={[styles.transactionDate, { color: theme.textSecondary }]}>
                          {new Date(topUp.createdAt).toLocaleString()}
                        </ThemedText>
                        <ThemedText style={[styles.transactionDate, { color: statusColor }]}>
                          {topUp.status}
                        </ThemedText>
                      </View>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 8 }}>
                      <ThemedText style={[styles.transactionAmount, { color: theme.text }]}>
                        ₱{(topUp.amount ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </ThemedText>
                      {isPending && !!topUp.xenditInvoiceUrl && (
                        <TouchableOpacity
                          onPress={() => openTopUpLink(topUp.xenditInvoiceUrl!)}
                          style={[styles.linkButton, { borderColor: theme.border }]}>
                          <ThemedText style={{ color: theme.primary, fontSize: 12, fontWeight: '600' }}>
                            Pay now
                          </ThemedText>
                        </TouchableOpacity>
                      )}
                      {isPaid && !!topUp.xenditInvoiceUrl && (
                        <TouchableOpacity
                          onPress={() => openTopUpLink(topUp.xenditInvoiceUrl!)}
                          style={[styles.linkButton, { borderColor: theme.border }]}>
                          <ThemedText style={{ color: theme.primary, fontSize: 12, fontWeight: '600' }}>
                            Open receipt
                          </ThemedText>
                        </TouchableOpacity>
                      )}
                      {isPending && user?.id && (
                        <TouchableOpacity
                          onPress={() => handleCancelTopUp(topUp.id)}
                          style={[styles.linkButton, { borderColor: theme.error }]}>
                          <ThemedText style={{ color: theme.error, fontSize: 12, fontWeight: '600' }}>
                            Cancel
                          </ThemedText>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      <Modal visible={topUpModalVisible} animationType="slide" transparent onRequestClose={() => setTopUpModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: theme.surface }]}>
            <ThemedText type="subtitle" style={{ color: theme.text }}>Create Top-up</ThemedText>
            <TextInput
              value={topUpAmount}
              onChangeText={setTopUpAmount}
              keyboardType="numeric"
              style={[styles.input, { borderColor: theme.border, color: theme.text }]}
              placeholder="Amount"
              placeholderTextColor={theme.textMuted}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setTopUpModalVisible(false)} style={[styles.modalBtn, { borderColor: theme.border }]}>
                <ThemedText style={{ color: theme.text }}>Cancel</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleCreateTopUp} style={[styles.modalBtn, { backgroundColor: theme.primary }]}>
                <ThemedText style={{ color: '#111' }}>{topUpSubmitting ? 'Creating...' : 'Create'}</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={transferModalVisible} animationType="slide" transparent onRequestClose={() => setTransferModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: theme.surface }]}>
            <ThemedText type="subtitle" style={{ color: theme.text }}>Transfer Wallet Balance</ThemedText>
            <View style={styles.transferToggle}>
              <TouchableOpacity
                onPress={() => setTransferFrom('Personal')}
                style={[styles.pill, { backgroundColor: transferFrom === 'Personal' ? theme.primary : theme.surface, borderColor: theme.border }]}>
                <ThemedText style={{ color: transferFrom === 'Personal' ? '#111' : theme.text }}>From Personal</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setTransferFrom('TopUp')}
                style={[styles.pill, { backgroundColor: transferFrom === 'TopUp' ? theme.primary : theme.surface, borderColor: theme.border }]}>
                <ThemedText style={{ color: transferFrom === 'TopUp' ? '#111' : theme.text }}>From Top-up</ThemedText>
              </TouchableOpacity>
            </View>
            <TextInput
              value={transferAmount}
              onChangeText={setTransferAmount}
              keyboardType="numeric"
              style={[styles.input, { borderColor: theme.border, color: theme.text }]}
              placeholder="Amount"
              placeholderTextColor={theme.textMuted}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setTransferModalVisible(false)} style={[styles.modalBtn, { borderColor: theme.border }]}>
                <ThemedText style={{ color: theme.text }}>Cancel</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleTransfer} style={[styles.modalBtn, { backgroundColor: theme.primary }]}>
                <ThemedText style={{ color: '#111' }}>Transfer</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  summaryCard: {
    marginHorizontal: 24,
    marginBottom: 16,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 6,
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: '700',
  },
  summarySubtext: {
    fontSize: 12,
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  modalBtn: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  transferToggle: {
    flexDirection: 'row',
    gap: 8,
  },
  pill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  linkButton: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
});
