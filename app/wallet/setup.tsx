import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/shared/hooks/use-theme';
import { ThemedView } from '@/shared/components/themed-view';
import { ThemedText } from '@/shared/components/themed-text';
import { usePayMongoOnboarding } from '@/features/wallet/hooks/usePayMongoOnboarding';
import { useWallet } from '@/features/wallet/hooks/useWallet';
import type { PayMongoOnboardingDetailsInput } from '@/features/wallet/types';
import { PH_PROVINCES, provinceName } from '@/shared/constants/provinces';
import { toE164Ph } from '@/shared/constants/validation';

/**
 * Wallet setup.
 *
 * Deliberately never mentions PayMongo, child accounts or "creating a wallet" — that is
 * infrastructure. From the driver's side this is one thing: fund their Cash Wallet, verify who
 * you are, and start accepting jobs.
 */

const KYC_FEE = 30;
const MONTHLY_FEE = 15;
const STARTING_FLOAT = 1000;

/** PayMongo's accepted values. Sent verbatim; the labels are ours. */
const NATURE_OF_WORK = [
  { value: 'self_employed', label: 'Self-employed' },
  { value: 'employed_locally', label: 'Employed' },
  { value: 'ofw', label: 'OFW' },
  { value: 'student', label: 'Student' },
] as const;

const SOURCE_OF_FUNDS = [
  { value: 'commission', label: 'Delivery earnings' },
  { value: 'salary', label: 'Salary' },
  { value: 'allowance', label: 'Allowance' },
  { value: 'other', label: 'Other' },
] as const;

