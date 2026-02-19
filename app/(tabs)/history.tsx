import React, { useState } from 'react';
import { StyleSheet, ScrollView, View, RefreshControl, TouchableOpacity, TextInput, Modal, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '@/shared/hooks/use-theme';
import { useHistory, type HistoryFilter } from '@/features/history';
import { ThemedView } from '@/shared/components/themed-view';
import { ThemedText } from '@/shared/components/themed-text';
import { Ionicons } from '@expo/vector-icons';

const FILTER_LABELS: Record<HistoryFilter, string> = {
  'All': 'All time',
  'Today': 'Today',
  'This Week': 'This week',
  'Last Month': 'Last month',
};

/**
 * History screen
 * Shows completed trips with earnings and ratings
 * Matches prepared design from solo_driver_history_1
 */
export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const router = useRouter();
  const { trips, stats, isLoading, error, filter, setFilter, refresh, filteredTrips } = useHistory();
  const [showFilterModal, setShowFilterModal] = useState(false);

  const filterOptions: HistoryFilter[] = ['All', 'Today', 'This Week', 'Last Month'];

  // Group trips by date
  const groupedTrips = React.useMemo(() => {
    const groups: Record<string, typeof filteredTrips> = {};
    
    filteredTrips.forEach((trip) => {
      const dateKey = trip.completedAt.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });
      
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(trip);
    });

    return Object.entries(groups).sort((a, b) => {
      // Sort by date (newest first)
      return new Date(b[0]).getTime() - new Date(a[0]).getTime();
    });
  }, [filteredTrips]);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDateLabel = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }
    return dateString;
  };

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <ThemedText type="title" style={[styles.title, { color: theme.text }]}>
          Trip History
        </ThemedText>
        <View style={styles.headerSpacer} />
      </View>

      {/* Stats Cards */}
      <View style={styles.statsContainer}>
        <View style={[styles.statCard, { backgroundColor: theme.primary }]}>
          <ThemedText style={[styles.statValue, { color: '#111' }]}>
            ₱{stats.totalEarnings.toFixed(2)}
          </ThemedText>
          <ThemedText style={[styles.statLabel, { color: '#111', opacity: 0.8 }]}>
            {filter === 'All' ? 'Total Earnings' : `${filter} Earnings`}
          </ThemedText>
        </View>
        <View style={[styles.statCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <ThemedText style={[styles.statValue, { color: theme.text }]}>
            {stats.totalTrips}
          </ThemedText>
          <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>
            Total Trips
          </ThemedText>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={[styles.searchBar, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Ionicons name="search-outline" size={20} color={theme.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            placeholder="Search location or customer..."
            placeholderTextColor={theme.textSecondary}
          />
        </View>
      </View>

      {/* Period dropdown */}
      <View style={styles.filterDropdownRow}>
        <ThemedText style={[styles.filterDropdownLabel, { color: theme.textSecondary }]}>
          Period
        </ThemedText>
        <TouchableOpacity
          style={[styles.filterDropdown, { backgroundColor: theme.surface, borderColor: theme.border }]}
          onPress={() => setShowFilterModal(true)}
          activeOpacity={0.7}>
          <ThemedText style={[styles.filterDropdownValue, { color: theme.text }]}>
            {FILTER_LABELS[filter]}
          </ThemedText>
          <Ionicons name="chevron-down" size={20} color={theme.textSecondary} />
        </TouchableOpacity>
      </View>

      <Modal
        visible={showFilterModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowFilterModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowFilterModal(false)}>
          <View style={[styles.modalContent, { backgroundColor: theme.surface }]} onStartShouldSetResponder={() => true}>
            <ThemedText style={[styles.modalTitle, { color: theme.text }]}>Time period</ThemedText>
            {filterOptions.map((option) => (
              <TouchableOpacity
                key={option}
                style={[
                  styles.modalOption,
                  filter === option && { backgroundColor: theme.primary + '20' },
                ]}
                onPress={() => {
                  setFilter(option);
                  setShowFilterModal(false);
                }}>
                <ThemedText
                  style={[
                    styles.modalOptionText,
                    { color: theme.text },
                    filter === option && { color: theme.primary, fontWeight: '600' },
                  ]}>
                  {FILTER_LABELS[option]}
                </ThemedText>
                {filter === option && (
                  <Ionicons name="checkmark" size={22} color={theme.primary} />
                )}
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[styles.modalCancel, { borderColor: theme.border }]}
              onPress={() => setShowFilterModal(false)}>
              <ThemedText style={{ color: theme.textSecondary }}>Cancel</ThemedText>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* Trip History List */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refresh} />}
        showsVerticalScrollIndicator={false}>
        {error ? (
          <View style={[styles.errorContainer, { backgroundColor: theme.surface }]}>
            <ThemedText style={[styles.errorText, { color: theme.error }]}>
              {error}
            </ThemedText>
          </View>
        ) : filteredTrips.length === 0 ? (
          <View style={[styles.emptyState, { backgroundColor: theme.surface }]}>
            <Ionicons name="time-outline" size={48} color={theme.textMuted} />
            <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
              No completed trips yet
            </ThemedText>
          </View>
        ) : (
          groupedTrips.map(([dateLabel, dateTrips]) => (
            <View key={dateLabel} style={styles.dateGroup}>
              <ThemedText style={[styles.dateLabel, { color: theme.textSecondary }]}>
                {formatDateLabel(dateLabel)}
              </ThemedText>
              {dateTrips.map((trip) => (
                <TouchableOpacity
                  key={trip.id}
                  style={[
                    styles.tripCard,
                    { backgroundColor: theme.surface, borderColor: theme.border },
                    trip.status === 'Cancelled' && styles.tripCardCancelled,
                  ]}
                  onPress={() => router.push(`/booking/${trip.booking.id}`)}>
                  <View style={styles.tripHeader}>
                    <View style={styles.tripHeaderLeft}>
                      <View
                        style={[
                          styles.statusBadge,
                          {
                            backgroundColor:
                              trip.status === 'Cancelled'
                                ? theme.error + '20'
                                : theme.success + '20',
                          },
                        ]}>
                        <ThemedText
                          style={[
                            styles.statusBadgeText,
                            {
                              color:
                                trip.status === 'Cancelled' ? theme.error : theme.success,
                            },
                          ]}>
                          {trip.status === 'Cancelled' ? 'Canceled' : 'Completed'}
                        </ThemedText>
                      </View>
                      <ThemedText style={[styles.tripTime, { color: theme.textSecondary }]}>
                        {formatTime(trip.completedAt)}
                      </ThemedText>
                    </View>
                    {trip.rating && (
                      <View style={styles.ratingContainer}>
                        <Ionicons name="star" size={16} color={theme.primary} />
                        <ThemedText style={[styles.ratingText, { color: theme.text }]}>
                          {trip.rating.toFixed(1)}
                        </ThemedText>
                      </View>
                    )}
                  </View>

                  <View style={styles.tripRoute}>
                    <View style={styles.timeline}>
                      <View style={[styles.timelineDot, { backgroundColor: theme.textSecondary }]} />
                      <View style={[styles.timelineLine, { backgroundColor: theme.border }]} />
                      <View
                        style={[
                          styles.timelineDot,
                          {
                            backgroundColor:
                              trip.status === 'Cancelled' ? theme.error : theme.primary,
                          },
                        ]}
                      />
                    </View>
                    <View style={styles.tripLocations}>
                      <View style={styles.locationItem}>
                        <ThemedText style={[styles.locationName, { color: theme.text }]} numberOfLines={1}>
                          {trip.booking.pickupLocation}
                        </ThemedText>
                        <ThemedText style={[styles.locationAddress, { color: theme.textSecondary }]} numberOfLines={1}>
                          {trip.booking.pickupLocation.split(',')[0]}
                        </ThemedText>
                      </View>
                      <View style={styles.locationItem}>
                        <ThemedText style={[styles.locationName, { color: theme.text }]} numberOfLines={1}>
                          {trip.booking.dropoffLocation}
                        </ThemedText>
                        <ThemedText style={[styles.locationAddress, { color: theme.textSecondary }]} numberOfLines={1}>
                          {trip.booking.dropoffLocation.split(',')[0]}
                        </ThemedText>
                      </View>
                    </View>
                    <View style={styles.tripEarnings}>
                      <ThemedText
                        style={[
                          styles.earningsAmount,
                          {
                            color:
                              trip.status === 'Cancelled' ? theme.textSecondary : theme.text,
                          },
                        ]}>
                        ₱{trip.earnings.toFixed(2)}
                      </ThemedText>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
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
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 16,
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
  headerSpacer: {
    width: 40,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  searchContainer: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  filterDropdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 12,
  },
  filterDropdownLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  filterDropdown: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    maxWidth: 220,
  },
  filterDropdownValue: {
    fontSize: 16,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 4,
  },
  modalOptionText: {
    fontSize: 16,
  },
  modalCancel: {
    marginTop: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderTopWidth: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  errorContainer: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
  },
  emptyState: {
    padding: 48,
    borderRadius: 12,
    alignItems: 'center',
    gap: 16,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '500',
  },
  dateGroup: {
    marginBottom: 24,
  },
  dateLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 4,
  },
  tripCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  tripCardCancelled: {
    opacity: 0.7,
  },
  tripHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  tripHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  tripTime: {
    fontSize: 12,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: '700',
  },
  tripRoute: {
    flexDirection: 'row',
    gap: 12,
  },
  timeline: {
    alignItems: 'center',
    width: 20,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    marginVertical: 4,
  },
  tripLocations: {
    flex: 1,
    gap: 12,
  },
  locationItem: {
    gap: 4,
  },
  locationName: {
    fontSize: 14,
    fontWeight: '600',
  },
  locationAddress: {
    fontSize: 12,
  },
  tripEarnings: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  earningsAmount: {
    fontSize: 18,
    fontWeight: '700',
  },
});

