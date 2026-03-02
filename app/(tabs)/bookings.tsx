import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, ScrollView, View, RefreshControl, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '@/shared/hooks/use-theme';
import { useBookings, type BookingFilter } from '@/features/bookings';
import { useAuth } from '@/features/auth';
import {
  useOffers,
  getPickupAddress,
  getDropoffAddress,
  isMultiStopOffer,
  getTimeRemaining,
  filterValidOffers,
  OfferDetailsModal,
} from '@/features/offers';
import type { DriverOffer } from '@/features/offers';
import { useDriverStatusContext } from '@/features/driver/context/DriverStatusContext';
import { ThemedView } from '@/shared/components/themed-view';
import { ThemedText } from '@/shared/components/themed-text';
import { Ionicons } from '@expo/vector-icons';

/**
 * Bookings screen
 * Matches prepared design with timeline view for operator drivers
 */
type TabType = 'INCOMING' | 'ONGOING' | 'COMPLETED' | 'CANCELLED';

export default function BookingsScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const { isOnline } = useDriverStatusContext();
  const { bookings, isLoading: bookingsLoading, error, refresh: refreshBookings, allBookings } = useBookings();
  const { offers, isLoading: offersLoading, refresh: refreshOffers, acceptOffer, rejectOffer } = useOffers({ limit: 10, pollingInterval: 5000 });

  const [activeTab, setActiveTab] = useState<TabType>('INCOMING');
  const [selectedOffer, setSelectedOffer] = useState<DriverOffer | null>(null);
  const [showOfferDetails, setShowOfferDetails] = useState(false);

  // Filter valid (non-expired) offers
  const validOffers = filterValidOffers(offers);
  const validOffersRef = useRef(validOffers);
  validOffersRef.current = validOffers;

  // Countdown timer state for offers
  const [timeRemaining, setTimeRemaining] = useState<Record<string, number>>({});
  const [acceptingOfferId, setAcceptingOfferId] = useState<string | null>(null);

  // Update countdown timers every second
  useEffect(() => {
    const interval = setInterval(() => {
      const current = validOffersRef.current;
      const timers: Record<string, number> = {};
      current.forEach((offer) => {
        timers[offer.id] = getTimeRemaining(offer);
      });
      setTimeRemaining(timers);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const isSoloDriver = user?.role === 'Driver';

  // Filter bookings based on active tab
  const filteredBookings = React.useMemo(() => {
    if (activeTab === 'INCOMING') {
      return []; // INCOMING shows offers, not bookings
    }
    if (activeTab === 'ONGOING') {
      // Show Confirmed + active/in-progress bookings
      return allBookings.filter((booking) => {
        const status = booking.status;
        return status === 'Confirmed' ||
          status === 'DriverAssigned' ||
          status === 'OnTheWayToPickup' ||
          status === 'PickedUp' ||
          status === 'InTransit' ||
          status === 'InProgress';
      });
    }
    if (activeTab === 'COMPLETED') {
      // Show completed bookings
      return allBookings.filter((booking) => {
        const status = booking.status;
        return status === 'Completed' || status === 'Delivered';
      });
    }
    if (activeTab === 'CANCELLED') {
      // Show cancelled bookings
      return allBookings.filter((booking) => {
        return booking.status === 'Cancelled';
      });
    }
    return [];
  }, [activeTab, allBookings]);

  const isLoading = activeTab === 'INCOMING' ? offersLoading : bookingsLoading;

  const refresh = async () => {
    if (activeTab === 'INCOMING') {
      await refreshOffers();
    } else {
      await refreshBookings();
    }
  };

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
      {/* Full-Width Header Tabs */}
      <View style={[styles.headerTabsContainer, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        {(['INCOMING', 'ONGOING', 'COMPLETED', 'CANCELLED'] as TabType[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[
              styles.headerTab,
              activeTab === tab && { borderBottomWidth: 3, borderBottomColor: theme.primary },
            ]}
            onPress={() => setActiveTab(tab)}>
            <ThemedText
              style={[
                styles.headerTabText,
                {
                  color: activeTab === tab ? theme.primary : theme.textSecondary,
                  fontWeight: activeTab === tab ? '700' : '500',
                },
              ]}>
              {tab}
            </ThemedText>
            {tab === 'INCOMING' && validOffers.length > 0 && (
              <View style={[styles.tabBadge, { backgroundColor: theme.primary }]}>
                <ThemedText style={[styles.tabBadgeText, { color: theme.primaryText }]}>
                  {validOffers.length}
                </ThemedText>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Content List */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refresh} />}
        showsVerticalScrollIndicator={false}>
        {activeTab === 'INCOMING' ? (
          // INCOMING: Show offers
          !isOnline ? (
            <View style={[styles.emptyState, { backgroundColor: theme.surface }]}>
              <Ionicons name="power-outline" size={48} color={theme.textMuted} />
              <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
                Go online to receive offers
              </ThemedText>
            </View>
          ) : validOffers.length === 0 ? (
            <View style={[styles.emptyState, { backgroundColor: theme.surface }]}>
              <Ionicons name="megaphone-outline" size={48} color={theme.textMuted} />
              <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
                No new offers available
              </ThemedText>
            </View>
          ) : (
            validOffers.map((offer) => {
              const remaining = timeRemaining[offer.id] ?? getTimeRemaining(offer);
              const minutes = Math.floor(remaining / 60);
              const seconds = remaining % 60;
              const isExpiringSoon = remaining < 60;

              return (
                <View
                  key={offer.id}
                  style={[styles.offerCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <View style={[styles.offerIndicator, { backgroundColor: isExpiringSoon ? theme.error : theme.warning }]} />
                  <View style={styles.offerHeader}>
                    <View style={styles.offerHeaderLeft}>
                      <View style={[styles.statusBadge, { backgroundColor: theme.primary + '20' }]}>
                        <ThemedText style={[styles.statusBadgeText, { color: theme.primary }]}>
                          NEW
                        </ThemedText>
                      </View>
                      <ThemedText style={[styles.bookingNumber, { color: theme.textSecondary }]}>
                        {offer.bookingNumber}
                      </ThemedText>
                    </View>
                    <View style={styles.offerAmountContainer}>
                      <ThemedText style={[styles.offerAmount, { color: theme.text }]}>
                        ₱{offer.estimatedFare.toFixed(2)}
                      </ThemedText>
                      {offer.distanceKm && (
                        <ThemedText style={[styles.offerDistance, { color: theme.textSecondary }]}>
                          {offer.distanceKm.toFixed(1)} km
                        </ThemedText>
                      )}
                    </View>
                  </View>

                  {/* Countdown Timer */}
                  <View style={[styles.countdownContainer, { backgroundColor: isExpiringSoon ? theme.error + '10' : theme.border + '40' }]}>
                    <Ionicons
                      name="time-outline"
                      size={14}
                      color={isExpiringSoon ? theme.error : theme.textSecondary}
                    />
                    <ThemedText style={[styles.countdownText, { color: isExpiringSoon ? theme.error : theme.textSecondary }]}>
                      {remaining > 0
                        ? `Expires in ${minutes}:${seconds.toString().padStart(2, '0')}`
                        : 'Expired'}
                    </ThemedText>
                  </View>

                  <View style={styles.offerTimeline}>
                    <View style={[styles.timelineLine, { backgroundColor: theme.border }]} />
                    <View style={styles.timelineItem}>
                      <View style={[styles.timelineDot, { backgroundColor: theme.surface, borderColor: theme.primary }]} />
                      <View style={styles.timelineContent}>
                        <ThemedText style={[styles.timelineTime, { color: theme.textSecondary }]}>
                          Pickup • {new Date(offer.scheduleDate).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                        </ThemedText>
                        <ThemedText style={[styles.timelineLocation, { color: theme.text }]}>
                          {getPickupAddress(offer)}
                        </ThemedText>
                      </View>
                    </View>
                    {isMultiStopOffer(offer) ? (
                      <View style={styles.timelineItem}>
                        <View style={[styles.timelineDot, { backgroundColor: theme.primary, borderColor: theme.primary }]} />
                        <View style={styles.timelineContent}>
                          <ThemedText style={[styles.timelineTime, { color: theme.textSecondary }]}>
                            Multi-stop ({offer.stops.filter(s => s.type === 'Dropoff').length} stops)
                          </ThemedText>
                          <ThemedText style={[styles.timelineLocation, { color: theme.text }]}>
                            {getDropoffAddress(offer)}
                          </ThemedText>
                        </View>
                      </View>
                    ) : (
                      <View style={styles.timelineItem}>
                        <View style={[styles.timelineDot, { backgroundColor: theme.primary, borderColor: theme.primary }]} />
                        <View style={styles.timelineContent}>
                          <ThemedText style={[styles.timelineTime, { color: theme.textSecondary }]}>
                            Delivery
                          </ThemedText>
                          <ThemedText style={[styles.timelineLocation, { color: theme.text }]}>
                            {getDropoffAddress(offer)}
                          </ThemedText>
                        </View>
                      </View>
                    )}
                  </View>

                  {offer.cargoDescription && (
                    <View style={styles.cargoInfo}>
                      <Ionicons name="cube-outline" size={14} color={theme.textSecondary} />
                      <ThemedText style={[styles.cargoText, { color: theme.textSecondary }]}>
                        {offer.cargoDescription}
                      </ThemedText>
                    </View>
                  )}

                  <TouchableOpacity
                    style={[styles.viewDetailsButton, { backgroundColor: theme.primary + '20', borderColor: theme.primary }]}
                    onPress={() => {
                      setSelectedOffer(offer);
                      setShowOfferDetails(true);
                    }}
                  >
                    <Ionicons name="map-outline" size={18} color={theme.primary} />
                    <ThemedText style={[styles.viewDetailsButtonText, { color: theme.primary }]}>
                      View Details
                    </ThemedText>
                    <Ionicons name="chevron-forward" size={18} color={theme.primary} />
                  </TouchableOpacity>
                </View>
              );
            })
          )
        ) : error ? (
          <View style={[styles.errorContainer, { backgroundColor: theme.surface }]}>
            <Ionicons name="alert-circle" size={24} color={theme.error} />
            <ThemedText style={[styles.errorText, { color: theme.error }]}>
              {error}
            </ThemedText>
          </View>
        ) : filteredBookings.length === 0 ? (
          <View style={[styles.emptyState, { backgroundColor: theme.surface }]}>
            <Ionicons name="calendar-outline" size={48} color={theme.textMuted} />
            <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
              {activeTab === 'ONGOING'
                ? 'No ongoing bookings'
                : activeTab === 'COMPLETED'
                  ? 'No completed bookings'
                  : activeTab === 'CANCELLED'
                    ? 'No cancelled bookings'
                    : 'No bookings'}
            </ThemedText>
            <ThemedText style={[{ color: theme.textMuted, fontSize: 14, marginTop: 8 }]}>
              Pull down to refresh
            </ThemedText>
          </View>
        ) : (
          filteredBookings.map((booking) => {
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
                    ₱{(booking.finalFare ?? booking.estimatedFare ?? 0).toFixed(2)}
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

      <OfferDetailsModal
        visible={showOfferDetails}
        offer={selectedOffer}
        onClose={() => {
          setShowOfferDetails(false);
          setSelectedOffer(null);
        }}
        onAccept={async (offerId, bookingId) => {
          setAcceptingOfferId(offerId);
          try {
            await acceptOffer(offerId);
            if (bookingId) {
              router.push(`/booking/${bookingId}`);
            } else {
              Alert.alert('Success', 'Offer accepted! Check your bookings.');
            }
          } finally {
            setAcceptingOfferId(null);
          }
        }}
        onReject={rejectOffer}
        acceptingOfferId={acceptingOfferId}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerTabsContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    paddingTop: 48,
  },
  headerTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    flexDirection: 'row',
    gap: 8,
  },
  headerTabText: {
    fontSize: 16,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tabBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  tabBadgeText: {
    fontSize: 11,
    fontWeight: '700',
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
  // Offer card styles
  offerCard: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    position: 'relative',
    overflow: 'hidden',
    marginBottom: 16,
  },
  offerIndicator: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 6,
  },
  offerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  offerHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  offerAmountContainer: {
    alignItems: 'flex-end',
  },
  offerAmount: {
    fontSize: 18,
    fontWeight: '700',
  },
  offerDistance: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  countdownContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 12,
    alignSelf: 'flex-start',
  },
  countdownText: {
    fontSize: 12,
    fontWeight: '600',
  },
  offerTimeline: {
    gap: 16,
    marginLeft: 8,
    position: 'relative',
    marginBottom: 12,
  },
  cargoInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    marginBottom: 4,
  },
  cargoText: {
    fontSize: 12,
    flex: 1,
  },
  viewDetailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    marginTop: 12,
    marginBottom: 4,
  },
  viewDetailsButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
