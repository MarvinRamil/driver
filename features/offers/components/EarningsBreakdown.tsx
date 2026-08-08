import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/shared/components/themed-text';
import { useTheme } from '@/shared/hooks/use-theme';
import type { OfferEarningDetails } from '../types';
import { formatPeso, formatRatePercent } from '../utils/money';

interface EarningsBreakdownProps {
  /** Server-computed breakdown. Callers handle the null case themselves. */
  details: OfferEarningDetails;
  /**
   * 'full' — every row, for the details modal.
   * 'compact' — headline net plus the cash warning, for the push-notification accept screen
   * where the driver can swipe to accept without scrolling.
   */
  variant?: 'full' | 'compact';
}

/**
 * What the driver takes home from an offer, shown before they accept.
 *
 * Every amount is rendered exactly as the server sent it. Nothing here recalculates the
 * split: the backend derives it from one shared formula so the number quoted before
 * accepting is the number paid after completing, and a second formula in the client would
 * quietly break that guarantee.
 *
 * Shared by the details modal and the accept screen so the two cannot drift apart.
 */
export function EarningsBreakdown({ details, variant = 'full' }: EarningsBreakdownProps) {
  const theme = useTheme();
  const cash = details.cashSettlement;

  // Wording mirrors the earnings history screen (Fare / Platform (%) / Net) so the estimate
  // reads like the settled record the driver already knows.
  const cashNotice = cash ? (
    <View style={[styles.notice, { backgroundColor: theme.warning + '15', borderColor: theme.warning + '40' }]}>
      <Ionicons name="wallet-outline" size={16} color={theme.warning} />
      {/* Nested spans are plain Text, not ThemedText: ThemedText always applies its own
          fontSize/lineHeight, which would blow the emphasised amounts up to 16px inside
          13px copy. A bare Text inherits the parent's size and colour. */}
      <ThemedText style={[styles.noticeText, { color: theme.text }]}>
        You collect <Text style={styles.noticeStrong}>{formatPeso(cash.collectedFromCustomer)}</Text> in
        cash. <Text style={styles.noticeStrong}>{formatPeso(cash.owedToPlatform)}</Text> will be deducted
        from your top-up wallet.
      </ThemedText>
    </View>
  ) : null;

  if (variant === 'compact') {
    return (
      <View style={styles.compact}>
        <ThemedText style={[styles.compactNet, { color: theme.primary }]}>
          {formatPeso(details.totalNetEarnings)}
        </ThemedText>
        <ThemedText style={[styles.compactSub, { color: theme.textSecondary }]}>
          You earn{details.isEstimate ? ' (estimated)' : ''} · Fare {formatPeso(details.baseEarnings)}
        </ThemedText>
        {cashNotice}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.row, { borderBottomColor: theme.border }]}>
        <ThemedText style={[styles.label, { color: theme.textSecondary }]}>Fare</ThemedText>
        <ThemedText style={[styles.value, { color: theme.text }]}>
          {formatPeso(details.baseEarnings)}
        </ThemedText>
      </View>

      {/* Rendered from the array, not a hardcoded commission row, so a second deduction
          added server-side appears without an app release. */}
      {details.deductions.map((deduction, index) => (
        <View key={`${deduction.label}-${index}`} style={[styles.row, { borderBottomColor: theme.border }]}>
          <ThemedText style={[styles.label, { color: theme.textSecondary }]}>
            {deduction.label} ({formatRatePercent(deduction.ratePercent)})
          </ThemedText>
          <ThemedText style={[styles.value, { color: theme.textSecondary }]}>
            −{formatPeso(deduction.amount)}
          </ThemedText>
        </View>
      ))}

      <View style={[styles.row, styles.netRow, { borderBottomColor: theme.border }]}>
        <ThemedText style={[styles.netLabel, { color: theme.text }]}>You earn</ThemedText>
        <ThemedText style={[styles.netValue, { color: theme.primary }]}>
          {formatPeso(details.totalNetEarnings)}
        </ThemedText>
      </View>

      {details.isEstimate && (
        <ThemedText style={[styles.footnote, { color: theme.textSecondary }]}>
          Estimated from the current fare. The final amount can change.
        </ThemedText>
      )}

      {/* An unconfirmed method means no payment record existed yet. Cash bookings always have
          one by offer time, so this is effectively an assumed "Online" — say so rather than
          state the method flatly. */}
      {!details.paymentMethodConfirmed && (
        <ThemedText style={[styles.footnote, { color: theme.textSecondary }]}>
          Payment method not confirmed yet.
        </ThemedText>
      )}

      {cashNotice}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 4,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  label: {
    fontSize: 14,
    flexShrink: 1,
    paddingRight: 12,
  },
  value: {
    fontSize: 16,
    fontWeight: '600',
  },
  netRow: {
    paddingVertical: 14,
  },
  netLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  netValue: {
    fontSize: 22,
    fontWeight: '700',
  },
  footnote: {
    fontSize: 12,
    marginTop: 8,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  noticeText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },
  noticeStrong: {
    fontWeight: '700',
  },
  compact: {
    alignItems: 'center',
  },
  compactNet: {
    fontSize: 34,
    fontWeight: '700',
  },
  compactSub: {
    fontSize: 13,
    marginTop: 2,
    textAlign: 'center',
  },
});
