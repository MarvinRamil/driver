import React from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/shared/hooks/use-theme';
import { ThemedView } from '@/shared/components/themed-view';
import { ThemedText } from '@/shared/components/themed-text';
import { useGiveaways } from '@/features/giveaways';

export default function GiveawaysScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const router = useRouter();
  const { giveaways, isLoading, refresh, enterGiveaway } = useGiveaways();

  const onEnter = async (id: string) => {
    try {
      await enterGiveaway(id);
      Alert.alert('Joined', 'You have successfully joined the giveaway.');
      await refresh();
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to join giveaway');
    }
  };

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refresh} />}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <ThemedText type="title" style={[styles.title, { color: theme.text }]}>
            Giveaways
          </ThemedText>
          <View style={{ width: 24 }} />
        </View>

        {giveaways.length === 0 ? (
          <View style={[styles.empty, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Ionicons name="gift-outline" size={28} color={theme.textSecondary} />
            <ThemedText style={{ color: theme.textSecondary }}>No active giveaways right now.</ThemedText>
          </View>
        ) : (
          giveaways.map((item) => (
            <View key={item.id} style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={styles.cardHeader}>
                <ThemedText type="subtitle" style={{ color: theme.text }}>
                  {item.title}
                </ThemedText>
                <Ionicons name="gift" size={20} color={theme.primary} />
              </View>
              {!!item.description && (
                <ThemedText style={[styles.description, { color: theme.textSecondary }]}>
                  {item.description}
                </ThemedText>
              )}
              {!!item.rewardDetails && (
                <ThemedText style={{ color: theme.text }}>Reward: {item.rewardDetails}</ThemedText>
              )}
              <ThemedText style={[styles.date, { color: theme.textSecondary }]}>
                Ends: {new Date(item.endDate).toLocaleString()}
              </ThemedText>
              <TouchableOpacity style={[styles.joinButton, { backgroundColor: theme.primary }]} onPress={() => onEnter(item.id)}>
                <ThemedText style={styles.joinText}>Join Giveaway</ThemedText>
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 16, paddingBottom: 100, gap: 12 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 48,
    paddingBottom: 16,
  },
  title: { fontSize: 18, fontWeight: '700' },
  empty: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    gap: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  description: {
    fontSize: 13,
  },
  date: {
    fontSize: 12,
  },
  joinButton: {
    marginTop: 6,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  joinText: {
    color: '#111',
    fontWeight: '700',
  },
});
