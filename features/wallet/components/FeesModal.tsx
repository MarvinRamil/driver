import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Modal, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/shared/hooks/use-theme';
import { ThemedText } from '@/shared/components/themed-text';
import { ThemedView } from '@/shared/components/themed-view';
import { useCashBond } from '../hooks/useCashBond';
import { useInsurance } from '@/features/insurance/hooks/useInsurance';
import type { InsuranceQr } from '@/features/insurance/types';
import type { CashBondQr } from '../types';

interface Props {
  visible: boolean;
  onClose: () => void;
}

type FeeTab = 'cashbond' | 'insurance';
/** Where the driver is in the insurance pay flow — mirrors the cashbond flow exactly: amount due, then QR. */
type InsuranceStep = 'history' | 'qr';

const peso = (value: number) =>
  `₱${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatDate = (date: Date | null) => (date ? date.toLocaleDateString() : '—');

/**
 * The driver's fees: cashbond and package insurance, in one sheet with a tab switch between them.
 *
 * Both tabs are real, backend-backed flows now (cashbond: issue #103, package insurance: issue
 * #104) — same claim-before-send QR payment mechanics on both, since insurance was built to
 * mirror cashbond's flow exactly. Package insurance differs in one respect: it's a recurring
 * annual premium, not a one-time deposit, so its status is paid-through-year + coverage dates
 * rather than a simple paid/unpaid boolean.
 */
export function FeesModal({ visible, onClose }: Props) {
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState<FeeTab>('cashbond');

  const cashBond = useCashBond();
  const [cashBondQr, setCashBondQr] = useState<CashBondQr | null>(null);
  const [cashBondQrError, setCashBondQrError] = useState<string | null>(null);

  const insurance = useInsurance();
  const [insuranceStep, setInsuranceStep] = useState<InsuranceStep>('history');
  const [insuranceQr, setInsuranceQr] = useState<InsuranceQr | null>(null);
  const [insuranceQrError, setInsuranceQrError] = useState<string | null>(null);

  // Reset everything transient on close so reopening never shows a stale QR or a leftover step —
  // an expired code that still looks live is worse than none.
  useEffect(() => {
    if (!visible) {
      setActiveTab('cashbond');
      setCashBondQr(null);
      setCashBondQrError(null);
      setInsuranceStep('history');
      setInsuranceQr(null);
      setInsuranceQrError(null);
    }
  }, [visible]);

  // Cashbond QR: the webhook settles on PayMongo's schedule, so poll while the code is on screen.
  useEffect(() => {
    if (!visible || activeTab !== 'cashbond' || !cashBondQr) return;
    const timer = setInterval(() => void cashBond.refresh({ silent: true }), 4000);
    return () => clearInterval(timer);
  }, [visible, activeTab, cashBondQr, cashBond.refresh]);

  useEffect(() => {
    if (cashBond.data?.paid) setCashBondQr(null);
  }, [cashBond.data?.paid]);

  // Same webhook-settlement reasoning as cashbond's poll above.
  useEffect(() => {
    if (!visible || activeTab !== 'insurance' || !insuranceQr) return;
    const timer = setInterval(() => void insurance.refresh({ silent: true }), 4000);
    return () => clearInterval(timer);
  }, [visible, activeTab, insuranceQr, insurance.refresh]);

  // Clears once the year THIS QR targets is actually covered — not just on any "Active" status,
  // since a driver renewing year 2 is already Active from year 1 while that QR is still live.
  useEffect(() => {
    if (insuranceQr && (insurance.data?.paidThroughYearNumber ?? 0) >= insuranceQr.policyYearNumber) {
      setInsuranceStep('history');
      setInsuranceQr(null);
    }
  }, [insurance.data?.paidThroughYearNumber, insuranceQr]);

  const handleShowCashBondQr = useCallback(async () => {
    setCashBondQrError(null);
    try {
      setCashBondQr(await cashBond.createQr());
    } catch (err) {
      setCashBondQrError(err instanceof Error ? err.message : 'Could not create your cashbond QR');
    }
  }, [cashBond]);

  const handleShowInsuranceQr = useCallback(async () => {
    setInsuranceQrError(null);
    try {
      setInsuranceQr(await insurance.createQr());
      setInsuranceStep('qr');
    } catch (err) {
      setInsuranceQrError(err instanceof Error ? err.message : 'Could not create your package-insurance payment QR');
    }
  }, [insurance]);

  const renderCashBondTab = () => {
    if (cashBond.isLoading && !cashBond.data) {
      return <ActivityIndicator style={{ marginVertical: 32 }} color={theme.primary} />;
    }
    if (cashBond.data?.paid) {
      return (
        <View style={styles.body}>
          <Ionicons name="checkmark-circle" size={48} color={theme.success} />
          <ThemedText style={[styles.title, { color: theme.text }]}>Cashbond paid</ThemedText>
          <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
            {peso(cashBond.data.cashBondBalance)} is held as refundable collateral.
          </ThemedText>
        </View>
      );
    }
    if (cashBond.data?.amountDue == null) {
      return (
        <View style={styles.body}>
          <Ionicons name="information-circle-outline" size={40} color={theme.textSecondary} />
          <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
            No cashbond is set for your vehicle type yet. Nothing to pay right now.
          </ThemedText>
        </View>
      );
    }
    if (cashBondQr) {
      return (
        <View style={styles.body}>
          <ThemedText style={[styles.title, { color: theme.text }]}>{peso(cashBondQr.amount)}</ThemedText>
          <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
            Scan with GCash, Maya, or your bank app.
          </ThemedText>
          <Image
            source={{ uri: cashBondQr.qrImage }}
            style={styles.qr}
            resizeMode="contain"
            accessibilityLabel="Cashbond QR code"
          />
          <ThemedText style={[styles.note, { color: theme.textSecondary }]}>
            This pays Bee directly and is held as refundable collateral — it does not go into
            your BeeWallet balance.
          </ThemedText>
          <ThemedText style={[styles.note, { color: theme.textSecondary }]}>
            This screen updates on its own once your payment lands.
          </ThemedText>
        </View>
      );
    }
    return (
      <View style={styles.body}>
        <ThemedText style={[styles.title, { color: theme.text }]}>
          {peso(cashBond.data?.amountDue ?? 0)}
        </ThemedText>
        <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
          Due before you can be offered bookings. Refundable when you leave.
        </ThemedText>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.primary }]}
          disabled={cashBond.isCreatingQr}
          onPress={handleShowCashBondQr}>
          {cashBond.isCreatingQr ? (
            <ActivityIndicator color="#111" />
          ) : (
            <ThemedText style={styles.buttonText}>Show payment QR</ThemedText>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  const renderInsuranceHistory = () => {
    const policy = insurance.data;
    const nextYear = (policy?.paidThroughYearNumber ?? 0) + 1;

    return (
      <View style={styles.body}>
        {policy?.status === 'Lapsed' ? (
          <View style={[styles.noticeCard, { backgroundColor: theme.error + '15', borderColor: theme.error }]}>
            <Ionicons name="alert-circle-outline" size={18} color={theme.error} />
            <ThemedText style={[styles.noticeText, { color: theme.error }]}>
              Your package-insurance coverage lapsed on {formatDate(policy.coverageEndDate)}. Pay
              below to renew.
            </ThemedText>
          </View>
        ) : null}

        <View style={[styles.policyCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.policyRow}>
            <ThemedText style={[styles.policyLabel, { color: theme.textSecondary }]}>Vehicle type</ThemedText>
            <ThemedText style={[styles.policyValue, { color: theme.text }]}>
              {policy?.vehicleType ?? '—'}
            </ThemedText>
          </View>
          <View style={styles.policyRow}>
            <ThemedText style={[styles.policyLabel, { color: theme.textSecondary }]}>Status</ThemedText>
            <ThemedText style={[styles.policyValue, { color: theme.text }]}>
              {policy?.status ?? 'NotEnrolled'}
            </ThemedText>
          </View>
          <View style={styles.policyRow}>
            <ThemedText style={[styles.policyLabel, { color: theme.textSecondary }]}>Paid through</ThemedText>
            <ThemedText style={[styles.policyValue, { color: theme.text }]}>
              {policy && policy.paidThroughYearNumber > 0 ? `Year ${policy.paidThroughYearNumber}` : 'Not paid yet'}
            </ThemedText>
          </View>
          {policy?.coverageStartDate ? (
            <View style={styles.policyRow}>
              <ThemedText style={[styles.policyLabel, { color: theme.textSecondary }]}>Coverage</ThemedText>
              <ThemedText style={[styles.policyValue, { color: theme.text }]}>
                {formatDate(policy.coverageStartDate)} – {formatDate(policy.coverageEndDate)}
              </ThemedText>
            </View>
          ) : null}
        </View>

        <ThemedText style={[styles.historyHeading, { color: theme.text }]}>Payment history</ThemedText>
        {insurance.history.length === 0 ? (
          <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
            No package-insurance payments on file yet.
          </ThemedText>
        ) : (
          <View style={{ width: '100%', gap: 8 }}>
            {insurance.history.map((item) => (
              <View
                key={item.id}
                style={[styles.historyRow, { backgroundColor: theme.surface, borderColor: theme.border }]}
              >
                <View>
                  <ThemedText style={[styles.policyValue, { color: theme.text }]}>{peso(item.amount)}</ThemedText>
                  <ThemedText style={[styles.note, { color: theme.textSecondary, textAlign: 'left' }]}>
                    {item.paidAt.toLocaleDateString()}
                  </ThemedText>
                </View>
                <ThemedText
                  style={{
                    color: item.status === 'Completed' ? theme.success : item.status === 'Failed' ? theme.error : theme.primary,
                    fontWeight: '600',
                    fontSize: 12,
                  }}
                >
                  {item.status}
                </ThemedText>
              </View>
            ))}
          </View>
        )}

        {policy?.amountDue == null ? (
          <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
            No package-insurance rate is set for your vehicle type yet. Nothing to pay right now.
          </ThemedText>
        ) : (
          <TouchableOpacity
            style={[styles.button, { backgroundColor: theme.primary, marginTop: 8 }]}
            disabled={insurance.isCreatingQr}
            onPress={handleShowInsuranceQr}>
            {insurance.isCreatingQr ? (
              <ActivityIndicator color="#111" />
            ) : (
              <ThemedText style={styles.buttonText}>
                Pay {peso(policy.amountDue)} for Year {nextYear}
              </ThemedText>
            )}
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderInsuranceQr = () => (
    <View style={styles.body}>
      <ThemedText style={[styles.title, { color: theme.text }]}>
        {peso(insuranceQr?.amount ?? insurance.data?.amountDue ?? 0)}
      </ThemedText>
      <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
        Year {insuranceQr?.policyYearNumber} · Scan with GCash, Maya, or your bank app.
      </ThemedText>
      {insuranceQr?.qrImage ? (
        <Image
          source={{ uri: insuranceQr.qrImage }}
          style={styles.qr}
          resizeMode="contain"
          accessibilityLabel="Package-insurance payment QR code"
        />
      ) : (
        <View style={[styles.qr, styles.qrPlaceholder, { borderColor: theme.border }]}>
          <Ionicons name="qr-code-outline" size={64} color={theme.textSecondary} />
        </View>
      )}
      <ThemedText style={[styles.note, { color: theme.textSecondary }]}>
        This pays your package-insurance premium into Bee's platform account, the same as your
        cashbond payment.
      </ThemedText>
      <ThemedText style={[styles.note, { color: theme.textSecondary }]}>
        This screen updates on its own once your payment lands.
      </ThemedText>
      <TouchableOpacity onPress={() => setInsuranceStep('history')} hitSlop={8}>
        <ThemedText style={{ color: theme.textSecondary, marginTop: 8 }}>Back</ThemedText>
      </TouchableOpacity>
    </View>
  );

  const renderInsuranceTab = () => {
    if (insurance.isLoading && !insurance.data) {
      return <ActivityIndicator style={{ marginVertical: 32 }} color={theme.primary} />;
    }
    if (insuranceStep === 'qr') return renderInsuranceQr();
    return renderInsuranceHistory();
  };

  const currentError =
    activeTab === 'cashbond' ? cashBondQrError ?? cashBond.error : insuranceQrError ?? insurance.error;

  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <ThemedView style={[styles.sheet, { backgroundColor: theme.background, paddingTop: insets.top + 12 }]}>
        <View style={styles.header}>
          <ThemedText type="subtitle" style={{ color: theme.text }}>
            Fees
          </ThemedText>
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={24} color={theme.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.tabs}>
          <TouchableOpacity
            onPress={() => setActiveTab('cashbond')}
            style={[
              styles.tab,
              {
                backgroundColor: activeTab === 'cashbond' ? theme.primary : theme.surface,
                borderColor: theme.border,
              },
            ]}
          >
            <ThemedText style={{ color: activeTab === 'cashbond' ? '#111' : theme.text, fontWeight: '600' }}>
              Cashbond
            </ThemedText>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setActiveTab('insurance')}
            style={[
              styles.tab,
              {
                backgroundColor: activeTab === 'insurance' ? theme.primary : theme.surface,
                borderColor: theme.border,
              },
            ]}
          >
            <ThemedText style={{ color: activeTab === 'insurance' ? '#111' : theme.text, fontWeight: '600' }}>
              Insurance
            </ThemedText>
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
        >
          {activeTab === 'cashbond' ? renderCashBondTab() : renderInsuranceTab()}

          {currentError ? (
            <ThemedText style={[styles.error, { color: theme.error }]}>{currentError}</ThemedText>
          ) : null}
        </ScrollView>
      </ThemedView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1, padding: 20 },
  scrollContent: { flexGrow: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  tabs: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, alignItems: 'center' },
  body: { alignItems: 'center', paddingVertical: 16, gap: 8, width: '100%' },
  title: { fontSize: 28, fontWeight: '700' },
  subtitle: { fontSize: 14, textAlign: 'center', paddingHorizontal: 16 },
  note: { fontSize: 12, textAlign: 'center', paddingHorizontal: 16 },
  qr: { width: 240, height: 240, marginVertical: 12 },
  qrPlaceholder: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  button: { marginTop: 16, paddingVertical: 14, paddingHorizontal: 32, borderRadius: 12, minWidth: 220, alignItems: 'center' },
  buttonText: { color: '#111', fontWeight: '600', fontSize: 15 },
  error: { fontSize: 13, textAlign: 'center', marginTop: 12 },
  noticeCard: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 10, borderWidth: 1, width: '100%' },
  noticeText: { fontSize: 12, flex: 1 },
  policyCard: { width: '100%', borderRadius: 12, borderWidth: 1, padding: 14, gap: 8 },
  policyRow: { flexDirection: 'row', justifyContent: 'space-between' },
  policyLabel: { fontSize: 13 },
  policyValue: { fontSize: 14, fontWeight: '600' },
  historyHeading: { fontSize: 14, fontWeight: '600', alignSelf: 'flex-start', marginTop: 4 },
  historyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderRadius: 10, borderWidth: 1 },
});
