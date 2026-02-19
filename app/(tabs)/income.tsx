import React from 'react';
import { StyleSheet, ScrollView, View, TouchableOpacity, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '@/shared/hooks/use-theme';
import { useEarnings, useEarningsHistory, EarningsPeriod } from '@/features/earnings';
import { useAuth } from '@/features/auth';
import { ThemedView } from '@/shared/components/themed-view';
import { ThemedText } from '@/shared/components/themed-text';
import { Ionicons } from '@expo/vector-icons';

export default function IncomeScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const { earnings, isLoading, error, period, setPeriod, refresh } = useEarnings(user?.id || '');
  const { history: earningsHistory, isLoading: historyLoading, refresh: refreshHistory } = useEarningsHistory(user?.id || '', { limit: 20 });

  const periods: EarningsPeriod[] = ['Today', 'Week', 'Month'];

  const onRefresh = async () => {
    await Promise.all([refresh(), refreshHistory()]);
  };

  const getMaxEarning = () => {
    if (!earnings?.dailyBreakdown || earnings.dailyBreakdown.length === 0) return 0;
    return Math.max(...earnings.dailyBreakdown.map((d) => d.earnings));
  };

  const maxEarning = getMaxEarning();

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={isLoading || historyLoading} onRefresh={onRefresh} />}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <ThemedText type="title" style={[styles.headerTitle, { color: theme.text }]}>
            My Earnings
          </ThemedText>
          <TouchableOpacity>
            <Ionicons name="help-circle-outline" size={24} color={theme.text} />
          </TouchableOpacity>
        </View>

        {/* Balance Card */}
        <View style={[styles.balanceCard, { backgroundColor: theme.primary }]}>
          <View style={styles.balanceHeader}>
            <ThemedText style={[styles.balanceLabel, { color: '#111' + 'B3' }]}>
              Net Earnings (95%)
            </ThemedText>
            <View style={[styles.iconContainer, { backgroundColor: '#111' }]}>
              <Ionicons name="cube-outline" size={16} color={theme.primary} />
            </View>
          </View>
          <ThemedText style={[styles.balanceAmount, { color: '#111' }]}>
            ₱{(earnings?.totalEarnings || 0).toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </ThemedText>
          <View style={styles.balanceTrend}>
            <Ionicons name="trending-up" size={16} color="#111" />
            <ThemedText style={[styles.trendText, { color: '#111' + 'CC' }]}>
              +12% vs last {period.toLowerCase()}
            </ThemedText>
          </View>
          <ThemedText style={{ color: '#111' + '99', fontSize: 12, marginTop: 4 }}>
            5% Platform Commission deducted
          </ThemedText>
          <View style={styles.balanceActions}>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: '#111' }]}
              onPress={() => router.push('/wallet')}>
              <Ionicons name="cash-outline" size={20} color={theme.primary} />
              <ThemedText style={[styles.actionButtonText, { color: theme.primary }]}>
                Withdraw
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: '#fff' + '4D', borderColor: '#111' + '1A' }]}
              onPress={() => router.push('/history')}>
              <Ionicons name="time-outline" size={20} color="#111" />
              <ThemedText style={[styles.actionButtonText, { color: '#111' }]}>History</ThemedText>
            </TouchableOpacity>
          </View>
        </View>

        {/* Period Selector */}
        <View style={styles.periodSection}>
          <ThemedText type="subtitle" style={[styles.sectionTitle, { color: theme.text }]}>
            {period} Overview
          </ThemedText>
          <View style={[styles.periodSelector, { backgroundColor: theme.border }]}>
            {periods.map((p) => (
              <TouchableOpacity
                key={p}
                style={[
                  styles.periodButton,
                  period === p && { backgroundColor: theme.surface },
                ]}
                onPress={() => setPeriod(p)}>
                <ThemedText
                  style={[
                    styles.periodButtonText,
                    { color: period === p ? theme.text : theme.textSecondary },
                  ]}>
                  {p}
                </ThemedText>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Chart */}
        {earnings?.dailyBreakdown && earnings.dailyBreakdown.length > 0 && (
          <View style={[styles.chartCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.chartContainer}>
              {earnings.dailyBreakdown.map((day, index) => {
                const height = maxEarning > 0 ? (day.earnings / maxEarning) * 100 : 0;
                const isToday = index === earnings.dailyBreakdown.length - 1;
                return (
                  <View key={index} style={styles.chartBar}>
                    <View
                      style={[
                        styles.bar,
                        {
                          height: `${Math.max(height, 10)}%`,
                          backgroundColor: isToday ? theme.primary : theme.primary + '66',
                        },
                      ]}
                    />
                    <ThemedText
                      style={[
                        styles.chartLabel,
                        { color: isToday ? theme.text : theme.textSecondary },
                      ]}>
                      {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' })}
                    </ThemedText>
                  </View>
                );
              })}
            </View>
            <View style={[styles.chartFooter, { borderTopColor: theme.border }]}>
              <View>
                <ThemedText style={[styles.chartFooterLabel, { color: theme.textSecondary }]}>
                  Total Trips
                </ThemedText>
                <ThemedText style={[styles.chartFooterValue, { color: theme.text }]}>
                  {earnings.trips}
                </ThemedText>
              </View>
              <View style={styles.chartFooterRight}>
                <ThemedText style={[styles.chartFooterLabel, { color: theme.textSecondary }]}>
                  Online Hours
                </ThemedText>
                <ThemedText style={[styles.chartFooterValue, { color: theme.text }]}>
                  {Math.floor(earnings.onlineHours)}h {Math.round((earnings.onlineHours % 1) * 60)}m
                </ThemedText>
              </View>
            </View>
          </View>
        )}

        {/* Earnings breakdown (5% platform fee) */}
        <View style={styles.periodSection}>
          <ThemedText type="subtitle" style={[styles.sectionTitle, { color: theme.text }]}>
            Earnings breakdown (5% platform fee)
          </ThemedText>
          <ThemedText style={[styles.breakdownSubtext, { color: theme.textSecondary }]}>
            Fare, platform fee, and your net per trip
          </ThemedText>
        </View>
        {earningsHistory && earningsHistory.items.length > 0 ? (
          <View style={[styles.breakdownCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            {earningsHistory.items.slice(0, 10).map((item, index) => (
              <View key={`${item.bookingId}-${index}`} style={[styles.breakdownRow, { borderTopColor: theme.border }]}>
                <View style={styles.breakdownRowLeft}>
                  <ThemedText style={[styles.breakdownDate, { color: theme.textSecondary }]}>
                    {new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </ThemedText>
                  <ThemedText style={[styles.breakdownMethod, { color: theme.text }]}>
                    {item.paymentMethod}
                  </ThemedText>
                </View>
                <View style={styles.breakdownRowRight}>
                  <ThemedText style={[styles.breakdownFare, { color: theme.textSecondary }]}>
                    Fare ₱{item.grossAmount.toFixed(2)}
                  </ThemedText>
                  <ThemedText style={[styles.breakdownFee, { color: theme.textSecondary }]}>
                    Platform ({item.platformFeePercent}%) ₱{item.platformFeeAmount.toFixed(2)}
                  </ThemedText>
                  <ThemedText style={[styles.breakdownNet, { color: theme.primary }]}>
                    Net ₱{item.netAmount.toFixed(2)}
                  </ThemedText>
                </View>
              </View>
            ))}
            <View style={[styles.breakdownTotals, { borderTopColor: theme.border }]}>
              <ThemedText style={[styles.breakdownTotalsLabel, { color: theme.text }]}>Totals</ThemedText>
              <ThemedText style={[styles.breakdownTotalsValue, { color: theme.text }]}>
                Gross ₱{earningsHistory.totalGross.toFixed(2)} · Fee ₱{earningsHistory.totalPlatformFee.toFixed(2)} · Net ₱{earningsHistory.totalNet.toFixed(2)}
              </ThemedText>
            </View>
          </View>
        ) : !historyLoading ? (
          <View style={[styles.emptyBreakdown, { backgroundColor: theme.surface }]}>
            <ThemedText style={[styles.emptyBreakdownText, { color: theme.textSecondary }]}>
              No earnings history yet. Complete trips to see breakdown.
            </ThemedText>
          </View>
        ) : null}

        {/* Recent Trips */}
        <View style={styles.recentSection}>
          <View style={styles.recentHeader}>
            <ThemedText type="subtitle" style={[styles.sectionTitle, { color: theme.text }]}>
              Recent Trips
            </ThemedText>
            <TouchableOpacity onPress={() => router.push('/history')}>
              <ThemedText style={[styles.seeAllText, { color: theme.primary }]}>See All</ThemedText>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  balanceCard: {
    marginHorizontal: 24,
    marginBottom: 32,
    padding: 24,
    borderRadius: 16,
    gap: 12,
  },
  balanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  balanceLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  balanceAmount: {
    fontSize: 36,
    fontWeight: '700',
  },
  balanceTrend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  trendText: {
    fontSize: 14,
    fontWeight: '500',
  },
  balanceActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  periodSection: {
    paddingHorizontal: 24,
    marginBottom: 24,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  periodSelector: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 8,
    gap: 4,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  periodButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  chartCard: {
    marginHorizontal: 24,
    marginBottom: 24,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
  },
  chartContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 128,
    gap: 8,
    marginBottom: 16,
  },
  chartBar: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
  },
  bar: {
    width: '100%',
    borderRadius: 4,
    minHeight: 8,
  },
  chartLabel: {
    fontSize: 10,
    fontWeight: '500',
  },
  chartFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 16,
    borderTopWidth: 1,
  },
  chartFooterRight: {
    alignItems: 'flex-end',
  },
  chartFooterLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  chartFooterValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  breakdownSubtext: {
    fontSize: 12,
    marginTop: 4,
  },
  breakdownCard: {
    marginHorizontal: 24,
    marginBottom: 24,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
  },
  breakdownRowLeft: {
    gap: 2,
  },
  breakdownRowRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  breakdownDate: {
    fontSize: 12,
  },
  breakdownMethod: {
    fontSize: 14,
    fontWeight: '600',
  },
  breakdownFare: {
    fontSize: 11,
  },
  breakdownFee: {
    fontSize: 11,
  },
  breakdownNet: {
    fontSize: 14,
    fontWeight: '700',
  },
  breakdownTotals: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopWidth: 2,
  },
  breakdownTotalsLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  breakdownTotalsValue: {
    fontSize: 12,
    fontWeight: '600',
  },
  emptyBreakdown: {
    marginHorizontal: 24,
    marginBottom: 24,
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
  },
  emptyBreakdownText: {
    fontSize: 14,
  },
  recentSection: {
    paddingHorizontal: 24,
  },
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

