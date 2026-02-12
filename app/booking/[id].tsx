import React, { useEffect, useState } from 'react';
import { StyleSheet, ScrollView, View, TouchableOpacity, Alert, Linking, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/shared/hooks/use-theme';
import { bookingService, dispatchService } from '@/features/bookings';
import { useAuth } from '@/features/auth';
import type { Booking, Dispatch } from '@/shared/types/booking';
import { ThemedView } from '@/shared/components/themed-view';
import { ThemedText } from '@/shared/components/themed-text';
import { SwipeToAccept } from '@/shared/components/SwipeToAccept';
import { Ionicons } from '@expo/vector-icons';

/**
 * Booking Details Screen
 * Displays detailed information about a specific booking
 */
export default function BookingDetailsScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ id: string }>();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [dispatch, setDispatch] = useState<Dispatch | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Check if driver is under operator (needs dispatch)
  const isDriverUnderOperator = user?.tenantId !== null && !user?.isSoloDriver;

  // Helper function to normalize status strings (handle case differences, underscores, etc.)
  const normalizeStatus = (status: string | null | undefined): string => {
    if (!status) return '';
    // Remove all non-alphanumeric characters and convert to lowercase
    return status.replace(/[_\s-]/g, '').toLowerCase();
  };

  useEffect(() => {
    if (!params.id) {
      setError('Booking ID is required');
      setIsLoading(false);
      return;
    }

    fetchBookingDetails();
  }, [params.id]);

  const fetchBookingDetails = async () => {
    if (!params.id) return;

    setIsLoading(true);
    setError(null);

    try {
      // Fetch booking
      const bookingData = await bookingService.getBookingById(params.id);
      setBooking(bookingData);
      
      // Only fetch dispatch if driver is under operator
      if (isDriverUnderOperator) {
        try {
          const dispatchData = await dispatchService.getDispatchByBookingId(params.id);
          setDispatch(dispatchData);
        } catch (dispatchErr) {
          // Dispatch fetch is optional - log but don't fail
          console.warn('[BookingDetails] Dispatch fetch failed (non-critical):', dispatchErr);
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load booking details';
      setError(errorMessage);
      console.error('Error fetching booking details:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCall = () => {
    // TODO: Get customer phone number from booking or API
    Alert.alert('Call Customer', 'Phone number not available');
  };

  const handleNavigate = () => {
    if (!booking) return;

    const pickupCoords = booking.pickupLatitude && booking.pickupLongitude
      ? `${booking.pickupLatitude},${booking.pickupLongitude}`
      : null;

    if (pickupCoords) {
      // Open in default maps app
      const url = Platform.select({
        ios: `maps://app?daddr=${pickupCoords}&dirflg=d`,
        android: `google.navigation:q=${pickupCoords}`,
      });

      if (url) {
        Linking.openURL(url).catch((err) => {
          console.error('Error opening maps:', err);
          Alert.alert('Error', 'Could not open maps app');
        });
      } else {
        // Fallback to Google Maps web
        Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${pickupCoords}`).catch((err) => {
          console.error('Error opening maps:', err);
        });
      }
    } else {
      Alert.alert('Location Not Available', 'Pickup location coordinates are not available');
    }
  };

  const handleStartTransport = async () => {
    if (!booking || isUpdatingStatus) {
      Alert.alert('Error', 'Booking not found');
      return;
    }

    setIsUpdatingStatus(true);
    try {
      // Update booking status to DriverAssigned - driver going to pickup location
      const updatedBooking = await bookingService.updateBookingStatus(booking.id, 'DriverAssigned');
      setBooking(updatedBooking);
      
      Alert.alert('Success', 'Transport started. Navigate to the pickup location.', [{ text: 'OK' }]);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update status';
      Alert.alert('Error', errorMessage);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleMarkAsPickedUp = async () => {
    if (!booking || isUpdatingStatus) {
      Alert.alert('Error', 'Booking not found');
      return;
    }

    setIsUpdatingStatus(true);
    try {
      // Update booking status to PickedUp
      const updatedBooking = await bookingService.updateBookingStatus(booking.id, 'PickedUp');
      setBooking(updatedBooking);
      
      // Refresh dispatch if driver is under operator
      if (isDriverUnderOperator) {
        setTimeout(async () => {
          try {
            const updatedDispatch = await dispatchService.getDispatchByBookingId(booking.id);
            if (updatedDispatch) {
              setDispatch(updatedDispatch);
            }
          } catch (dispatchErr) {
            console.warn('Failed to refresh dispatch (non-critical):', dispatchErr);
          }
        }, 500);
      }
      
      Alert.alert('Success', 'Cargo marked as picked up. You can now proceed to delivery.', [{ text: 'OK' }]);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update status';
      Alert.alert('Error', errorMessage);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleMarkAsDelivered = async () => {
    if (!booking || isUpdatingStatus) return;

    Alert.alert(
      'Mark as Delivered?',
      'Have you successfully delivered the cargo to the destination?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          style: 'default',
          onPress: async () => {
            setIsUpdatingStatus(true);
            try {
              // Update booking status to Delivered
              const updatedBooking = await bookingService.updateBookingStatus(booking.id, 'Delivered');
              setBooking(updatedBooking);
              
              // Refresh dispatch if driver is under operator
              if (isDriverUnderOperator) {
                setTimeout(async () => {
                  try {
                    const updatedDispatch = await dispatchService.getDispatchByBookingId(booking.id);
                    if (updatedDispatch) {
                      setDispatch(updatedDispatch);
                    }
                  } catch (dispatchErr) {
                    console.warn('Failed to refresh dispatch (non-critical):', dispatchErr);
                  }
                }, 500);
              }

              Alert.alert('Success', 'Cargo delivered successfully!', [{ text: 'OK' }]);
              
              // Auto-complete after a short delay
              setTimeout(async () => {
                try {
                  await bookingService.updateBookingStatus(booking.id, 'Completed');
                  await fetchBookingDetails(); // Refresh to show completed status
                } catch (err) {
                  console.warn('Failed to mark as completed:', err);
                }
              }, 2000);
            } catch (err) {
              const errorMessage = err instanceof Error ? err.message : 'Failed to update status';
              Alert.alert('Error', errorMessage);
            } finally {
              setIsUpdatingStatus(false);
            }
          },
        },
      ]
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active':
      case 'Assigned':
      case 'InProgress':
        return theme.success;
      case 'Upcoming':
      case 'Confirmed':
      case 'Dispatched':
      case 'OnTheWayToPickup':
        return theme.info;
      case 'Delivered':
        return theme.success;
      case 'Completed':
        return theme.textSecondary;
      case 'Cancelled':
        return theme.error;
      default:
        return theme.warning;
    }
  };

  if (isLoading) {
    return (
      <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <ThemedText type="title" style={[styles.headerTitle, { color: theme.text }]}>
            Booking Details
          </ThemedText>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.loadingContainer}>
          <ThemedText style={[styles.loadingText, { color: theme.textSecondary }]}>
            Loading...
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  if (error || !booking) {
    return (
      <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <ThemedText type="title" style={[styles.headerTitle, { color: theme.text }]}>
            Booking Details
          </ThemedText>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={theme.error} />
          <ThemedText style={[styles.errorText, { color: theme.error }]}>
            {error || 'Booking not found'}
          </ThemedText>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: theme.primary }]}
            onPress={fetchBookingDetails}>
            <ThemedText style={[styles.retryButtonText, { color: theme.primaryText }]}>
              Retry
            </ThemedText>
          </TouchableOpacity>
        </View>
      </ThemedView>
    );
  }

  const statusColor = getStatusColor(booking.status);
  const isActive = ['Active', 'Assigned', 'InProgress', 'Dispatched', 'OnTheWayToPickup', 'Delivered', 'Confirmed'].includes(booking.status);

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <ThemedText type="title" style={[styles.headerTitle, { color: theme.text }]}>
          Booking Details
        </ThemedText>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        
        {/* Booking Header Card */}
        <View style={[styles.bookingHeaderCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.bookingHeaderTop}>
            <View style={styles.bookingNumberContainer}>
              <ThemedText style={[styles.bookingNumber, { color: theme.textSecondary }]}>
                {booking.bookingNumber}
              </ThemedText>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
              <ThemedText style={[styles.statusBadgeText, { color: statusColor }]}>
                {booking.status}
              </ThemedText>
            </View>
          </View>
          <View style={styles.bookingMeta}>
            <View style={styles.metaItem}>
              <Ionicons name="calendar-outline" size={16} color={theme.textSecondary} />
              <ThemedText style={[styles.metaText, { color: theme.textSecondary }]}>
                {new Date(booking.scheduleDate).toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </ThemedText>
            </View>
            <View style={styles.metaItem}>
              <Ionicons name="time-outline" size={16} color={theme.textSecondary} />
              <ThemedText style={[styles.metaText, { color: theme.textSecondary }]}>
                {new Date(booking.scheduleDate).toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </ThemedText>
            </View>
          </View>
        </View>

        {/* Timeline */}
        <View style={[styles.timelineCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <ThemedText type="subtitle" style={[styles.sectionTitle, { color: theme.text }]}>
            Route
          </ThemedText>
          
          <View style={styles.timeline}>
            <View style={[styles.timelineLine, { backgroundColor: theme.border }]} />
            
            {/* Pickup */}
            <View style={styles.timelineItem}>
              <View style={[styles.timelineDot, { borderColor: theme.primary }]} />
              <View style={styles.timelineContent}>
                <ThemedText style={[styles.timelineLabel, { color: theme.textSecondary }]}>
                  Pickup Location
                </ThemedText>
                <ThemedText style={[styles.timelineValue, { color: theme.text }]}>
                  {booking.pickupLocation}
                </ThemedText>
                {booking.pickupLatitude && booking.pickupLongitude && (
                  <ThemedText style={[styles.timelineCoords, { color: theme.textMuted }]}>
                    {booking.pickupLatitude.toFixed(6)}, {booking.pickupLongitude.toFixed(6)}
                  </ThemedText>
                )}
              </View>
            </View>

            {/* Dropoff */}
            <View style={styles.timelineItem}>
              <View style={[styles.timelineDot, { backgroundColor: theme.primary }]} />
              <View style={styles.timelineContent}>
                <ThemedText style={[styles.timelineLabel, { color: theme.textSecondary }]}>
                  Delivery Location
                </ThemedText>
                <ThemedText style={[styles.timelineValue, { color: theme.text }]}>
                  {booking.dropoffLocation}
                </ThemedText>
                {booking.dropoffLatitude && booking.dropoffLongitude && (
                  <ThemedText style={[styles.timelineCoords, { color: theme.textMuted }]}>
                    {booking.dropoffLatitude.toFixed(6)}, {booking.dropoffLongitude.toFixed(6)}
                  </ThemedText>
                )}
              </View>
            </View>
          </View>
        </View>

        {/* Cargo Details */}
        <View style={[styles.detailsCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <ThemedText type="subtitle" style={[styles.sectionTitle, { color: theme.text }]}>
            Cargo Details
          </ThemedText>
          
          <View style={styles.detailsGrid}>
            <View style={styles.detailItem}>
              <ThemedText style={[styles.detailLabel, { color: theme.textSecondary }]}>
                Truck Type
              </ThemedText>
              <ThemedText style={[styles.detailValue, { color: theme.text }]}>
                {booking.truckType}
              </ThemedText>
            </View>
            
            {booking.weightKg && (
              <View style={styles.detailItem}>
                <ThemedText style={[styles.detailLabel, { color: theme.textSecondary }]}>
                  Weight
                </ThemedText>
                <ThemedText style={[styles.detailValue, { color: theme.text }]}>
                  {booking.weightKg} kg
                </ThemedText>
              </View>
            )}
            
            {booking.size && (
              <View style={styles.detailItem}>
                <ThemedText style={[styles.detailLabel, { color: theme.textSecondary }]}>
                  Size
                </ThemedText>
                <ThemedText style={[styles.detailValue, { color: theme.text }]}>
                  {booking.size}
                </ThemedText>
              </View>
            )}
          </View>

          {booking.cargoDescription && (
            <View style={styles.descriptionContainer}>
              <ThemedText style={[styles.detailLabel, { color: theme.textSecondary }]}>
                Description
              </ThemedText>
              <ThemedText style={[styles.descriptionText, { color: theme.text }]}>
                {booking.cargoDescription}
              </ThemedText>
            </View>
          )}

          {booking.notes && (
            <View style={styles.notesContainer}>
              <ThemedText style={[styles.detailLabel, { color: theme.textSecondary }]}>
                Notes
              </ThemedText>
              <ThemedText style={[styles.notesText, { color: theme.text }]}>
                {booking.notes}
              </ThemedText>
            </View>
          )}
        </View>

        {/* Action Buttons */}
        {isActive && (
          <View style={styles.actionsContainer}>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: theme.border }]}
              onPress={handleCall}>
              <Ionicons name="call-outline" size={20} color={theme.text} />
              <ThemedText style={[styles.actionButtonText, { color: theme.text }]}>
                Call Customer
              </ThemedText>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: theme.primary }]}
              onPress={handleNavigate}>
              <Ionicons name="navigate-outline" size={20} color={theme.primaryText} />
              <ThemedText style={[styles.actionButtonText, { color: theme.primaryText }]}>
                Navigate
              </ThemedText>
            </TouchableOpacity>
          </View>
        )}

        {/* Status Update Buttons */}
        {booking && (() => {
          // Check booking status (handle both new and legacy status names)
          const bookingStatus = booking.status;
          const isConfirmed = bookingStatus === 'Confirmed';
          const isDriverAssigned = bookingStatus === 'DriverAssigned' || bookingStatus === 'OnTheWayToPickup' || bookingStatus === 'Dispatched';
          const isPickedUp = bookingStatus === 'PickedUp';
          const isInTransit = bookingStatus === 'InTransit' || bookingStatus === 'InProgress';
          const isDelivered = bookingStatus === 'Delivered';
          const isCompleted = bookingStatus === 'Completed';

          // Don't show buttons if already completed
          if (isCompleted) {
            return null;
          }

          return (
            <View style={styles.statusUpdateContainer}>
              {/* Start Transport - Show when booking is Confirmed */}
              {/* Driver starts going to pickup location */}
              {isConfirmed && (
                <TouchableOpacity
                  style={[
                    styles.statusUpdateButton,
                    { backgroundColor: theme.info, opacity: isUpdatingStatus ? 0.6 : 1 },
                  ]}
                  onPress={handleStartTransport}
                  disabled={isUpdatingStatus}>
                  <Ionicons name="play-circle-outline" size={24} color={theme.surface} />
                  <ThemedText style={[styles.statusUpdateButtonText, { color: theme.surface }]}>
                    {isUpdatingStatus ? 'Updating...' : 'Start Transport'}
                  </ThemedText>
                </TouchableOpacity>
              )}

              {/* On The Way to Pickup Indicator */}
              {isDriverAssigned && (
                <View style={styles.inTransitIndicator}>
                  <Ionicons name="navigate-outline" size={20} color={theme.info} />
                  <ThemedText style={[styles.inTransitText, { color: theme.info }]}>
                    On The Way to Pickup Location
                  </ThemedText>
                </View>
              )}

              {/* Swipe to Mark as Picked Up - Show when booking is DriverAssigned */}
              {isDriverAssigned && (
                <View style={styles.swipeContainer}>
                  <SwipeToAccept
                    label="Swipe to mark pickup complete"
                    onAccept={handleMarkAsPickedUp}
                    disabled={isUpdatingStatus}
                    trackColor={theme.border}
                    thumbColor={theme.warning}
                    textColor={theme.text}
                    style={styles.swipeButton}
                  />
                </View>
              )}

              {/* In Transit Indicator - Show when booking is PickedUp */}
              {isPickedUp && (
                <View style={styles.inTransitIndicator}>
                  <Ionicons name="car-outline" size={20} color={theme.info} />
                  <ThemedText style={[styles.inTransitText, { color: theme.info }]}>
                    Cargo Picked Up - On Transit to Delivery
                  </ThemedText>
                </View>
              )}

              {/* In Transit Indicator - Show when booking is InTransit */}
              {isInTransit && (
                <View style={styles.inTransitIndicator}>
                  <Ionicons name="car-outline" size={20} color={theme.info} />
                  <ThemedText style={[styles.inTransitText, { color: theme.info }]}>
                    Cargo Picked Up - On Transit to Delivery
                  </ThemedText>
                </View>
              )}

              {/* Mark as Delivered - Show when booking is PickedUp or InTransit */}
              {(isPickedUp || isInTransit) && (
                <TouchableOpacity
                  style={[
                    styles.statusUpdateButton,
                    { backgroundColor: theme.success, opacity: isUpdatingStatus ? 0.6 : 1 },
                  ]}
                  onPress={handleMarkAsDelivered}
                  disabled={isUpdatingStatus}>
                  <Ionicons name="checkmark-done-outline" size={24} color={theme.surface} />
                  <ThemedText style={[styles.statusUpdateButtonText, { color: theme.surface }]}>
                    {isUpdatingStatus ? 'Updating...' : 'Mark as Delivered'}
                  </ThemedText>
                </TouchableOpacity>
              )}

              {/* Delivered Indicator - Show when booking is Delivered */}
              {isDelivered && (
                <View style={styles.inTransitIndicator}>
                  <Ionicons name="checkmark-circle" size={20} color={theme.success} />
                  <ThemedText style={[styles.inTransitText, { color: theme.success }]}>
                    Cargo Delivered - Completing...
                  </ThemedText>
                </View>
              )}
            </View>
          );
        })()}

        {/* Extra spacing for bottom */}
        <View style={{ height: 20 }} />
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
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  placeholder: {
    width: 40,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  loadingText: {
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    gap: 16,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    gap: 16,
  },
  bookingHeaderCard: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
  },
  bookingHeaderTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  bookingNumberContainer: {
    flex: 1,
  },
  bookingNumber: {
    fontSize: 14,
    fontWeight: '500',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  bookingMeta: {
    gap: 8,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metaText: {
    fontSize: 14,
  },
  timelineCard: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 16,
  },
  timeline: {
    gap: 24,
    marginLeft: 8,
    position: 'relative',
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
    marginTop: 2,
  },
  timelineContent: {
    flex: 1,
    gap: 4,
  },
  timelineLabel: {
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  timelineValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  timelineCoords: {
    fontSize: 12,
  },
  detailsCard: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
  },
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 16,
  },
  detailItem: {
    minWidth: '45%',
    gap: 4,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  descriptionContainer: {
    marginTop: 8,
    gap: 8,
  },
  descriptionText: {
    fontSize: 14,
    lineHeight: 20,
  },
  notesContainer: {
    marginTop: 16,
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.05)',
    gap: 8,
  },
  notesText: {
    fontSize: 14,
    lineHeight: 20,
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  statusUpdateContainer: {
    gap: 12,
    marginTop: 8,
  },
  statusUpdateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 12,
  },
  statusUpdateButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  inTransitIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  inTransitText: {
    fontSize: 16,
    fontWeight: '600',
  },
  swipeContainer: {
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  swipeButton: {
    height: 56,
    borderRadius: 28,
  },
});

