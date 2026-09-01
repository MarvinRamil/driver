import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Modal, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/shared/hooks/use-theme';
import { ThemedText } from '@/shared/components/themed-text';
import { ThemedView } from '@/shared/components/themed-view';
import { useCashBond } from '../hooks/useCashBond';
import type { CashBondQr } from '../types';

interface Props {
  visible: boolean;
  onClose: () => void;
}

/**
 * The driver's cashbond: what's due, and the QR that pays it.
 *
 * <Image> rather than a QR component — the payload is rendered to a PNG server-side, so this ships
 * as a JavaScript-only update with no native dependency, the same choice BeeWalletTopUpQrModal made.
 *
 * The QR credits the **platform** wallet, not the driver's own. That is deliberate and worth being
 * explicit about on screen: drivers reasonably want to know where their money is going, and the
 * cashbond genuinely is money we hold rather than money they keep. It is also why this is not a
 * BeeWallet top-up — the cashbond falls due before BeeWallet onboarding exists, so there is no
 * driver wallet to pay from.
 */
export function CashBondModal({ visible, onClose }: Props) {
  const theme = useTheme();
  const { data, isLoading, isCreatingQr, error, refresh, createQr } = useCashBond();
  const [qr, setQr] = useState<CashBondQr | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);

  // Cleared on close so reopening never shows a stale code — an expired QR that still looks live
  // is worse than none, because the driver scans it and nothing happens.
  useEffect(() => {
    if (!visible) {
      setQr(null);
      setQrError(null);
    }
  }, [visible]);

  // The webhook settles the payment on PayMongo's schedule, not ours, so the sheet re-checks while
  // it is open rather than waiting for the driver to reopen it.
  useEffect(() => {
    if (!visible || !qr) return;

    const timer = setInterval(() => void refresh({ silent: true }), 4000);
    return () => clearInterval(timer);
  }, [visible, qr, refresh]);

  // Once it lands there is nothing left to scan.
  useEffect(() => {
    if (data?.paid) setQr(null);
  }, [data?.paid]);

  const handleShowQr = useCallback(async () => {
    setQrError(null);
    try {
      setQr(await createQr());
    } catch (err) {
      setQrError(err instanceof Error ? err.message : 'Could not create your cashbond QR');
    }
  }, [createQr]);

  const peso = (value: number) =>
    `₱${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <ThemedView style={[styles.sheet, { backgroundColor: theme.background }]}>
          <View style={styles.header}>
            <ThemedText type="subtitle" style={{ color: theme.text }}>
              Cashbond
            </ThemedText>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>

          {isLoading && !data ? (
            <ActivityIndicator style={{ marginVertical: 32 }} color={theme.primary} />
          ) : data?.paid ? (
            <View style={styles.body}>
              <Ionicons name="checkmark-circle" size={48} color={theme.success} />
              <ThemedText style={[styles.title, { color: theme.text }]}>Cashbond paid</ThemedText>
              <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
                {peso(data.cashBondBalance)} is held as refundable collateral.
              </ThemedText>
            </View>
          ) : data?.amountDue == null ? (
            // No rate configured for this vehicle type. Nothing the driver can do about it, so say
            // so plainly rather than showing a pay button that cannot work.
            <View style={styles.body}>
              <Ionicons name="information-circle-outline" size={40} color={theme.textSecondary} />
              <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
                No cashbond is set for your vehicle type yet. Nothing to pay right now.
              </ThemedText>
            </View>
          ) : qr ? (
            <View style={styles.body}>
              <ThemedText style={[styles.title, { color: theme.text }]}>{peso(qr.amount)}</ThemedText>
              <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
                Scan with GCash, Maya, or your bank app.
              </ThemedText>
              <Image
                source={{ uri: qr.qrImage }}
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
          ) : (
            <View style={styles.body}>
              <ThemedText style={[styles.title, { color: theme.text }]}>
                {peso(data?.amountDue ?? 0)}
              </ThemedText>
              <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
                Due before you can be offered bookings. Refundable when you leave.
              </ThemedText>
              <TouchableOpacity
                style={[styles.button, { backgroundColor: theme.primary }]}
                disabled={isCreatingQr}
                onPress={handleShowQr}>
                {isCreatingQr ? (
                  <ActivityIndicator color="#111" />
                ) : (
                  <ThemedText style={styles.buttonText}>Show payment QR</ThemedText>
                )}
              </TouchableOpacity>
            </View>
          )}

          {(qrError || error) && (
            <ThemedText style={[styles.error, { color: theme.error }]}>{qrError ?? error}</ThemedText>
          )}
        </ThemedView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 36 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  body: { alignItems: 'center', paddingVertical: 16, gap: 8 },
  title: { fontSize: 28, fontWeight: '700' },
  subtitle: { fontSize: 14, textAlign: 'center', paddingHorizontal: 16 },
  note: { fontSize: 12, textAlign: 'center', paddingHorizontal: 16 },
  qr: { width: 240, height: 240, marginVertical: 12 },
  button: { marginTop: 16, paddingVertical: 14, paddingHorizontal: 32, borderRadius: 12, minWidth: 220, alignItems: 'center' },
  buttonText: { color: '#111', fontWeight: '600', fontSize: 15 },
  error: { fontSize: 13, textAlign: 'center', marginTop: 12 },
});
