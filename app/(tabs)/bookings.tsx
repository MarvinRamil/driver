import React from 'react';
import { StyleSheet, ScrollView, View, RefreshControl, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '@/shared/hooks/use-theme';
import { useBookings, type BookingFilter } from '@/features/bookings';
import { useAuth } from '@/features/auth';
import { ThemedView } from '@/shared/components/themed-view';
import { ThemedText } from '@/shared/components/themed-text';
import { Ionicons } from '@expo/vector-icons';

/**
 * Bookings screen
 * Matches prepared design with timeline view for operator drivers
 */
export default function BookingsScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const { bookings, isLoading, error, refresh, filter, setFilter } = useBookings();

  const isSoloDriver = user?.role === 'Driver';
  const filters: BookingFilter[] = ['All', 'Active', 'Completed'];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active':
      case 'Assigned':
      case 'InProgress':
        return theme.success;
      case 'Upcoming':
      case 'Confirmed':
        return theme.info;
      case 'Completed':
        return theme.textSecondary;
      default:
        return theme.warning;
    }
  };

  const getStatusBadgeColor = (status: string) => {
    const color = getStatusColor(status);
    return {
      backgroundColor: color + '20',
      color: color,
    };
  };

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <ThemedText type="title" style={[styles.title, { color: theme.text }]}>
            {isSoloDriver ? 'My Bookings' : 'Assigned Bookings'}
          </ThemedText>
          <View style={[styles.badge, { backgroundColor: theme.border }]}>
            <ThemedText style={[styles.badgeText, { color: theme.textSecondary }]}>Today</ThemedText>
          </View>
        </View>
      </View>

      {/* Filters */}
      <View style={styles.filtersContainer}>
        {filters.map((filterOption) => (
          <TouchableOpacity
            key={filterOption}
            style={[
              styles.filterButton,
              filter === filterOption
                ? { backgroundColor: theme.primary }
                : { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
            onPress={() => setFilter(filterOption)}>
            <ThemedText
              style={[
                styles.filterText,
                {
                  color: filter === filterOption ? theme.primaryText : theme.text,
                },
              ]}>
              {filterOption}
            </ThemedText>
          </TouchableOpacity>
        ))}
      </View>

      {/* Bookings List */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refresh} />}
        showsVerticalScrollIndicator={false}>
        {error ? (
          <View style={[styles.errorContainer, { backgroundColor: theme.surface }]}>
            <Ionicons name="alert-circle" size={24} color={theme.error} />
            <ThemedText style={[styles.errorText, { color: theme.error }]}>
              {error}
            </ThemedText>
          </View>
        ) : bookings.length === 0 ? (
          <View style={[styles.emptyState, { backgroundColor: theme.surface }]}>
            <Ionicons name="calendar-outline" size={48} color={theme.textMuted} />
            <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
              No bookings found
            </ThemedText>
          </View>
        ) : (
          bookings.map((booking) => {
            const statusColors = getStatusBadgeColor(booking.status);
            const isActive = booking.status === 'Active' || booking.status === 'Assigned' || booking.status === 'InProgress';
            const isUpcoming = booking.status === 'Upcoming' || booking.status === 'Confirmed';

            return (
              <TouchableOpacity
                key={booking.id}
                style={[
                  styles.bookingCard,
                  { backgroundColor: theme.surface, borderColor: theme.border },
                  !isActive && styles.bookingCardInactive,
                ]}
                onPress={() => router.push(`/booking/${booking.id}`)}>
                {/* Left border indicator */}
                <View style={[styles.bookingIndicator, { backgroundColor: theme.primary }]} />

                {/* Booking Header */}
                <View style={styles.bookingHeader}>
                  <View style={styles.bookingHeaderLeft}>
                    <View style={[styles.statusBadge, { backgroundColor: statusColors.backgroundColor }]}>
                      <ThemedText style={[styles.statusBadgeText, { color: statusColors.color }]}>
                        {booking.status}
                      </ThemedText>
                    </View>
                    <ThemedText style={[styles.bookingNumber, { color: theme.textSecondary }]}>
                      {booking.bookingNumber}
                    </ThemedText>
                  </View>
                  <ThemedText style={[styles.bookingAmount, { color: theme.text }]}>
                    ₱{((Math.random() * 50) + 20).toFixed(2)}
                  </ThemedText>
                </View>

                {/* Timeline View */}
                {isActive ? (
                  <View style={styles.bookingTimeline}>
                    <View style={[styles.timelineLine, { backgroundColor: theme.border }]} />
                    <View style={styles.timelineItem}>
                      <View style={[styles.timelineDot, { borderColor: theme.primary }]} />
                      <View style={styles.timelineContent}>
                        <ThemedText style={[styles.timelineTime, { color: theme.textSecondary }]}>
                          Pickup • {new Date(booking.scheduleDate).toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </ThemedText>
                        <ThemedText style={[styles.timelineLocation, { color: theme.text }]} numberOfLines={2}>
                          {booking.pickupLocation}
                        </ThemedText>
                      </View>
                    </View>
                    <View style={styles.timelineItem}>
                      <View style={[styles.timelineDot, { backgroundColor: theme.primary }]} />
                      <View style={styles.timelineContent}>
                        <ThemedText style={[styles.timelineTime, { color: theme.textSecondary }]}>
                          Dropoff • Est. {new Date(new Date(booking.scheduleDate).getTime() + 45 * 60000).toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </ThemedText>
                        <ThemedText style={[styles.timelineLocation, { color: theme.text }]} numberOfLines={2}>
                          {booking.dropoffLocation}
                        </ThemedText>
                      </View>
                    </View>
                  </View>
                ) : (
                  <View style={styles.bookingSimple}>
                    <View style={styles.bookingSimpleItem}>
                      <Ionicons name="time-outline" size={16} color={theme.textSecondary} />
                      <ThemedText style={[styles.bookingSimpleText, { color: theme.text }]}>
                        {new Date(booking.scheduleDate).toLocaleDateString('en-US', {
                          weekday: 'long',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </ThemedText>
                    </View>
                    <View style={styles.bookingSimpleItem}>
                      <Ionicons name="location-outline" size={16} color={theme.textSecondary} />
                      <ThemedText style={[styles.bookingSimpleText, { color: theme.textSecondary }]} numberOfLines={1}>
                        {booking.pickupLocation}
                      </ThemedText>
                    </View>
                  </View>
                )}

                {/* Action Buttons (for active bookings) */}
                {isActive && (
                  <View style={styles.bookingActions}>
                    <TouchableOpacity
                      style={[styles.actionButton, { backgroundColor: theme.border }]}
                      onPress={(e) => {
                        e.stopPropagation();
                        // Handle call
                      }}>
                      <Ionicons name="call-outline" size={16} color={theme.text} />
                      <ThemedText style={[styles.actionButtonText, { color: theme.text }]}>Call</ThemedText>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionButton, { backgroundColor: theme.primary }]}
                      onPress={(e) => {
                        e.stopPropagation();
                        // Handle navigate
                      }}>
                      <Ionicons name="navigate-outline" size={16} color={theme.primaryText} />
                      <ThemedText style={[styles.actionButtonText, { color: theme.primaryText }]}>
                        Navigate
                      </ThemedText>
                    </TouchableOpacity>
                  </View>
                )}
              </TouchableOpacity>
            );
          })
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
    paddingHorizontal: 20,
    paddingTop: 48,
    paddingBottom: 16,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  filtersContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterText: {
    fontSize: 14,
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
    gap: 16,
  },
  errorContainer: {
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
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
  bookingCard: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  bookingCardInactive: {
    opacity: 0.9,
  },
  bookingIndicator: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 6,
  },
  bookingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  bookingHeaderLeft: {
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
    letterSpacing: 0.5,
  },
  bookingNumber: {
    fontSize: 12,
    fontWeight: '500',
  },
  bookingAmount: {
    fontSize: 14,
    fontWeight: '700',
  },
  bookingTimeline: {
    gap: 16,
    marginLeft: 8,
    position: 'relative',
    marginBottom: 16,
  },
  timelineLine: {
    position: 'absolute',
    left: 7,
    top: 8,
    bottom: 8,
    width: 2,
  },
  timelineItem: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  timelineDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 3,
    backgroundColor: '#fff',
    marginTop: 2,
  },
  timelineContent: {
    flex: 1,
    gap: 4,
  },
  timelineTime: {
    fontSize: 12,
    fontWeight: '500',
  },
  timelineLocation: {
    fontSize: 14,
    fontWeight: '600',
  },
  bookingSimple: {
    gap: 12,
    marginBottom: 16,
  },
  bookingSimpleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  bookingSimpleText: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  bookingActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 12,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
