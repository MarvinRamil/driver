import React, { useState } from 'react';
import {
  StyleSheet,
  ScrollView,
  View,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '@/shared/hooks/use-theme';
import { ThemedView } from '@/shared/components/themed-view';
import { ThemedText } from '@/shared/components/themed-text';
import { Ionicons } from '@expo/vector-icons';
import { useSavedWithdrawalMethods } from '@/features/wallet/hooks/useSavedWithdrawalMethods';
import type { SavedWithdrawalMethod } from '@/features/wallet/types';

export default function SavedWithdrawalMethodsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const {
    methods,
    isLoading,
    error,
    refresh,
    delete: deleteMethod,
    setDefault,
  } = useSavedWithdrawalMethods();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [settingDefaultId, setSettingDefaultId] = useState<string | null>(null);

  const handleDelete = async (method: SavedWithdrawalMethod) => {
    Alert.alert(
      'Delete Bank Account',
      `Are you sure you want to delete ${method.bankName} (${method.maskedAccountNumber})?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeletingId(method.id);
            try {
              await deleteMethod(method.id);
              Alert.alert('Success', 'Bank account deleted successfully.');
            } catch (err) {
              Alert.alert(
                'Error',
                err instanceof Error ? err.message : 'Failed to delete bank account'
              );
            } finally {
              setDeletingId(null);
            }
          },
        },
      ]
    );
  };

  const handleSetDefault = async (method: SavedWithdrawalMethod) => {
    if (method.isDefault) return;
    
    setSettingDefaultId(method.id);
    try {
      await setDefault(method.id);
      Alert.alert('Success', 'Default bank account updated.');
    } catch (err) {
      Alert.alert(
        'Error',
        err instanceof Error ? err.message : 'Failed to set default bank account'
      );
    } finally {
      setSettingDefaultId(null);
    }
  };

  if (isLoading && methods.length === 0) {
    return (
      <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <ThemedText type="title" style={{ color: theme.text }}>
            Saved Bank Accounts
          </ThemedText>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <ThemedText type="title" style={{ color: theme.text }}>
          Saved Bank Accounts
        </ThemedText>
        <View style={{ width: 24 }} />
      </View>

      {error && (
        <View style={[styles.errorContainer, { backgroundColor: theme.error + '15', borderColor: theme.error }]}>
          <ThemedText style={{ color: theme.error, fontSize: 14 }}>
            {error}
          </ThemedText>
        </View>
      )}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refresh} />}
      >
        {methods.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="card-outline" size={64} color={theme.textMuted} />
            <ThemedText style={{ color: theme.textSecondary, marginTop: 16, textAlign: 'center' }}>
              No saved bank accounts yet
            </ThemedText>
            <ThemedText style={{ color: theme.textMuted, marginTop: 8, textAlign: 'center', fontSize: 14 }}>
              Save a bank account when making a withdrawal to use it again later
            </ThemedText>
          </View>
        ) : (
          methods.map((method) => (
            <View
              key={method.id}
              style={[
                styles.methodCard,
                {
                  backgroundColor: theme.surface,
                  borderColor: method.isDefault ? theme.primary : theme.border,
                },
              ]}
            >
              <View style={styles.methodCardHeader}>
                <View style={styles.methodCardLeft}>
                  {method.isDefault && (
                    <View style={[styles.defaultBadge, { backgroundColor: theme.primary }]}>
                      <Ionicons name="star" size={12} color="#fff" />
                      <ThemedText style={{ color: '#fff', fontSize: 10, marginLeft: 4 }}>
                        DEFAULT
                      </ThemedText>
                    </View>
                  )}
                  <ThemedText style={{ color: theme.text, fontSize: 16, fontWeight: '600', marginTop: 4 }}>
                    {method.bankName}
                  </ThemedText>
                </View>
                <View style={styles.methodCardActions}>
                  {!method.isDefault && (
                    <TouchableOpacity
                      onPress={() => handleSetDefault(method)}
                      disabled={settingDefaultId === method.id}
                      style={[
                        styles.actionButton,
                        { borderColor: theme.border },
                        settingDefaultId === method.id && { opacity: 0.5 },
                      ]}
                    >
                      {settingDefaultId === method.id ? (
                        <ActivityIndicator size="small" color={theme.primary} />
                      ) : (
                        <Ionicons name="star-outline" size={18} color={theme.text} />
                      )}
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    onPress={() => handleDelete(method)}
                    disabled={deletingId === method.id}
                    style={[
                      styles.actionButton,
                      { borderColor: theme.error },
                      deletingId === method.id && { opacity: 0.5 },
                    ]}
                  >
                    {deletingId === method.id ? (
                      <ActivityIndicator size="small" color={theme.error} />
                    ) : (
                      <Ionicons name="trash-outline" size={18} color={theme.error} />
                    )}
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.methodCardDetails}>
                <View style={styles.detailRow}>
                  <ThemedText style={{ color: theme.textSecondary, fontSize: 12 }}>
                    Account Number
                  </ThemedText>
                  <ThemedText style={{ color: theme.text, fontSize: 14, fontWeight: '500' }}>
                    {method.maskedAccountNumber}
                  </ThemedText>
                </View>
                <View style={styles.detailRow}>
                  <ThemedText style={{ color: theme.textSecondary, fontSize: 12 }}>
                    Account Holder
                  </ThemedText>
                  <ThemedText style={{ color: theme.text, fontSize: 14, fontWeight: '500' }}>
                    {method.accountHolderName}
                  </ThemedText>
                </View>
                {method.lastUsedAt && (
                  <View style={styles.detailRow}>
                    <ThemedText style={{ color: theme.textSecondary, fontSize: 12 }}>
                      Last Used
                    </ThemedText>
                    <ThemedText style={{ color: theme.textMuted, fontSize: 12 }}>
                      {new Date(method.lastUsedAt).toLocaleDateString()}
                    </ThemedText>
                  </View>
                )}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    margin: 20,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  methodCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  methodCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  methodCardLeft: {
    flex: 1,
  },
  defaultBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  methodCardActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodCardDetails: {
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
