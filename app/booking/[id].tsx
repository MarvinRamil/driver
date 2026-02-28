import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  ScrollView,
  View,
  TouchableOpacity,
  Alert,
  Linking,
  Platform,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '@/shared/hooks/use-theme';
import { bookingService, dispatchService } from '@/features/bookings';
import { CancelBookingModal } from '@/features/bookings/components/CancelBookingModal';
import { useAuth } from '@/features/auth';
import { useDriverStatusContext } from '@/features/driver/context/DriverStatusContext';
import { locationTrackingService } from '@/features/driver/services/locationTrackingService';
import type { Booking, Dispatch, CancellationReason } from '@/shared/types/booking';
import { ThemedView } from '@/shared/components/themed-view';
import { ThemedText } from '@/shared/components/themed-text';
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
  const { isOnline } = useDriverStatusContext();
  const params = useLocalSearchParams<{ id: string }>();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [dispatch, setDispatch] = useState<Dispatch | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [showPodModal, setShowPodModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [podImageUri, setPodImageUri] = useState<string | null>(null);
  const [podSignatureUri, setPodSignatureUri] = useState<string | null>(null);
  const [podRecipientName, setPodRecipientName] = useState('');
  const [podNotes, setPodNotes] = useState('');
  const [selectedPodStopId, setSelectedPodStopId] = useState<string | null>(null);

  // Check if driver is under operator (needs dispatch)
  const isDriverUnderOperator = user?.tenantId !== null && !user?.isSoloDriver;

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

    const orderedStops = (booking.stops ?? []).slice().sort((a, b) => a.sequence - b.sequence);
    const nextSuggestedStop =
      orderedStops.find((s) => s.status === 'Arrived') ??
      orderedStops.find((s) => s.status !== 'Completed');
    const targetCoords =
      nextSuggestedStop?.latitude != null && nextSuggestedStop?.longitude != null
        ? `${nextSuggestedStop.latitude},${nextSuggestedStop.longitude}`
        : booking.pickupLatitude != null && booking.pickupLongitude != null
          ? `${booking.pickupLatitude},${booking.pickupLongitude}`
          : null;

    if (targetCoords) {
      // Open in default maps app
      const url = Platform.select({
        ios: `maps://app?daddr=${targetCoords}&dirflg=d`,
        android: `google.navigation:q=${targetCoords}`,
      });

      if (url) {
        Linking.openURL(url).catch((err) => {
          console.error('Error opening maps:', err);
          Alert.alert('Error', 'Could not open maps app');
        });
      } else {
        // Fallback to Google Maps web
        Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${targetCoords}`).catch((err) => {
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
      // Ensure driver is online and location tracking is active
      if (!isOnline) {
        Alert.alert(
          'Driver Offline',
          'Please go online first to start location tracking.',
          [{ text: 'OK' }]
        );
        setIsUpdatingStatus(false);
        return;
      }

      // Ensure location tracking is started (in case it stopped for some reason)
      const isTracking = locationTrackingService.getIsTracking();
      if (!isTracking && user?.id) {
        try {
          console.log('[BookingDetails] Starting location tracking for transport');
          locationTrackingService.setDriverId(user.id);
          const hasPermission = await locationTrackingService.hasPermissions();
          if (hasPermission) {
            await locationTrackingService.startTracking(5000, user.id);
          } else {
            const granted = await locationTrackingService.requestPermissions();
            if (granted) {
              await locationTrackingService.startTracking(5000, user.id);
            } else {
              Alert.alert(
                'Location Permission Required',
                'Location permission is required to track your position during transport.',
                [{ text: 'OK' }]
              );
              setIsUpdatingStatus(false);
              return;
            }
          }
        } catch (locationError) {
          console.warn('[BookingDetails] Failed to start location tracking:', locationError);
          // Continue anyway - location tracking might already be active via DriverStatusContext
        }
      }

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

  const handleSingleStopPickupComplete = async (pickupStopId: string) => {
    if (!booking || isUpdatingStatus) return;

    setIsUpdatingStatus(true);
    try {
      // For lesser clicks, if stop is Pending or OnTheWay, simulate Arrive first
      const stop = orderedStops.find((s) => s.id === pickupStopId);
      if (stop && (stop.status === 'Pending' || stop.status === 'OnTheWay')) {
        try {
          await bookingService.arriveStop(booking.id, pickupStopId);
        } catch (err) {
          console.warn('Arrive failed, continuing to complete:', err);
        }
      }

      // Complete the pickup stop
      const updated = await bookingService.completeStop(booking.id, pickupStopId);
      setBooking(updated);

      // Update booking status to PickedUp (not InTransit for single-stop)
      const bookingUpdated = await bookingService.updateBookingStatus(booking.id, 'PickedUp');
      setBooking(bookingUpdated);

      if (isDriverUnderOperator) {
        const d = await dispatchService.getDispatchByBookingId(booking.id).catch(() => null);
        if (d) setDispatch(d);
      }

      Alert.alert('Success', 'Cargo marked as picked up. You can now proceed to delivery.', [{ text: 'OK' }]);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to complete pickup');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const orderedStops = (booking?.stops ?? []).slice().sort((a, b) => a.sequence - b.sequence);
  const dropoffStops = orderedStops.filter((s) => s.type === 'Dropoff');
  const completedDropoffs = dropoffStops.filter((s) => s.status === 'Completed').length;
  const nextSuggestedStop =
    orderedStops.find((s) => s.status === 'Arrived') ??
    orderedStops.find((s) => s.status !== 'Completed');

  // Helper function to detect single-stop bookings (1 pickup + 1 dropoff)
  const isSingleStopBooking = (stops: typeof orderedStops): boolean => {
    if (!stops || stops.length === 0) return false;
    const dropoffCount = stops.filter(s => s.type === 'Dropoff').length;
    return dropoffCount === 1; // 1 pickup + 1 dropoff = single stop
  };

  const isSingleStop = isSingleStopBooking(orderedStops);

  const pickPodImage = async (type: 'delivery' | 'signature') => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo library access to add the delivery photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    if (type === 'delivery') setPodImageUri(result.assets[0].uri);
    else setPodSignatureUri(result.assets[0].uri);
  };

  const handleOpenPodModal = (stopId: string) => {
    setSelectedPodStopId(stopId);
    setPodImageUri(null);
    setPodSignatureUri(null);
    setPodRecipientName('');
    setPodNotes('');
    setShowPodModal(true);
  };

  const handleOnTheWayStop = async (stopId: string) => {
    if (!booking || isUpdatingStatus) return;
    setIsUpdatingStatus(true);
    try {
      const updated = await bookingService.onTheWayStop(booking.id, stopId);
      setBooking(updated);
      if (isDriverUnderOperator) {
        const d = await dispatchService.getDispatchByBookingId(booking.id).catch(() => null);
        if (d) setDispatch(d);
      }
      Alert.alert('Success', 'Stop marked as on the way.', [{ text: 'OK' }]);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to update stop status');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleArriveStop = async (stopId: string) => {
    if (!booking || isUpdatingStatus) return;
    setIsUpdatingStatus(true);
    try {
      console.log(`[BookingDetails] Attempting to mark stop ${stopId} as arrived for booking ${booking.id}`);
      const updated = await bookingService.arriveStop(booking.id, stopId);
      setBooking(updated);
      if (isDriverUnderOperator) {
        const d = await dispatchService.getDispatchByBookingId(booking.id).catch(() => null);
        if (d) setDispatch(d);
      }
      Alert.alert('Success', 'Stop marked as arrived.', [{ text: 'OK' }]);
    } catch (err) {
      console.error(`[BookingDetails] Failed to mark stop as arrived:`, err);
      const errorMessage = err instanceof Error
        ? err.message
        : typeof err === 'object' && err !== null && 'message' in err
          ? String((err as { message: unknown }).message)
          : 'Failed to update stop status. Please try again.';
      Alert.alert('Error', errorMessage);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleCompleteStop = async (stopId: string) => {
    if (!booking || isUpdatingStatus) return;
    setIsUpdatingStatus(true);
    try {
      // Find the stop being completed to check if it's a pickup
      const stop = orderedStops.find((s) => s.id === stopId);
      const isPickupStop = stop?.type === 'Pickup';

      // For lesser clicks, if stop is Pending or OnTheWay, simulate Arrive first
      if (stop && (stop.status === 'Pending' || stop.status === 'OnTheWay')) {
        try {
          await bookingService.arriveStop(booking.id, stopId);
        } catch (err) {
          console.warn('Arrive failed, continuing to complete:', err);
        }
      }

      // Complete the stop
      const updated = await bookingService.completeStop(booking.id, stopId);
      setBooking(updated);

      // If it's a pickup stop, also update booking status to InTransit
      if (isPickupStop) {
        try {
          const bookingUpdated = await bookingService.updateBookingStatus(booking.id, 'InTransit');
          setBooking(bookingUpdated);
        } catch (statusErr) {
          console.warn('[BookingDetails] Failed to update booking status to InTransit:', statusErr);
          // Don't fail the whole operation if status update fails
        }
      }

      if (isDriverUnderOperator) {
        const d = await dispatchService.getDispatchByBookingId(booking.id).catch(() => null);
        if (d) setDispatch(d);
      }
      Alert.alert('Success', 'Stop completed successfully.', [{ text: 'OK' }]);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to complete stop');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleCancelBooking = async (reason: CancellationReason, customReason?: string) => {
    if (!booking || isUpdatingStatus) return;

    try {
      const updated = await bookingService.cancelBooking(booking.id, reason, customReason);
      setBooking(updated);
      Alert.alert('Success', 'Booking cancelled successfully.', [{ text: 'OK' }]);
      router.back();
    } catch (err) {
      throw err; // Re-throw to let modal handle the error
    }
  };

  const handleSubmitPod = async () => {
    if (!booking || !selectedPodStopId || !podImageUri || isUpdatingStatus) {
      if (!podImageUri) Alert.alert('Required', 'Please add a delivery photo.');
      return;
    }
    setIsUpdatingStatus(true);
    try {
      await bookingService.uploadPod(
        booking.id,
        selectedPodStopId,
        podImageUri,
        podSignatureUri ?? undefined,
        podRecipientName.trim() || undefined,
        podNotes.trim() || undefined
      );
      setShowPodModal(false);
      setSelectedPodStopId(null);
      Alert.alert('Success', 'Proof of delivery uploaded for this stop.', [{ text: 'OK' }]);
      if (isDriverUnderOperator) {
        const d = await dispatchService.getDispatchByBookingId(booking.id).catch(() => null);
        if (d) setDispatch(d);
      }
    } catch (err) {
      Alert.alert(
        'Upload failed',
        err instanceof Error ? err.message : 'Failed to upload proof of delivery. Please try again.'
      );
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active':
      case 'Assigned':
      case 'InProgress':
      case 'PickedUp':
      case 'InTransit':
        return theme.success;
      case 'Upcoming':
      case 'Confirmed':
      case 'Dispatched':
      case 'OnTheWayToPickup':
      case 'DriverAssigned':
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
  const isActive = [
    'Active',
    'Assigned',
    'InProgress',
    'Dispatched',
    'OnTheWayToPickup',
    'Delivered',
    'Confirmed',
    'DriverAssigned',
    'PickedUp',
    'InTransit',
  ].includes(booking.status);

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

            {orderedStops.length > 0 ? orderedStops.map((stop) => {
              const stopStatus = stop.status ?? 'Pending';
              const isCompletedStop = stopStatus === 'Completed';
              const isArrivedStop = stopStatus === 'Arrived';

              return (
                <View key={stop.id || `${stop.type}-${stop.sequence}`} style={styles.timelineItem}>
                  <View
                    style={[
                      styles.timelineDot,
                      isCompletedStop
                        ? { backgroundColor: theme.success, borderColor: theme.success }
                        : isArrivedStop
                          ? { backgroundColor: theme.warning, borderColor: theme.warning }
                          : { borderColor: theme.primary },
                    ]}
                  />
                  <View style={styles.timelineContent}>
                    <ThemedText style={[styles.timelineLabel, { color: theme.textSecondary }]}>
                      {stop.type === 'Pickup' ? 'Pickup' : isSingleStop ? 'Delivery' : `Dropoff ${stop.sequence > 0 ? stop.sequence : ''}`.trim()}
                    </ThemedText>
                    <ThemedText style={[styles.timelineValue, { color: theme.text }]}>
                      {stop.address}
                    </ThemedText>
                    {!isSingleStop && (
                      <ThemedText style={[styles.timelineCoords, { color: theme.textMuted }]}>
                        Status: {stopStatus}
                      </ThemedText>
                    )}
                    {stop.latitude != null && stop.longitude != null && (
                      <ThemedText style={[styles.timelineCoords, { color: theme.textMuted }]}>
                        {stop.latitude.toFixed(6)}, {stop.longitude.toFixed(6)}
                      </ThemedText>
                    )}
                  </View>
                </View>
              );
            }) : (
              <>
                <View style={styles.timelineItem}>
                  <View style={[styles.timelineDot, { borderColor: theme.primary }]} />
                  <View style={styles.timelineContent}>
                    <ThemedText style={[styles.timelineLabel, { color: theme.textSecondary }]}>
                      Pickup Location
                    </ThemedText>
                    <ThemedText style={[styles.timelineValue, { color: theme.text }]}>
                      {booking.pickupLocation}
                    </ThemedText>
                  </View>
                </View>
                <View style={styles.timelineItem}>
                  <View style={[styles.timelineDot, { backgroundColor: theme.primary }]} />
                  <View style={styles.timelineContent}>
                    <ThemedText style={[styles.timelineLabel, { color: theme.textSecondary }]}>
                      Delivery Location
                    </ThemedText>
                    <ThemedText style={[styles.timelineValue, { color: theme.text }]}>
                      {booking.dropoffLocation}
                    </ThemedText>
                  </View>
                </View>
              </>
            )}
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

        {/* Cancellation Info */}
        {booking.status === 'Cancelled' && booking.cancellationReason && (
          <View style={[styles.detailsCard, { backgroundColor: theme.error + '20', borderColor: theme.error }]}>
            <View style={styles.cancellationHeader}>
              <Ionicons name="close-circle" size={24} color={theme.error} />
              <ThemedText type="subtitle" style={[styles.sectionTitle, { color: theme.error }]}>
                Booking Cancelled
              </ThemedText>
            </View>
            <ThemedText style={[styles.cancellationReason, { color: theme.text }]}>
              Reason: {booking.cancellationReason}
            </ThemedText>
            {booking.cancelledAt && (
              <ThemedText style={[styles.cancellationDate, { color: theme.textSecondary }]}>
                Cancelled on: {new Date(booking.cancelledAt).toLocaleString()}
              </ThemedText>
            )}
          </View>
        )}

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

        {/* Cancel Booking Button */}
        {isActive && booking.status !== 'Cancelled' && booking.status !== 'Completed' && (
          <View style={styles.actionsContainer}>
            <TouchableOpacity
              style={[styles.actionButton, styles.cancelButton, { backgroundColor: theme.error }]}
              onPress={() => setShowCancelModal(true)}
              disabled={isUpdatingStatus}>
              <Ionicons name="close-circle-outline" size={20} color="#fff" />
              <ThemedText style={[styles.actionButtonText, { color: '#fff' }]}>
                Cancel Booking
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
          const isCompleted = bookingStatus === 'Completed';

          // Don't show buttons if already completed
          if (isCompleted) {
            return null;
          }

          // Single-stop booking: simplified flow
          if (isSingleStop && orderedStops.length > 0) {
            const pickupStop = orderedStops.find((s) => s.type === 'Pickup');
            const deliveryStop = orderedStops.find((s) => s.type === 'Dropoff');
            const pickupStatus = pickupStop?.status ?? 'Pending';
            const deliveryStatus = deliveryStop?.status ?? 'Pending';

            return (
              <View style={styles.statusUpdateContainer}>
                {/* Start Transport - Show when booking is Confirmed */}
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
                {isDriverAssigned && pickupStatus === 'Pending' && (
                  <View style={styles.inTransitIndicator}>
                    <Ionicons name="navigate-outline" size={20} color={theme.info} />
                    <ThemedText style={[styles.inTransitText, { color: theme.info }]}>
                      On The Way to Pickup Location
                    </ThemedText>
                  </View>
                )}

                {/* Mark as Picked Up - Show when DriverAssigned and pickup is not completed */}
                {isDriverAssigned && (pickupStatus === 'Pending' || pickupStatus === 'Arrived') && pickupStop && (
                  <TouchableOpacity
                    style={[
                      styles.statusUpdateButton,
                      { backgroundColor: theme.success, opacity: isUpdatingStatus ? 0.6 : 1 },
                    ]}
                    onPress={() => handleSingleStopPickupComplete(pickupStop.id)}
                    disabled={isUpdatingStatus}>
                    <Ionicons name="checkmark-circle" size={24} color={theme.surface} />
                    <ThemedText style={[styles.statusUpdateButtonText, { color: theme.surface }]}>
                      {isUpdatingStatus ? 'Updating...' : 'Mark as Picked Up'}
                    </ThemedText>
                  </TouchableOpacity>
                )}

                {/* In Transit Indicator - Show when PickedUp */}
                {(isPickedUp || (pickupStatus === 'Completed' && !isDriverAssigned)) && deliveryStatus !== 'Completed' && (
                  <View style={styles.inTransitIndicator}>
                    <Ionicons name="car-outline" size={20} color={theme.info} />
                    <ThemedText style={[styles.inTransitText, { color: theme.info }]}>
                      Cargo Picked Up - On Transit to Delivery
                    </ThemedText>
                  </View>
                )}

                {/* Complete Delivery & Upload POD - Show when PickedUp and delivery is not completed */}
                {(isPickedUp || (pickupStatus === 'Completed' && !isDriverAssigned)) && (deliveryStatus === 'Pending' || deliveryStatus === 'Arrived') && deliveryStop && (
                  <View style={styles.statusUpdateContainer}>
                    <TouchableOpacity
                      style={[
                        styles.statusUpdateButton,
                        { backgroundColor: theme.success, opacity: isUpdatingStatus ? 0.6 : 1 },
                      ]}
                      onPress={() => handleCompleteStop(deliveryStop.id)}
                      disabled={isUpdatingStatus}>
                      <Ionicons name="checkmark-circle" size={24} color={theme.surface} />
                      <ThemedText style={[styles.statusUpdateButtonText, { color: theme.surface }]}>
                        {isUpdatingStatus ? 'Updating...' : 'Mark as Delivered (Completed)'}
                      </ThemedText>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.statusUpdateButton,
                        { backgroundColor: theme.primary, opacity: isUpdatingStatus ? 0.6 : 1 },
                      ]}
                      onPress={() => handleOpenPodModal(deliveryStop.id)}
                      disabled={isUpdatingStatus}>
                      <Ionicons name="camera-outline" size={24} color={theme.primaryText} />
                      <ThemedText style={[styles.statusUpdateButtonText, { color: theme.primaryText }]}>
                        Upload Proof of Delivery
                      </ThemedText>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          }

          // Multi-stop booking: existing detailed interface
          return (
            <View style={styles.statusUpdateContainer}>
              <View style={[styles.inTransitIndicator, { justifyContent: 'space-between', paddingHorizontal: 16 }]}>
                <ThemedText style={[styles.inTransitText, { color: theme.text }]}>
                  Dropoffs: {completedDropoffs}/{dropoffStops.length}
                </ThemedText>
                <ThemedText style={[styles.timelineCoords, { color: theme.textSecondary }]}>
                  Next: {nextSuggestedStop ? `${nextSuggestedStop.type} ${nextSuggestedStop.sequence}` : 'Done'}
                </ThemedText>
              </View>

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
                    In Transit - complete dropoff stops
                  </ThemedText>
                </View>
              )}

              {(isPickedUp || isInTransit || isDriverAssigned) && orderedStops.length > 0 && (
                <View style={styles.stopActionsList}>
                  {orderedStops
                    .filter((stop) => {
                      // Find pickup stop to check if it's completed
                      const pickupStop = orderedStops.find((s) => s.type === 'Pickup');
                      const pickupCompleted = pickupStop?.status === 'Completed';

                      // Hide dropoff stops if they're already completed or if pickup is not completed
                      if (stop.type === 'Dropoff') {
                        const stopStatus = stop.status ?? 'Pending';
                        if (stopStatus === 'Completed') return false;
                        // Hide all dropoff buttons if pickup is not completed
                        if (!pickupCompleted) return false;
                      }
                      return true;
                    })
                    .map((stop) => {
                      const stopStatus = stop.status ?? 'Pending';
                      const canShowOnTheWay = stopStatus === 'Pending' && stop.type === 'Dropoff';
                      // For pickup: show "Mark Arrived" when Pending
                      // For dropoff: show "Mark Arrived" when OnTheWay (already in transit) - hide when "On The Way" button is showing
                      const canArrive = stop.type === 'Pickup'
                        ? stopStatus === 'Pending'
                        : stopStatus === 'OnTheWay';
                      const canComplete = stopStatus === 'Arrived';
                      const isStopCompleted = stopStatus === 'Completed';
                      const showPodAction = stop.type === 'Dropoff' && !isStopCompleted;

                      return (
                        <View
                          key={`stop-action-${stop.id || `${stop.type}-${stop.sequence}`}`}
                          style={[styles.stopActionCard, { borderColor: theme.border, backgroundColor: theme.surface }]}
                        >
                          <View style={styles.stopActionHeader}>
                            <ThemedText style={[styles.stopActionTitle, { color: theme.text }]}>
                              {stop.type === 'Pickup' ? 'Pickup' : `Dropoff ${stop.sequence > 0 ? stop.sequence : ''}`.trim()}
                            </ThemedText>
                            <ThemedText style={[styles.timelineCoords, { color: theme.textSecondary }]}>
                              {stopStatus}
                            </ThemedText>
                          </View>
                          <ThemedText style={[styles.stopActionAddress, { color: theme.textSecondary }]}>
                            {stop.address}
                          </ThemedText>
                          <View style={styles.stopActionButtons}>
                            {canShowOnTheWay && (
                              <TouchableOpacity
                                style={[styles.stopActionButton, { backgroundColor: theme.info, opacity: isUpdatingStatus ? 0.6 : 1 }]}
                                onPress={() => handleOnTheWayStop(stop.id)}
                                disabled={isUpdatingStatus}
                              >
                                <Ionicons name="navigate-outline" size={16} color={theme.surface} />
                                <ThemedText style={[styles.stopActionButtonText, { color: theme.surface }]}>
                                  On The Way
                                </ThemedText>
                              </TouchableOpacity>
                            )}
                            {canArrive && (
                              <TouchableOpacity
                                style={[styles.stopActionButton, { backgroundColor: theme.warning, opacity: isUpdatingStatus ? 0.6 : 1 }]}
                                onPress={() => handleArriveStop(stop.id)}
                                disabled={isUpdatingStatus}
                              >
                                <ThemedText style={[styles.stopActionButtonText, { color: theme.surface }]}>
                                  Mark Arrived
                                </ThemedText>
                              </TouchableOpacity>
                            )}
                            {canComplete && (
                              <TouchableOpacity
                                style={[styles.stopActionButton, { backgroundColor: theme.success, opacity: isUpdatingStatus ? 0.6 : 1 }]}
                                onPress={() => handleCompleteStop(stop.id)}
                                disabled={isUpdatingStatus}
                              >
                                <ThemedText style={[styles.stopActionButtonText, { color: theme.surface }]}>
                                  Complete Stop
                                </ThemedText>
                              </TouchableOpacity>
                            )}
                            {showPodAction && (
                              <TouchableOpacity
                                style={[styles.stopActionButton, { backgroundColor: theme.primary, opacity: isUpdatingStatus ? 0.6 : 1 }]}
                                onPress={() => handleOpenPodModal(stop.id)}
                                disabled={isUpdatingStatus}
                              >
                                <ThemedText style={[styles.stopActionButtonText, { color: theme.primaryText }]}>
                                  Upload POD
                                </ThemedText>
                              </TouchableOpacity>
                            )}
                            {isStopCompleted && (
                              <View style={[styles.stopCompletedBadge, { borderColor: theme.success }]}>
                                <ThemedText style={[styles.timelineCoords, { color: theme.success }]}>
                                  Completed
                                </ThemedText>
                              </View>
                            )}
                          </View>
                        </View>
                      );
                    })}
                </View>
              )}
            </View>
          );
        })()}

        {/* Extra spacing for bottom */}
        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Proof of delivery modal */}
      <Modal
        visible={showPodModal}
        animationType="slide"
        transparent
        onRequestClose={() => !isUpdatingStatus && setShowPodModal(false)}>
        <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
          <View style={[styles.modalContent, { backgroundColor: theme.background }]}>
            <ThemedText type="subtitle" style={[styles.modalTitle, { color: theme.text }]}>
              Proof of delivery {selectedPodStopId && !isSingleStop ? `(stop ${orderedStops.find((s) => s.id === selectedPodStopId)?.sequence ?? ''})` : ''}
            </ThemedText>
            <ThemedText style={[styles.modalSubtitle, { color: theme.textSecondary }]}>
              Add a photo of the delivered cargo (required). Signature is optional.
            </ThemedText>

            <TouchableOpacity
              style={[styles.podUploadBox, { backgroundColor: theme.surface, borderColor: theme.border }]}
              onPress={() => pickPodImage('delivery')}>
              {podImageUri ? (
                <Ionicons name="checkmark-circle" size={32} color={theme.success} />
              ) : (
                <Ionicons name="camera-outline" size={32} color={theme.textSecondary} />
              )}
              <ThemedText style={[styles.podUploadLabel, { color: theme.textSecondary }]}>
                {podImageUri ? 'Delivery photo added' : 'Tap to add delivery photo *'}
              </ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.podUploadBox, { backgroundColor: theme.surface, borderColor: theme.border }]}
              onPress={() => pickPodImage('signature')}>
              {podSignatureUri ? (
                <Ionicons name="checkmark-circle" size={32} color={theme.success} />
              ) : (
                <Ionicons name="create-outline" size={32} color={theme.textSecondary} />
              )}
              <ThemedText style={[styles.podUploadLabel, { color: theme.textSecondary }]}>
                {podSignatureUri ? 'Signature added' : 'Tap to add signature (optional)'}
              </ThemedText>
            </TouchableOpacity>

            <TextInput
              style={[styles.podInput, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
              placeholder="Recipient name (optional)"
              placeholderTextColor={theme.textSecondary}
              value={podRecipientName}
              onChangeText={setPodRecipientName}
            />
            <TextInput
              style={[styles.podInput, styles.podNotesInput, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
              placeholder="Notes (optional)"
              placeholderTextColor={theme.textSecondary}
              value={podNotes}
              onChangeText={setPodNotes}
              multiline
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: theme.border }]}
                onPress={() => {
                  setShowPodModal(false);
                  setSelectedPodStopId(null);
                }}
                disabled={isUpdatingStatus}>
                <ThemedText style={{ color: theme.text }}>Cancel</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: theme.primary }, (!podImageUri || isUpdatingStatus) && styles.modalButtonDisabled]}
                onPress={handleSubmitPod}
                disabled={!podImageUri || isUpdatingStatus}>
                {isUpdatingStatus ? (
                  <ActivityIndicator color={theme.primaryText} size="small" />
                ) : (
                  <ThemedText style={{ color: theme.primaryText }}>Submit</ThemedText>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Cancel Booking Modal */}
      <CancelBookingModal
        visible={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        onConfirm={handleCancelBooking}
        bookingNumber={booking?.bookingNumber}
      />
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
  stopActionsList: {
    gap: 10,
  },
  stopActionCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  stopActionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stopActionTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  stopActionAddress: {
    fontSize: 13,
  },
  stopActionButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  stopActionButton: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  stopActionButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  stopCompletedBadge: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    borderRadius: 16,
    padding: 20,
    maxHeight: '90%',
  },
  modalTitle: {
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 14,
    marginBottom: 16,
  },
  podUploadBox: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 80,
    marginBottom: 12,
  },
  podUploadLabel: {
    marginTop: 8,
    fontSize: 14,
  },
  podInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginBottom: 12,
  },
  podNotesInput: {
    minHeight: 60,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonDisabled: {
    opacity: 0.6,
  },
  cancellationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  cancellationReason: {
    fontSize: 14,
    marginBottom: 4,
  },
  cancellationDate: {
    fontSize: 12,
  },
  cancelButton: {
    width: '100%',
  },
});

