import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, TouchableOpacity, Animated, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/shared/hooks/use-theme';
import { useOffers } from '@/features/offers';
import { useAuth } from '@/features/auth';
import { ThemedView } from '@/shared/components/themed-view';
import { ThemedText } from '@/shared/components/themed-text';
import { SwipeToAccept } from '@/shared/components/SwipeToAccept';
import { Ionicons } from '@expo/vector-icons';

/**
 * Accept Booking Screen
 * Shows incoming booking request with countdown timer
 */
export default function AcceptBookingScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ offerId?: string }>();
  const { user } = useAuth();
  const { offers, isLoading: offersLoading, refresh: refreshOffers, acceptOffer, rejectOffer } = useOffers();
  const [timeRemaining, setTimeRemaining] = useState(15);
  const progressAnim = useRef(new Animated.Value(1)).current;
  const hasRefreshedForOfferId = useRef(false);

  // Find the offer by ID or get the first pending offer
  const offer = params.offerId
    ? offers.find((o) => o.id === params.offerId)
    : offers[0];

  // When opened from push with offerId, the list may not have the offer yet — refresh once so we can accept
  useEffect(() => {
    if (!params.offerId || offer || hasRefreshedForOfferId.current) return;
    hasRefreshedForOfferId.current = true;
    refreshOffers();
  }, [params.offerId, offer, refreshOffers]);

  useEffect(() => {
    if (!offer) return;

    const expiresAt = offer.expiresAt.getTime();
    const now = Date.now();
    const initialTime = Math.max(0, Math.floor((expiresAt - now) / 1000));

    setTimeRemaining(initialTime);

    // Animate progress bar
    Animated.timing(progressAnim, {
      toValue: 0,
      duration: initialTime * 1000,
      useNativeDriver: false,
    }).start();

    // Countdown timer
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
      setTimeRemaining(remaining);

      if (remaining === 0) {
        clearInterval(interval);
        // Auto-reject when expired
        handleReject();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [offer]);

  const handleAccept = async () => {
    if (!offer) return;

    try {
      await acceptOffer(offer.id);
      Alert.alert('Success', 'Booking accepted!', [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ]);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to accept booking');
    }
  };

  const handleReject = async () => {
    if (!offer) return;

    try {
      await rejectOffer(offer.id);
      router.back();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to reject booking');
    }
  };

  if (!offer) {
    const loadingFromPush = !!params.offerId && offersLoading;
    return (
      <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.emptyContainer}>
          <Ionicons name="notifications-off-outline" size={64} color={theme.textSecondary} />
          <ThemedText type="title" style={[styles.emptyText, { color: theme.text }]}>
            {loadingFromPush ? 'Loading offer…' : 'No Active Offers'}
          </ThemedText>
          <ThemedText style={[styles.emptySubtext, { color: theme.textSecondary }]}>
            {loadingFromPush
              ? 'Fetching the latest booking request'
              : "You'll be notified when a new booking request arrives"}
          </ThemedText>
          <TouchableOpacity
            style={[styles.backButton, { backgroundColor: theme.primary }]}
            onPress={() => router.back()}>
            <ThemedText style={[styles.backButtonText, { color: theme.primaryText }]}>Go Back</ThemedText>
          </TouchableOpacity>
        </View>
      </ThemedView>
    );
  }

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <View style={[styles.statusBadge, { backgroundColor: theme.success + '20' }]}>
          <View style={[styles.statusDot, { backgroundColor: theme.success }]} />
          <ThemedText style={[styles.statusText, { color: theme.success }]}>Online</ThemedText>
        </View>
      </View>

      {/* Title */}
      <View style={styles.titleContainer}>
        <ThemedText type="title" style={[styles.title, { color: theme.text }]}>
          New Request
        </ThemedText>
        <Ionicons name="cube-outline" size={32} color={theme.primary} />
      </View>

      {/* Countdown Timer */}
      <View style={styles.countdownContainer}>
        <ThemedText style={[styles.countdownText, { color: theme.textSecondary }]}>
          Auto-decline in <ThemedText style={{ color: theme.text, fontWeight: '700' }}>{timeRemaining}s</ThemedText>
        </ThemedText>
        <View style={[styles.progressBarContainer, { backgroundColor: theme.border }]}>
          <Animated.View
            style={[
              styles.progressBar,
              {
                backgroundColor: theme.primary,
                width: progressWidth,
              },
            ]}
          />
        </View>
      </View>

      {/* Map Placeholder */}
      <View style={[styles.mapContainer, { backgroundColor: theme.border }]}>
        <Ionicons name="map-outline" size={48} color={theme.textSecondary} />
        <View style={[styles.mapBadge, { backgroundColor: theme.surface }]}>
          <Ionicons name="time-outline" size={16} color={theme.primary} />
          <ThemedText style={[styles.mapBadgeText, { color: theme.text }]}>
            {Math.ceil(offer.estimatedDuration / 60)} min away
          </ThemedText>
        </View>
      </View>

      {/* Content */}
      <View style={styles.content}>
        {/* Fare */}
        <View style={styles.fareContainer}>
          <ThemedText type="title" style={[styles.fareAmount, { color: theme.text }]}>
            ₱{offer.estimatedFare.toFixed(2)}
          </ThemedText>
          <ThemedText style={[styles.fareSubtext, { color: theme.textSecondary }]}>
            Estimated Fare • {(offer.estimatedDistance / 1000).toFixed(1)} km total
          </ThemedText>
        </View>

        {/* Locations */}
        <View style={[styles.locationsCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.locationItem}>
            <View style={[styles.locationDot, { backgroundColor: theme.text }]} />
            <View style={styles.locationContent}>
              <ThemedText style={[styles.locationLabel, { color: theme.textSecondary }]}>
                PICK UP
              </ThemedText>
              <ThemedText style={[styles.locationAddress, { color: theme.text }]}>
                {offer.pickupLocation}
              </ThemedText>
            </View>
          </View>
          <View style={[styles.locationLine, { backgroundColor: theme.border }]} />
          <View style={styles.locationItem}>
            <Ionicons name="location" size={24} color={theme.primary} />
            <View style={styles.locationContent}>
              <ThemedText style={[styles.locationLabel, { color: theme.textSecondary }]}>
                DROP OFF
              </ThemedText>
              <ThemedText style={[styles.locationAddress, { color: theme.text }]}>
                {offer.dropoffLocation}
              </ThemedText>
            </View>
          </View>
        </View>

        {/* Tags */}
        <View style={styles.tagsContainer}>
          <View style={[styles.tag, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Ionicons name="cash-outline" size={18} color={theme.text} />
            <ThemedText style={[styles.tagText, { color: theme.text }]}>
              {offer.paymentMethod} Payment
            </ThemedText>
          </View>
          {offer.customerRating && (
            <View style={[styles.tag, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Ionicons name="star" size={18} color={theme.primary} />
              <ThemedText style={[styles.tagText, { color: theme.text }]}>
                {offer.customerRating.toFixed(1)} Customer
              </ThemedText>
            </View>
          )}
          {offer.truckType && (
            <View style={[styles.tag, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Ionicons name="cube-outline" size={18} color={theme.text} />
              <ThemedText style={[styles.tagText, { color: theme.text }]}>
                {offer.truckType}
              </ThemedText>
            </View>
          )}
          {offer.cargoDescription && (
            <View style={[styles.tag, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Ionicons name="document-text-outline" size={18} color={theme.text} />
              <ThemedText style={[styles.tagText, { color: theme.text }]} numberOfLines={1}>
                {offer.cargoDescription}
              </ThemedText>
            </View>
          )}
        </View>
      </View>

      {/* Swipe to accept */}
      <View style={[styles.actionsContainer, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
        <SwipeToAccept
          label="Swipe to accept booking"
          trackColor={theme.border}
          thumbColor={theme.primary}
          textColor={theme.text}
          style={styles.swipeToAcceptFull}
          onAccept={handleAccept}
        />
        <TouchableOpacity
          style={[styles.declineButtonLink, { borderColor: theme.border }]}
          onPress={handleReject}>
          <Ionicons name="close-outline" size={18} color={theme.textSecondary} />
          <ThemedText style={[styles.declineButtonLinkText, { color: theme.textSecondary }]}>
            Decline
          </ThemedText>
        </TouchableOpacity>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  backButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  titleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
  },
  countdownContainer: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 8,
  },
  countdownText: {
    fontSize: 14,
  },
  progressBarContainer: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 4,
  },
  mapContainer: {
    height: 200,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  mapBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  mapBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    gap: 16,
  },
  fareContainer: {
    alignItems: 'center',
    gap: 4,
  },
  fareAmount: {
    fontSize: 40,
    fontWeight: '700',
  },
  fareSubtext: {
    fontSize: 14,
  },
  locationsCard: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    gap: 16,
  },
  locationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  locationDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginTop: 2,
  },
  locationContent: {
    flex: 1,
    gap: 4,
  },
  locationLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  locationAddress: {
    fontSize: 18,
    fontWeight: '700',
  },
  locationLine: {
    width: 2,
    height: 32,
    marginLeft: 11,
    marginVertical: 4,
    borderStyle: 'dashed',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  tagText: {
    fontSize: 12,
    fontWeight: '700',
  },
  actionsContainer: {
    padding: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    gap: 12,
  },
  swipeToAcceptFull: {
    width: '100%',
    minHeight: 48,
  },
  declineButtonLink: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  declineButtonLinkText: {
    fontSize: 15,
    fontWeight: '600',
  },
  declineButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  declineButtonText: {
    fontSize: 18,
    fontWeight: '700',
  },
  acceptButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 12,
  },
  acceptButtonText: {
    fontSize: 18,
    fontWeight: '700',
  },
  acceptSwitchContainer: {
    flex: 2,
    borderRadius: 12,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 16,
  },
  emptyText: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
  },
});

