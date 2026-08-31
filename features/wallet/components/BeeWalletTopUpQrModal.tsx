import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/shared/hooks/use-theme';
import { ThemedText } from '@/shared/components/themed-text';
import { ThemedView } from '@/shared/components/themed-view';
import { useBeeWalletTopUpQr } from '../hooks/useBeeWalletTopUpQr';
import { canSaveQrImage, saveQrImage } from '../lib/saveQrImage';

interface Props {
  visible: boolean;
  onClose: () => void;
}

/**
 * The QR a driver scans to put money into their own BeeWallet wallet.
 *
 * <Image> rather than a QR component: the payload is rendered to a PNG server-side, so the app
 * needs no native QR dependency and this ships as a JavaScript-only update.
 *
 * No copy-to-clipboard button: expo-clipboard is not installed, and pulling in a native module
 * for a convenience would force the rebuild this whole approach was chosen to avoid.
 *
 * The merchant name is shown deliberately. Before this existed, topping up produced a checkout
 * whose QR read the platform's name — drivers reasonably asked why they were paying us. Showing
 * whose wallet the code credits answers that up front.
 *
 * Saving is the one thing here that needs native code (expo-sharing / expo-file-system), so the
 * button is shown only once those modules answer for themselves. On a binary built before they
 * were added — which happens routinely, since JS ships over expo-updates ahead of new builds —
 * the button is simply absent rather than throwing.
 */
export function BeeWalletTopUpQrModal({ visible, onClose }: Props) {
  const theme = useTheme();
  const { data, isLoading, error, load } = useBeeWalletTopUpQr();
  const [canSave, setCanSave] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (visible) load();
  }, [visible, load]);

  useEffect(() => {
    let active = true;
    canSaveQrImage().then((ok) => {
      // The modal can close while this resolves; setting state on the way out warns in dev and
      // does nothing useful.
      if (active) setCanSave(ok);
    });
    return () => {
      active = false;
    };
  }, []);

  const onSave = useCallback(async () => {
    if (!data?.qrImage || isSaving) return;
    setIsSaving(true);
    const result = await saveQrImage(data.qrImage);
    setIsSaving(false);
    if (!result.ok) Alert.alert('Could not save QR', result.reason);
  }, [data?.qrImage, isSaving]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <ThemedView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.close}>
            <Ionicons name="close" size={24} color={theme.text} />
          </TouchableOpacity>
          <ThemedText style={styles.title}>Add to BeeWallet</ThemedText>
          <View style={styles.close} />
        </View>

        <View style={styles.body}>
          {isLoading ? (
            <ActivityIndicator size="large" color={theme.primary} />
          ) : error ? (
            <View style={styles.center}>
              <Ionicons name="alert-circle-outline" size={36} color={theme.error} />
              <ThemedText style={[styles.error, { color: theme.error }]}>{error}</ThemedText>
              <TouchableOpacity onPress={load} style={[styles.retry, { borderColor: theme.border }]}>
                <ThemedText style={{ color: theme.primary }}>Try again</ThemedText>
              </TouchableOpacity>
            </View>
          ) : data ? (
            <>
              <ThemedText style={[styles.instruction, { color: theme.textSecondary }]}>
                Scan with GCash, Maya or your bank app to add money to your BeeWallet wallet.
              </ThemedText>

              <View style={styles.qrFrame}>
                <Image source={{ uri: data.qrImage }} style={styles.qr} resizeMode="contain" />
              </View>

              {data.merchantName ? (
                <ThemedText style={[styles.merchant, { color: theme.text }]}>
                  {data.merchantName.trim()}
                </ThemedText>
              ) : null}
              {data.accountNumber ? (
                <ThemedText style={[styles.account, { color: theme.textSecondary }]}>
                  ••••{data.accountNumber.slice(-4)}
                </ThemedText>
              ) : null}

              <ThemedText style={[styles.note, { color: theme.textSecondary }]}>
                Money arrives in your wallet straight away.
              </ThemedText>

              {canSave ? (
                <TouchableOpacity
                  onPress={onSave}
                  disabled={isSaving}
                  style={[styles.saveButton, { borderColor: theme.border, opacity: isSaving ? 0.6 : 1 }]}
                >
                  {isSaving ? (
                    <ActivityIndicator size="small" color={theme.primary} />
                  ) : (
                    <Ionicons name="download-outline" size={18} color={theme.primary} />
                  )}
                  <ThemedText style={{ color: theme.primary, fontWeight: '600' }}>
                    Save or share QR
                  </ThemedText>
                </TouchableOpacity>
              ) : null}
            </>
          ) : null}
        </View>
      </ThemedView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingTop: 52, paddingBottom: 12,
  },
  close: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 17, fontWeight: '600' },
  body: { flex: 1, alignItems: 'center', paddingHorizontal: 24, gap: 14 },
  center: { alignItems: 'center', gap: 12, marginTop: 40 },
  instruction: { fontSize: 14, textAlign: 'center', lineHeight: 20, marginTop: 8 },
  qrFrame: { backgroundColor: '#fff', padding: 16, borderRadius: 16 },
  qr: { width: 240, height: 240 },
  merchant: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  account: { fontSize: 13 },
  note: { fontSize: 12, textAlign: 'center' },
  error: { fontSize: 14, textAlign: 'center' },
  retry: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8 },
  saveButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12, marginTop: 4,
  },
});