export default function WalletSetupScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTheme();

  const { data, isLoading, isWorking, error, start, activate, refresh } = usePayMongoOnboarding();
  const { wallet } = useWallet();

  const [form, setForm] = useState<PayMongoOnboardingDetailsInput>({
    nationality: 'PHL',
    natureOfWork: 'self_employed',
    sourceOfFunds: 'commission',
    tin: undefined,
    placeOfBirthCity: '',
    addressLine1: '',
    addressCity: '',
    addressState: '',
    addressPostalCode: '',
    middleName: '',
    mobileNumber: '',
  });

  const [provincePickerOpen, setProvincePickerOpen] = useState(false);
  const [provinceQuery, setProvinceQuery] = useState('');

  const status = data?.status ?? 'None';
  const floatBalance = wallet?.topUpBalance ?? 0;
  const floatCoversFee = floatBalance >= KYC_FEE;

  const set = <K extends keyof PayMongoOnboardingDetailsInput>(
    key: K,
    value: PayMongoOnboardingDetailsInput[K]
  ) => setForm((prev) => ({ ...prev, [key]: value }));

  const missing = useMemo(() => {
    // TIN deliberately absent: activation does not require it (verified against the live API),
    // and many riders do not have one. mobileNumber IS required — activation rejects an account
    // without one, and that rejection lands after the account has already been created.
    const required: (keyof PayMongoOnboardingDetailsInput)[] = [
      'mobileNumber',
      'placeOfBirthCity',
      'addressLine1',
      'addressCity',
      'addressState',
      'addressPostalCode',
    ];
    return required.filter((k) => !String(form[k] ?? '').trim());
  }, [form]);

  const handleStart = async () => {
    const url = await start();
    if (!url) return;

    // An in-app browser rather than Linking.openURL: the driver stays inside the app, and control
    // returns here when they finish so we can refresh instead of leaving them to navigate back.
    //
    // Deliberately NOT a raw WebView. Identity verification needs the camera, and getUserMedia in
    // a WebView depends on per-platform permission plumbing that KYC providers do not always
    // support. SFSafariViewController and Custom Tabs are the real browser engine, so the camera
    // behaves exactly as it does on the web.
    try {
      await WebBrowser.openBrowserAsync(url, { showTitle: true, enableBarCollapsing: true });
    } catch {
      Alert.alert('Cannot Open Link', 'Your device could not open the verification page.');
      return;
    }

    // They are back. PayMongo may not have told us the outcome yet, so re-read rather than assume.
    await refresh();
  };

  const handleActivate = () => {
    if (missing.length > 0) {
      Alert.alert('Missing Details', 'Please fill in every field before continuing.');
      return;
    }

    // PayMongo requires E.164 ("+63…"). This app stores numbers as 09XXXXXXXXX, so without this
    // the update is rejected AFTER the child account has already been created.
    const mobile = toE164Ph(form.mobileNumber);
    if (!mobile) {
      Alert.alert(
        'Check your mobile number',
        'Enter it as 09XXXXXXXXX, or with your country code like +639XXXXXXXXX.'
      );
      return;
    }

    // Confirmed explicitly because this cannot be undone: once submitted the details are frozen
    // and cannot be corrected, and a rejection cannot be appealed or retried on this account.
    Alert.alert(
      'Confirm your details',
      'These details cannot be changed after this step. Please check they match your ID exactly.',
      [
        { text: 'Go back', style: 'cancel' },
        {
          text: 'Confirm',
          style: 'destructive',
          onPress: async () => {
            const ready = await activate({ ...form, mobileNumber: mobile });
            if (ready) {
              Alert.alert('Wallet ready', 'Your wallet is set up. You can now be paid into it.', [
                { text: 'Done', onPress: () => router.back() },
              ]);
            }
          },
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <ThemedView style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={26} color={theme.text} />
        </TouchableOpacity>
        <ThemedText style={styles.headerTitle}>Wallet setup</ThemedText>
        <View style={styles.backButton} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
          keyboardShouldPersistTaps="handled"
        >
          {data?.verificationFailureReason ? (
            <View style={[styles.notice, { backgroundColor: theme.error + '18' }]}>
              <Ionicons name="camera-outline" size={20} color={theme.error} />
              <View style={{ flex: 1 }}>
                <ThemedText style={[styles.noticeText, { color: theme.error, fontWeight: '600' }]}>
                  Verification didn&apos;t pass
                </ThemedText>
                <ThemedText style={[styles.noticeText, { color: theme.textSecondary }]}>
                  {data.verificationFailureReason}
                </ThemedText>
                <ThemedText style={[styles.fine, { color: theme.textSecondary }]}>
                  Try again in good light, holding your ID flat and steady.
                </ThemedText>
              </View>
            </View>
          ) : null}

          {error ? (
            <View style={[styles.notice, { backgroundColor: theme.error + '18' }]}>
              <Ionicons name="alert-circle-outline" size={20} color={theme.error} />
              <ThemedText style={[styles.noticeText, { color: theme.error }]}>{error}</ThemedText>
            </View>
          ) : null}

          {status === 'Declined' ? (
            <DeclinedCard theme={theme} />
          ) : status === 'Activated' ? (
            <ReadyCard
              theme={theme}
              accountNumber={data?.walletAccountNumber ?? null}
              accountEmail={data?.accountEmail ?? null}
            />
          ) : (
            <>
              {/* Fee disclosure. This is the driver's record of what they are agreeing to, so it
                  is shown before anything is charged and stays visible until setup completes. */}
              <View style={[styles.card, { backgroundColor: theme.surface }]}>
                <ThemedText style={styles.cardTitle}>Set up your Bee wallet</ThemedText>
                <ThemedText style={[styles.cardBody, { color: theme.textSecondary }]}>
                  ₱{STARTING_FLOAT.toLocaleString()} to begin accepting cash jobs.
                </ThemedText>

                <View style={styles.feeRow}>
                  <ThemedText style={[styles.feeLabel, { color: theme.textSecondary }]}>
                    One-time account fee
                  </ThemedText>
                  <ThemedText style={styles.feeValue}>₱{KYC_FEE.toFixed(2)}</ThemedText>
                </View>
                <View style={styles.feeRow}>
                  <ThemedText style={[styles.feeLabel, { color: theme.textSecondary }]}>
                    Monthly upkeep
                  </ThemedText>
                  <ThemedText style={styles.feeValue}>₱{MONTHLY_FEE.toFixed(2)}</ThemedText>
                </View>
                <View style={[styles.divider, { backgroundColor: theme.border }]} />
                <View style={styles.feeRow}>
                  <ThemedText style={styles.feeLabelStrong}>Stays in your Cash Wallet</ThemedText>
                  <ThemedText style={styles.feeValueStrong}>
                    ₱{(STARTING_FLOAT - KYC_FEE).toFixed(2)}
                  </ThemedText>
                </View>

                <ThemedText style={[styles.fine, { color: theme.textSecondary }]}>
                  Your Cash Wallet stays yours — move it to BeePay and withdraw it any time, less any
                  cash you still owe from deliveries.
                </ThemedText>
              </View>

              <View style={[styles.card, { backgroundColor: theme.surface }]}>
                <ThemedText style={styles.cardTitle}>Your Cash Wallet</ThemedText>
                <ThemedText style={[styles.balance, { color: floatCoversFee ? theme.success : theme.error }]}>
                  ₱{floatBalance.toFixed(2)}
                </ThemedText>
                {!floatCoversFee ? (
                  <ThemedText style={[styles.cardBody, { color: theme.error }]}>
                    Add at least ₱{KYC_FEE.toFixed(2)} to your Cash Wallet first.
                  </ThemedText>
                ) : null}
              </View>

              {status === 'None' || status === 'Pending' || status === 'Verifying' ? (
                <>
                  <TouchableOpacity
                    style={[
                      styles.primaryButton,
                      { backgroundColor: theme.primary },
                      (!floatCoversFee || isWorking) && styles.disabled,
                    ]}
                    disabled={!floatCoversFee || isWorking}
                    onPress={handleStart}
                  >
                    {isWorking ? (
                      <ActivityIndicator color="#111" />
                    ) : (
                      <ThemedText style={styles.primaryButtonText}>
                        {data?.verificationFailureReason
                          ? 'Try verification again'
                          : status === 'Verifying'
                            ? 'Continue verification'
                            : 'Verify my identity'}
                      </ThemedText>
                    )}
                  </TouchableOpacity>

                  {status === 'Verifying' ? (
                    <ThemedText style={[styles.fine, { color: theme.textSecondary }]}>
                      Finish verification in the page that opened, then come back and refresh.
                    </ThemedText>
                  ) : null}

                  <TouchableOpacity onPress={refresh} style={styles.linkButton}>
                    <ThemedText style={[styles.linkText, { color: theme.primary }]}>
                      I&apos;ve finished verifying
                    </ThemedText>
                  </TouchableOpacity>
                </>
              ) : null}

              {status === 'Verified' ? (
                <View style={[styles.card, { backgroundColor: theme.surface }]}>
                  <ThemedText style={styles.cardTitle}>A few last details</ThemedText>
                  <ThemedText style={[styles.cardBody, { color: theme.textSecondary }]}>
                    These must match your ID exactly. They cannot be changed afterwards.
                  </ThemedText>

                  <Field label="Mobile number" value={form.mobileNumber ?? ''}
                    onChange={(v) => set('mobileNumber', v)}
                    placeholder="09XXXXXXXXX" theme={theme} keyboardType="phone-pad" />
                  {form.mobileNumber ? (
                    <ThemedText
                      style={[
                        styles.fine,
                        { color: toE164Ph(form.mobileNumber) ? theme.textSecondary : theme.error },
                      ]}
                    >
                      {toE164Ph(form.mobileNumber)
                        ? `Will be saved as ${toE164Ph(form.mobileNumber)}`
                        : 'Enter as 09XXXXXXXXX or +639XXXXXXXXX'}
                    </ThemedText>
                  ) : null}
                  <Field label="TIN (optional)" value={form.tin ?? ''}
                    onChange={(v) => set('tin', v)}
                    placeholder="Leave blank if you don't have one" theme={theme}
                    keyboardType="numbers-and-punctuation" />
                  <Field label="Middle name (optional)" value={form.middleName ?? ''}
                    onChange={(v) => set('middleName', v)} theme={theme} />
                  <Field label="City of birth" value={form.placeOfBirthCity}
                    onChange={(v) => set('placeOfBirthCity', v)} theme={theme} />
                  <Field label="Street address" value={form.addressLine1}
                    onChange={(v) => set('addressLine1', v)} theme={theme} />
                  <Field label="City" value={form.addressCity}
                    onChange={(v) => set('addressCity', v)} theme={theme} />
                  {/* A picker, not a text field. The first live run failed activation with
                      "state must be a valid Philippine province code" because this was free text —
                      and activation is irreversible, so there is no correcting it afterwards. */}
                  <View style={styles.field}>
                    <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                      Province
                    </ThemedText>
                    <TouchableOpacity
                      onPress={() => setProvincePickerOpen(true)}
                      style={[styles.input, styles.pickerField, { borderColor: theme.border, backgroundColor: theme.background }]}
                    >
                      <ThemedText style={{ color: form.addressState ? theme.text : theme.textSecondary }}>
                        {provinceName(form.addressState) ?? 'Select your province'}
                      </ThemedText>
                      <Ionicons name="chevron-down" size={18} color={theme.textSecondary} />
                    </TouchableOpacity>
                  </View>
                  <Field label="Postal code" value={form.addressPostalCode}
                    onChange={(v) => set('addressPostalCode', v)} placeholder="2900"
                    theme={theme} keyboardType="number-pad" />

                  <Picker label="Type of work" options={NATURE_OF_WORK} value={form.natureOfWork}
                    onChange={(v) => set('natureOfWork', v)} theme={theme} />
                  <Picker label="Source of funds" options={SOURCE_OF_FUNDS} value={form.sourceOfFunds}
                    onChange={(v) => set('sourceOfFunds', v)} theme={theme} />

                  {form.sourceOfFunds === 'other' ? (
                    <Field label="Describe your source of funds"
                      value={form.sourceOfFundsOther ?? ''}
                      onChange={(v) => set('sourceOfFundsOther', v)} theme={theme} />
                  ) : null}

                  <TouchableOpacity
                    style={[
                      styles.primaryButton,
                      { backgroundColor: theme.primary },
                      (missing.length > 0 || isWorking) && styles.disabled,
                    ]}
                    disabled={missing.length > 0 || isWorking}
                    onPress={handleActivate}
                  >
                    {isWorking ? (
                      <ActivityIndicator color="#111" />
                    ) : (
                      <ThemedText style={styles.primaryButtonText}>Finish setup</ThemedText>
                    )}
                  </TouchableOpacity>
                </View>
              ) : null}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={provincePickerOpen} animationType="slide" onRequestClose={() => setProvincePickerOpen(false)}>
        <ThemedView style={[styles.container, { paddingTop: insets.top + 12 }]}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => setProvincePickerOpen(false)} style={styles.backButton}>
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
            <ThemedText style={styles.headerTitle}>Select province</ThemedText>
            <View style={styles.backButton} />
          </View>

          <TextInput
            style={[styles.input, { marginHorizontal: 16, color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
            value={provinceQuery}
            onChangeText={setProvinceQuery}
            placeholder="Search"
            placeholderTextColor={theme.textSecondary}
            autoCorrect={false}
          />

          <FlatList
            data={PH_PROVINCES.filter((p) =>
              p.name.toLowerCase().includes(provinceQuery.trim().toLowerCase())
            )}
            keyExtractor={(p) => p.code}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => {
                  set('addressState', item.code);
                  setProvincePickerOpen(false);
                  setProvinceQuery('');
                }}
                style={[styles.provinceRow, { borderBottomColor: theme.border }]}
              >
                <ThemedText style={{ color: theme.text }}>{item.name}</ThemedText>
                {form.addressState === item.code ? (
                  <Ionicons name="checkmark-circle" size={20} color={theme.primary} />
                ) : null}
              </TouchableOpacity>
            )}
          />
        </ThemedView>
      </Modal>
    </ThemedView>
  );
}

function Field({
  label, value, onChange, theme, placeholder, keyboardType, autoCapitalize,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  theme: any;
  placeholder?: string;
  keyboardType?: any;
  autoCapitalize?: any;
}) {
  return (
    <View style={styles.field}>
      <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary }]}>{label}</ThemedText>
      <TextInput
        style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={theme.textSecondary}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
      />
    </View>
  );
}

