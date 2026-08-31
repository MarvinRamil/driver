import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/shared/hooks/use-theme';
import { ThemedText } from '@/shared/components/themed-text';
import { ThemedView } from '@/shared/components/themed-view';
import { useBeeWalletTopUpQr } from '../hooks/useBeeWalletTopUpQr';
import { useBeeWalletTopUpWatcher } from '../hooks/useBeeWalletTopUpWatcher';
import { canSaveQrImage, saveQrImage } from '../lib/saveQrImage';

interface Props {
  visible: boolean;
  onClose: () => void;
}

/** Offered as taps so the common top-ups need no typing. */
const QUICK_AMOUNTS = [200, 500, 1000];

type Step = 'amount' | 'qr';

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
  const { data, isLoading, error, load, reset } = useBeeWalletTopUpQr();
  const [canSave, setCanSave] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [step, setStep] = useState<Step>('amount');
  const [amountText, setAmountText] = useState('');
  // The amount the QR on screen was requested with, fixed at the moment the driver left the amount
  // step. Kept apart from the field so nothing the driver types afterwards can re-trigger the fetch
  // or relabel a code that was already generated.
  const [qrAmount, setQrAmount] = useState<number | null>(null);

  const amount = useMemo(() => {
    const parsed = Number(amountText.replace(/,/g, '').trim());
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }, [amountText]);

  const amountEntered = amountText.trim().length > 0;
  const amountInvalid = amountEntered && amount === null;

  // Only a QR with an amount fixed into it expires, so this is null for the reusable code and the
  // countdown below never runs for it.
  const expiresAt = data?.expiresAt ? data.expiresAt.getTime() : null;
  const [now, setNow] = useState(() => Date.now());
  const expired = expiresAt !== null && now >= expiresAt;
  const secondsLeft = expiresAt === null ? null : Math.max(0, Math.round((expiresAt - now) / 1000));

  // A second is the coarsest tick that still reads as a live countdown. It runs only while an
  // expiring code is actually on screen.
  useEffect(() => {
    if (expiresAt === null || !visible || step !== 'qr') return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [expiresAt, visible, step]);

  // The QR is fetched when the driver leaves the amount step, not when the modal opens: a top-up
  // that is abandoned at the amount screen should not have cost a call to PayMongo. The amount goes
  // with the request, so the backend can fix it into the code once it reads the parameter.
  useEffect(() => {
    if (visible && step === 'qr') load(qrAmount);
  }, [visible, step, qrAmount, load]);

  // Every way out of this modal clears it: the amount field, the requested amount and the fetched
  // code all go. A QR the driver walked away from without paying should not come back attached to
  // a figure they typed for a top-up they abandoned — the next open starts blank.
  //
  // Duplicated with close() rather than left to it because the parent can drop `visible` on its
  // own — a navigation away, say — and that path never calls close().
  useEffect(() => {
    if (!visible) {
      reset();
      setStep('amount');
      setAmountText('');
      setQrAmount(null);
    }
  }, [visible, reset]);

  // Closing clears the fetched QR, so reopening shows a spinner and a fresh code rather than
  // flashing the previous one. It also means a QR is never left on screen after the driver has
  // moved on.
  const close = useCallback(() => {
    reset();
    setStep('amount');
    setAmountText('');
    setQrAmount(null);
    onClose();
  }, [reset, onClose]);

  // Back to the amount step. The QR is dropped rather than kept: the driver is about to name a
  // different figure, and a stale code behind the form is the kind of thing that gets scanned.
  const editAmount = useCallback(() => {
    reset();
    setStep('amount');
  }, [reset]);

  const showQr = useCallback((requested: number | null) => {
    setQrAmount(requested);
    setStep('qr');
  }, []);

  // Nothing pushes this: PayMongo emits transaction events on the child account, so the SignalR
  // channel that carries checkout top-ups never fires for a QR paid into the driver's own wallet.
  // Polling the live balance while the QR is on screen is the only way to notice, and it is exactly
  // the moment worth paying for.
  //
  // Only while a payable QR is up — polling behind the amount form, or behind a code that has
  // expired, would spend calls on money that cannot arrive.
  useBeeWalletTopUpWatcher(visible && step === 'qr' && !expired, (received) => {
    Alert.alert('Top-up received', `₱${received.toFixed(2)} has been added to your BeeWallet.`);
    close();
  });

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
    <Modal visible={visible} animationType="slide" onRequestClose={close}>
      <ThemedView style={styles.container}>
        <View style={styles.header}>
          {step === 'qr' ? (
            <TouchableOpacity onPress={editAmount} style={styles.close}>
              <Ionicons name="chevron-back" size={24} color={theme.text} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={close} style={styles.close}>
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
          )}
          <ThemedText style={styles.title}>Add to BeeWallet</ThemedText>
          {step === 'qr' ? (
            <TouchableOpacity onPress={close} style={styles.close}>
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
          ) : (
            <View style={styles.close} />
          )}
        </View>

        {step === 'amount' ? (
          <View style={styles.body}>
            {/* The trade is stated up front because it is not guessable: naming an amount fixes it
                into the code so it cannot be mistyped, but that code then works only for that
                amount and only for half an hour. */}
            <ThemedText style={[styles.instruction, { color: theme.textSecondary }]}>
              How much are you adding? The amount is locked into the QR, so whoever scans it can't
              type a different one — but that code works for 30 minutes only. Skip it for your
              reusable code.
            </ThemedText>

            <View style={[styles.amountField, { borderColor: amountInvalid ? theme.error : theme.border }]}>
              <ThemedText style={[styles.peso, { color: theme.textSecondary }]}>₱</ThemedText>
              <TextInput
                value={amountText}
                onChangeText={setAmountText}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={theme.textMuted}
                style={[styles.amountInput, { color: theme.text }]}
                autoFocus
              />
            </View>

            {amountInvalid ? (
              <ThemedText style={[styles.error, { color: theme.error }]}>
                Enter an amount greater than zero, or skip it.
              </ThemedText>
            ) : null}

            <View style={styles.quickRow}>
              {QUICK_AMOUNTS.map((value) => (
                <TouchableOpacity
                  key={value}
                  onPress={() => setAmountText(String(value))}
                  style={[
                    styles.quickChip,
                    {
                      borderColor: amount === value ? theme.primary : theme.border,
                      backgroundColor: amount === value ? theme.primary : 'transparent',
                    },
                  ]}
                >
                  <ThemedText style={{ color: amount === value ? '#111' : theme.text, fontWeight: '600' }}>
                    ₱{value}
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              onPress={() => showQr(amount)}
              disabled={amountInvalid}
              style={[
                styles.primaryButton,
                { backgroundColor: theme.primary, opacity: amountInvalid ? 0.5 : 1 },
              ]}
            >
              <ThemedText style={{ color: '#111', fontWeight: '700' }}>Show QR code</ThemedText>
            </TouchableOpacity>

            {/* The whole step is optional: a driver who just wants their code should not have to
                invent a figure to get past this screen. */}
            <TouchableOpacity
              onPress={() => {
                setAmountText('');
                showQr(null);
              }}
              style={styles.skipButton}
            >
              <ThemedText style={{ color: theme.textSecondary }}>Skip — any amount</ThemedText>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.body}>
            {isLoading ? (
              <ActivityIndicator size="large" color={theme.primary} />
            ) : error ? (
              <View style={styles.center}>
                <Ionicons name="alert-circle-outline" size={36} color={theme.error} />
                <ThemedText style={[styles.error, { color: theme.error }]}>{error}</ThemedText>
                <TouchableOpacity
                  onPress={() => load(qrAmount)}
                  style={[styles.retry, { borderColor: theme.border }]}
                >
                  <ThemedText style={{ color: theme.primary }}>Try again</ThemedText>
                </TouchableOpacity>
              </View>
            ) : data ? (
              <>
                <ThemedText style={[styles.instruction, { color: theme.textSecondary }]}>
                  {data.amount !== null
                    ? 'Scan with GCash, Maya or your bank app. The amount is already set.'
                    : 'Scan with GCash, Maya or your bank app to add money to your BeeWallet wallet.'}
                </ThemedText>

                {/* Read from the response, not from what was typed: this is the figure the code
                    was actually generated with, and it is null whenever the backend returned the
                    reusable static QR instead. */}
                {data.amount !== null ? (
                  <View style={[styles.amountPill, { borderColor: theme.border }]}>
                    <ThemedText style={[styles.amountPillLabel, { color: theme.textSecondary }]}>
                      Amount locked in
                    </ThemedText>
                    <ThemedText style={[styles.amountPillValue, { color: theme.text }]}>
                      ₱{data.amount.toFixed(2)}
                    </ThemedText>
                  </View>
                ) : null}

                {/* An expired code still renders as a perfectly scannable picture — nothing about
                    it looks wrong — so it is covered rather than dimmed. A driver holding out a
                    dead QR while a customer's app rejects it is the failure worth designing out. */}
                {expired ? (
                  <View style={[styles.expiredPanel, { borderColor: theme.border }]}>
                    <Ionicons name="time-outline" size={32} color={theme.textSecondary} />
                    <ThemedText style={[styles.merchant, { color: theme.text }]}>
                      This code has expired
                    </ThemedText>
                    <ThemedText style={[styles.note, { color: theme.textSecondary }]}>
                      A code with an amount lasts 30 minutes. Nothing was charged.
                    </ThemedText>
                    <TouchableOpacity
                      onPress={() => load(qrAmount)}
                      style={[styles.primaryButton, { backgroundColor: theme.primary }]}
                    >
                      <ThemedText style={{ color: '#111', fontWeight: '700' }}>
                        Get a new code
                      </ThemedText>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.qrFrame}>
                    <Image source={{ uri: data.qrImage }} style={styles.qr} resizeMode="contain" />
                  </View>
                )}

                {secondsLeft !== null && !expired ? (
                  <ThemedText style={[styles.note, { color: theme.textSecondary }]}>
                    Expires in {Math.floor(secondsLeft / 60)}:
                    {String(secondsLeft % 60).padStart(2, '0')}
                  </ThemedText>
                ) : null}

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

                {/* Saving an expired code would hand the driver a picture that can never be paid. */}
                {canSave && !expired ? (
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
        )}
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
  amountField: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'stretch',
    borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10, marginTop: 4,
  },
  peso: { fontSize: 24, fontWeight: '600' },
  amountInput: { flex: 1, fontSize: 28, fontWeight: '700', paddingVertical: 4 },
  quickRow: { flexDirection: 'row', gap: 10 },
  quickChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 8 },
  primaryButton: {
    alignSelf: 'stretch', alignItems: 'center', borderRadius: 12, paddingVertical: 14, marginTop: 8,
  },
  skipButton: { paddingVertical: 10 },
  amountPill: {
    alignItems: 'center', gap: 2, borderWidth: 1, borderRadius: 12,
    paddingHorizontal: 20, paddingVertical: 8,
  },
  amountPillLabel: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 },
  amountPillValue: { fontSize: 20, fontWeight: '700' },
  expiredPanel: {
    alignSelf: 'stretch', alignItems: 'center', gap: 8,
    borderWidth: 1, borderRadius: 16, paddingHorizontal: 24, paddingVertical: 28,
  },
  saveButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12, marginTop: 4,
  },
});
