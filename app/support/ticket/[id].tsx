import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/shared/hooks/use-theme';
import { supportService } from '@/features/support';
import type { SupportTicket } from '@/features/support';
import { ThemedView } from '@/shared/components/themed-view';
import { ThemedText } from '@/shared/components/themed-text';
import { Ionicons } from '@expo/vector-icons';

/**
 * Ticket detail screen — view a single support ticket.
 */
export default function TicketDetailScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const id = params.id;

  const [ticket, setTicket] = useState<SupportTicket | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTicket = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await supportService.getTicket(id);
      setTicket(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load ticket');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadTicket();
  }, [loadTicket]);

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

  if (!id) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText>Invalid ticket</ThemedText>
        <TouchableOpacity onPress={() => router.back()}>
          <ThemedText style={{ color: theme.primary }}>Go back</ThemedText>
        </TouchableOpacity>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <ThemedText style={[styles.title, { color: theme.text }]} numberOfLines={1}>
          Ticket
        </ThemedText>
        <View style={styles.headerRight} />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : error || !ticket ? (
        <View style={[styles.centered, styles.errorBlock]}>
          <ThemedText style={[styles.errorText, { color: theme.textSecondary }]}>{error || 'Ticket not found'}</ThemedText>
          <TouchableOpacity onPress={() => router.back()} style={[styles.backLink, { borderColor: theme.primary }]}>
            <ThemedText style={{ color: theme.primary }}>Go back</ThemedText>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}>
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.cardRow}>
              <ThemedText style={[styles.label, { color: theme.textSecondary }]}>Ticket #</ThemedText>
              <ThemedText style={[styles.value, { color: theme.text }]}>{ticket.ticketNumber}</ThemedText>
            </View>
            <View style={styles.cardRow}>
              <ThemedText style={[styles.label, { color: theme.textSecondary }]}>Status</ThemedText>
              <View style={[styles.statusBadge, { backgroundColor: getStatusColor(ticket.status) + '20' }]}>
                <ThemedText style={[styles.statusText, { color: getStatusColor(ticket.status) }]}>
                  {ticket.status}
                </ThemedText>
              </View>
            </View>
            <View style={styles.cardRow}>
              <ThemedText style={[styles.label, { color: theme.textSecondary }]}>Category</ThemedText>
              <ThemedText style={[styles.value, { color: theme.text }]}>{ticket.category}</ThemedText>
            </View>
            <View style={styles.cardRow}>
              <ThemedText style={[styles.label, { color: theme.textSecondary }]}>Priority</ThemedText>
              <ThemedText style={[styles.value, { color: theme.text }]}>{ticket.priority}</ThemedText>
            </View>
            <View style={styles.cardRow}>
              <ThemedText style={[styles.label, { color: theme.textSecondary }]}>Created</ThemedText>
              <ThemedText style={[styles.value, { color: theme.text }]}>
                {new Date(ticket.createdAt).toLocaleString()}
              </ThemedText>
            </View>
            {ticket.updatedAt && (
              <View style={styles.cardRow}>
                <ThemedText style={[styles.label, { color: theme.textSecondary }]}>Updated</ThemedText>
                <ThemedText style={[styles.value, { color: theme.text }]}>
                  {new Date(ticket.updatedAt).toLocaleString()}
                </ThemedText>
              </View>
            )}
          </View>

          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <ThemedText style={[styles.label, { color: theme.textSecondary, marginBottom: 4 }]}>Subject</ThemedText>
            <ThemedText style={[styles.value, { color: theme.text }]}>{ticket.subject}</ThemedText>
          </View>

          {ticket.description ? (
            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <ThemedText style={[styles.label, { color: theme.textSecondary, marginBottom: 4 }]}>Description</ThemedText>
              <ThemedText style={[styles.value, { color: theme.text }]}>{ticket.description}</ThemedText>
            </View>
          ) : null}

          {ticket.resolution ? (
            <View style={[styles.card, styles.resolutionCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <ThemedText style={[styles.label, { color: theme.textSecondary, marginBottom: 4 }]}>Resolution</ThemedText>
              <ThemedText style={[styles.value, { color: theme.text }]}>{ticket.resolution}</ThemedText>
              {ticket.resolvedAt && (
                <ThemedText style={[styles.resolvedAt, { color: theme.textSecondary }]}>
                  Resolved {new Date(ticket.resolvedAt).toLocaleString()}
                </ThemedText>
              )}
            </View>
          ) : null}
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
    gap: 16,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorBlock: {
    padding: 24,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  },
  backLink: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderRadius: 8,
  },
  card: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  resolutionCard: {
    marginBottom: 0,
  },
  label: {
    fontSize: 13,
  },
  value: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
    marginLeft: 12,
    textAlign: 'right',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
  },
  resolvedAt: {
    fontSize: 12,
    marginTop: 8,
  },
});
