import React, { useEffect } from 'react';
import {
  ActivityIndicator,
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
import { useBeePayTopUpQr } from '../hooks/useBeePayTopUpQr';

interface Props {
  visible: boolean;
  onClose: () => void;
}

/**
 * The QR a driver scans to put money into their own BeePay wallet.
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
 */
export function BeePayTopUpQrModal({ visible, onClose }: Props) {
  const theme = useTheme();
  const { data, isLoading, error, load } = useBeePayTopUpQr();

  useEffect(() => {
    if (visible) load();
  }, [visible, load]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <ThemedView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.close}>
            <Ionicons name="close" size={24} color={theme.text} />
          </TouchableOpacity>
          <ThemedText style={styles.title}>Add to BeePay</ThemedText>
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
                Scan with GCash, Maya or your bank app to add money to your BeePay wallet.
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
});
