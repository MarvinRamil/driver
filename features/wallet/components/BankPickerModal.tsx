import { ThemedText } from '@/shared/components/themed-text';
import { useTheme } from '@/shared/hooks/use-theme';
import { maxAmountFor, railFor, type PhBank } from '@/shared/constants/banks';
import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

interface BankPickerModalProps {
  visible: boolean;
  banks: PhBank[];
  isLoading?: boolean;
  /** Currently selected code, highlighted in the list. */
  selectedCode?: string | null;
  /**
   * Amount being withdrawn. Institutions that cannot receive it on any rail they support
   * are shown disabled with the reason, rather than hidden — a driver looking for their
   * bank needs to know it exists and why it is unavailable right now.
   */
  amount?: number | null;
  onSelect: (bank: PhBank) => void;
  onClose: () => void;
}

interface Row {
  kind: 'header' | 'bank';
  key: string;
  title?: string;
  bank?: PhBank;
}

/**
 * Full-screen searchable picker for withdrawal destinations.
 *
 * A searchable list rather than a dropdown because the catalog runs to ~150 institutions
 * once PayMongo's full receiving-institution list is loaded. E-wallets are sectioned first
 * since they are the common case for drivers.
 */
export function BankPickerModal({
  visible,
  banks,
  isLoading = false,
  selectedCode,
  amount,
  onSelect,
  onClose,
}: BankPickerModalProps) {
  const theme = useTheme();
  const [query, setQuery] = useState('');

  const rows = useMemo<Row[]>(() => {
    const needle = query.trim().toLowerCase();
    // Legal name is searchable too: PayMongo knows GCash as "G-Xchange, Inc.", and a
    // driver who saw that name on a statement should still find the row.
    const matches = needle
      ? banks.filter(
          (b) =>
            b.name.toLowerCase().includes(needle) ||
            b.code.toLowerCase().includes(needle) ||
            (b.legalName?.toLowerCase().includes(needle) ?? false),
        )
      : banks;

    const ewallets = matches.filter((b) => b.type === 'ewallet');
    const localBanks = matches.filter((b) => b.type !== 'ewallet');

    const out: Row[] = [];
    if (ewallets.length > 0) {
      out.push({ kind: 'header', key: 'h-ewallet', title: 'E-wallets' });
      ewallets.forEach((b) => out.push({ kind: 'bank', key: b.code, bank: b }));
    }
    if (localBanks.length > 0) {
      out.push({ kind: 'header', key: 'h-bank', title: 'Banks' });
      localBanks.forEach((b) => out.push({ kind: 'bank', key: b.code, bank: b }));
    }
    return out;
  }, [banks, query]);

  const renderRow = ({ item }: { item: Row }) => {
    if (item.kind === 'header') {
      return (
        <ThemedText
          style={[styles.sectionHeader, { color: theme.textSecondary, backgroundColor: theme.background }]}
        >
          {item.title}
        </ThemedText>
      );
    }

    const bank = item.bank!;
    const limit = maxAmountFor(bank);
    const overLimit = amount != null && amount > limit;
    const isSelected = bank.code === selectedCode;

    return (
      <TouchableOpacity
        disabled={overLimit}
        onPress={() => {
          onSelect(bank);
          onClose();
        }}
        style={[styles.row, { borderBottomColor: theme.border, opacity: overLimit ? 0.45 : 1 }]}
      >
        <View style={{ flex: 1 }}>
          <ThemedText style={{ color: theme.text, fontWeight: isSelected ? '700' : '500' }}>
            {bank.name}
          </ThemedText>
          <ThemedText style={{ color: theme.textSecondary, fontSize: 11, marginTop: 2 }}>
            {overLimit
              ? `Max ₱${limit.toLocaleString()} per transfer`
              : railFor(bank, amount) === 'instapay'
                ? 'Instant · 24/7'
                : 'Arrives next banking day'}
          </ThemedText>
        </View>
        {isSelected && !overLimit && (
          <Ionicons name="checkmark-circle" size={20} color={theme.primary} />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={24} color={theme.text} />
          </TouchableOpacity>
          <ThemedText style={{ color: theme.text, fontSize: 16, fontWeight: '700' }}>
            Select bank or e-wallet
          </ThemedText>
          <View style={{ width: 24 }} />
        </View>

        <View style={styles.searchWrap}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
            autoCapitalize="none"
            placeholder="Search"
            placeholderTextColor={theme.textMuted}
            style={[styles.search, { borderColor: theme.border, color: theme.text }]}
          />
        </View>

        {isLoading && banks.length === 0 ? (
          <ActivityIndicator style={{ marginTop: 32 }} color={theme.primary} />
        ) : (
          <FlatList
            data={rows}
            keyExtractor={(row) => row.key}
            renderItem={renderRow}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <ThemedText style={{ color: theme.textSecondary, textAlign: 'center', marginTop: 32 }}>
                No bank or e-wallet matches “{query}”.
              </ThemedText>
            }
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  searchWrap: { paddingHorizontal: 16, paddingVertical: 12 },
  search: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