function Picker({
  label, options, value, onChange, theme,
}: {
  label: string;
  options: readonly { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  theme: any;
}) {
  return (
    <View style={styles.field}>
      <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary }]}>{label}</ThemedText>
      <View style={styles.chips}>
        {options.map((opt) => (
          <TouchableOpacity
            key={opt.value}
            onPress={() => onChange(opt.value)}
            style={[
              styles.chip,
              { borderColor: theme.border },
              value === opt.value && { backgroundColor: theme.primary, borderColor: theme.primary },
            ]}
          >
            <ThemedText style={[styles.chipText, value === opt.value && { color: '#111' }]}>
              {opt.label}
            </ThemedText>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

/**
 * A decline is final for the account, so this offers support rather than a retry button that
 * could only fail.
 */
function DeclinedCard({ theme }: { theme: any }) {
  return (
    <View style={[styles.card, { backgroundColor: theme.surface }]}>
      <Ionicons name="close-circle-outline" size={40} color={theme.error} />
      <ThemedText style={styles.cardTitle}>Wallet setup was declined</ThemedText>
      <ThemedText style={[styles.cardBody, { color: theme.textSecondary }]}>
        We could not set up your wallet. This cannot be retried from the app — please contact
        support and we will look into it with you.
      </ThemedText>
    </View>
  );
}

function ReadyCard({
  theme, accountNumber, accountEmail,
}: { theme: any; accountNumber: string | null; accountEmail: string | null }) {
  return (
    <View style={[styles.card, { backgroundColor: theme.surface }]}>
      <Ionicons name="checkmark-circle-outline" size={40} color={theme.success} />
      <ThemedText style={styles.cardTitle}>BeePay is ready</ThemedText>
      <ThemedText style={[styles.cardBody, { color: theme.textSecondary }]}>
        Your earnings are paid into BeePay, and you can withdraw to your bank or e-wallet.
      </ThemedText>
      {accountNumber ? (
        <ThemedText style={[styles.fine, { color: theme.textSecondary }]}>
          Wallet number ••••{accountNumber.slice(-4)}
        </ThemedText>
      ) : null}
      {accountEmail ? (
        <ThemedText style={[styles.fine, { color: theme.textSecondary }]}>
          Wallet notices go to {accountEmail}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  center: { justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingBottom: 12,
  },
  backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '600' },
  content: { padding: 16, gap: 14 },
  notice: { flexDirection: 'row', gap: 10, alignItems: 'center', padding: 12, borderRadius: 12 },
  noticeText: { flex: 1, fontSize: 13 },
  card: { borderRadius: 16, padding: 16, gap: 8 },
  cardTitle: { fontSize: 17, fontWeight: '700' },
  cardBody: { fontSize: 14, lineHeight: 20 },
  balance: { fontSize: 26, fontWeight: '700' },
  feeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  feeLabel: { fontSize: 14 },
  feeValue: { fontSize: 14, fontWeight: '600' },
  feeLabelStrong: { fontSize: 15, fontWeight: '700' },
  feeValueStrong: { fontSize: 15, fontWeight: '700' },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 6 },
  fine: { fontSize: 12, lineHeight: 18 },
  field: { gap: 6 },
  pickerField: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  provinceRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  fieldLabel: { fontSize: 13 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  chipText: { fontSize: 13 },
  primaryButton: { borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  primaryButtonText: { fontSize: 15, fontWeight: '700', color: '#111' },
  disabled: { opacity: 0.5 },
  linkButton: { alignItems: 'center', paddingVertical: 8 },
  linkText: { fontSize: 14, fontWeight: '600' },
});
