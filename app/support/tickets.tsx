import React, { useCallback } from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '@/shared/hooks/use-theme';
import { useSupport } from '@/features/support';
import { ThemedView } from '@/shared/components/themed-view';
import { ThemedText } from '@/shared/components/themed-text';
import { Ionicons } from '@expo/vector-icons';

/**
 * List of the driver's support tickets.
 * "View All" from the main support screen navigates here.
 */
export default function TicketsScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const router = useRouter();
  const { tickets, isLoading, error, refreshTickets } = useSupport();
  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshTickets();
    setRefreshing(false);
  }, [refreshTickets]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Resolved':
      case 'Closed':
        return theme.success;
      case 'InProgress':
        return theme.info;
      case 'Open':
        return theme.warning;
      default:
        return theme.textSecondary;
    }
  };

  const getStatusBg = (status: string) => {
    return getStatusColor(status) + '20';
  };

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <ThemedText style={[styles.title, { color: theme.text }]}>My Tickets</ThemedText>
        <View style={styles.headerRight} />
      </View>

      {isLoading && !refreshing ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
          }>
          {error ? (
            <View style={[styles.emptyState, { backgroundColor: theme.surface }]}>
              <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>{error}</ThemedText>
            </View>
          ) : tickets.length === 0 ? (
            <View style={[styles.emptyState, { backgroundColor: theme.surface }]}>
              <Ionicons name="ticket-outline" size={48} color={theme.textSecondary} style={{ marginBottom: 12 }} />
              <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
                No tickets yet
              </ThemedText>
              <ThemedText style={[styles.emptySubtext, { color: theme.textSecondary }]}>
                Report an issue from the Support screen to create one.
              </ThemedText>
            </View>
          ) : (
            <View style={styles.section}>
              {tickets.map((ticket) => (
                <TouchableOpacity
                  key={ticket.id}
                  style={[styles.ticketCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
                  onPress={() => router.push(`/support/ticket/${ticket.id}`)}
                  activeOpacity={0.7}>
                  <View style={styles.ticketLeft}>
                    <View
                      style={[
                        styles.ticketIcon,
                        {
                          backgroundColor:
                            ticket.category === 'Payment' ? theme.info + '20' : theme.textSecondary + '20',
                        },
                      ]}>
                      <Ionicons
                        name={ticket.category === 'Payment' ? 'card-outline' : 'car-outline'}
                        size={20}
                        color={ticket.category === 'Payment' ? theme.info : theme.textSecondary}
                      />
                    </View>
                    <View style={styles.ticketInfo}>
                      <ThemedText style={[styles.ticketTitle, { color: theme.text }]} numberOfLines={1}>
                        {ticket.subject}
                      </ThemedText>
                      <ThemedText style={[styles.ticketTime, { color: theme.textSecondary }]}>
                        {ticket.ticketNumber} · {new Date(ticket.updatedAt || ticket.createdAt).toLocaleString()}
                      </ThemedText>
                    </View>
                  </View>
                  <View
                    style={[
                      styles.ticketStatus,
                      { backgroundColor: getStatusBg(ticket.status) },
                    ]}>
                    <View
                      style={[
                        styles.statusDot,
                        { backgroundColor: getStatusColor(ticket.status) },
                      ]}
                    />
                    <ThemedText
                      style={[styles.ticketStatusText, { color: getStatusColor(ticket.status) }]}>
                      {ticket.status}
                    </ThemedText>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>
      )}
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },
  headerRight: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: {
    gap: 12,
  },
  emptyState: {
    padding: 32,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
  },
  emptyText: {
    fontSize: 16,
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 14,
  },
  ticketCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  ticketLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  ticketIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ticketInfo: {
    flex: 1,
    gap: 4,
  },
  ticketTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  ticketTime: {
    fontSize: 12,
  },
  ticketStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  ticketStatusText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
