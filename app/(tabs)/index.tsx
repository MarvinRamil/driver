import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, ScrollView, View, RefreshControl, TouchableOpacity, Image, Alert, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '@/shared/hooks/use-theme';
import { useDashboardStats } from '@/features/dashboard';
import { useBookings } from '@/features/bookings';
import { useAuth } from '@/features/auth';
import { useDriverStatusContext } from '@/features/driver/context/DriverStatusContext';
import { useLocationTrackingStatus } from '@/features/driver/hooks/useLocationTracking';
import { useOffers, getPickupAddress, getDropoffAddress, isMultiStopOffer, getTimeRemaining, filterValidOffers } from '@/features/offers';
import { ThemedView } from '@/shared/components/themed-view';
import { ThemedText } from '@/shared/components/themed-text';
import { SwipeToAccept } from '@/shared/components/SwipeToAccept';

import { Ionicons } from '@expo/vector-icons';
import { BeeColors } from '@/constants/theme';
import { Image as ExpoImage } from 'expo-image';

/**
 * Dashboard screen
 * Matches prepared design with header, earnings, stats, and quick actions
 */
export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const stats = useDashboardStats();
  const { bookings, isLoading, refresh } = useBookings('Active');
  const { isOnline, toggleOnlineStatus, isLoading: statusLoading, isInitialLoading } = useDriverStatusContext();
  const locationStatus = useLocationTrackingStatus();
  const { offers, isLoading: offersLoading, refresh: refreshOffers, acceptOffer, rejectOffer } = useOffers({ limit: 3, pollingInterval: 5000 });
  
  // Filter valid (non-expired) offers
  const validOffers = filterValidOffers(offers);
  const validOffersRef = useRef(validOffers);
  validOffersRef.current = validOffers;

  // Countdown timer state for offers
  const [timeRemaining, setTimeRemaining] = useState<Record<string, number>>({});
  // Track which offer is being accepted (disable switch while request in flight)
  const [acceptingOfferId, setAcceptingOfferId] = useState<string | null>(null);

  // Update countdown timers every second (single interval, read latest offers from ref to avoid effect re-running every render)
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

  // Determine if solo driver or operator driver
  const isSoloDriver = user?.isSoloDriver || false;

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isLoading || offersLoading}
            onRefresh={async () => {
              try {
                await Promise.all([refresh(), refreshOffers()]);
              } catch (error) {
                console.error('Error refreshing dashboard:', error);
              }
            }}
          />
        }
        showsVerticalScrollIndicator={false}>

        {/* Header with Profile */}
        <View style={[styles.header, { backgroundColor: theme.primary }]}>
          {/* Decorative Bee Logo */}
          <View style={styles.beeLogoWrapper}>
            <ExpoImage
              source={require('@/assets/images/adaptive-icon.png')}
              style={styles.beeLogo}
              contentFit="contain"
            />
          </View>

          <View style={styles.headerContent}>
            <View style={styles.profileSection}>
              <View style={styles.profileImageContainer}>
                <View style={[styles.profileImage, { backgroundColor: theme.surface, borderColor: theme.surface }]}>
                  <Ionicons name="person" size={24} color={theme.primaryText} />
                </View>
                {isOnline && (
                  <View style={[styles.onlineIndicator, { backgroundColor: theme.success, borderColor: theme.primary }]} />
                )}
              </View>
              <View style={styles.welcomeSection}>
                <ThemedText style={[styles.welcomeText, { color: theme.primaryText }]}>
                  Welcome back,
                </ThemedText>
                <ThemedText style={[styles.userName, { color: theme.primaryText }]}>
                  {user?.fullName || 'Driver'}
                </ThemedText>
              </View>
            </View>
            <TouchableOpacity style={[styles.notificationButton, { backgroundColor: theme.surface + '33' }]}>
              <Ionicons name="notifications-outline" size={24} color={theme.primaryText} />
            </TouchableOpacity>
          </View>

          {/* Online Status Toggle */}
          <View style={[styles.onlineStatusCard, { backgroundColor: theme.primary + '0D' }]}>
            <View style={styles.onlineStatusLeft}>
              <View style={[styles.onlineIconContainer, { backgroundColor: theme.surface }]}>
                <Ionicons name="cube-outline" size={20} color={theme.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText style={[styles.onlineStatusText, { color: theme.primaryText }]}>
                  {isInitialLoading ? 'Loading...' : isOnline ? 'Now Online' : 'Offline'}
                </ThemedText>
              </View>
            </View>
            <View style={styles.toggleContainer}>
              {/* Location Status Indicator - Green/Red Circle */}
              {/* Temporarily commented out */}
              {/* {isOnline && locationStatus.isTracking && (
                <View
                  style={[
                    styles.locationStatusIndicator,
                    {
                      backgroundColor: locationStatus.lastError ? theme.error : locationStatus.hasRecentUpdate ? theme.success : theme.textSecondary + '80',
                    },
                  ]}
                />
              )} */}
              {isInitialLoading ? (
                <View style={[styles.toggle, { backgroundColor: theme.toggleOffTrack, opacity: 0.5 }]}>
                  <View style={[styles.toggleThumb, { backgroundColor: theme.toggleOffKnob }]} />
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.toggle, { backgroundColor: isOnline ? theme.toggleOnTrack : theme.toggleOffTrack }]}
                  onPress={async () => {
                    try {
                      await toggleOnlineStatus();
                    } catch (error) {
                      console.error('Error toggling online status:', error);
                    }
                  }}
                  disabled={statusLoading}>
                  <View style={[styles.toggleThumb, { backgroundColor: isOnline ? theme.toggleOnKnob : theme.toggleOffKnob }, isOnline && styles.toggleThumbActive]} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        {/* Main Content */}
        <View style={styles.mainContent}>
          {/* Today's Earnings Card (Solo Driver Only) */}
          {isSoloDriver && (
            <View style={[styles.earningsCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={styles.earningsHeader}>
                <View>
                  <ThemedText style={[styles.earningsLabel, { color: theme.textSecondary }]}>
                    Today's Earnings
                  </ThemedText>
                  <ThemedText style={[styles.earningsValue, { color: theme.text }]}>
                    ₱{((stats?.walletBalance ?? 0) * 0.1).toFixed(2)}
                  </ThemedText>
                </View>
                <View style={[styles.trendBadge, { backgroundColor: theme.success + '20' }]}>
                  <Ionicons name="trending-up" size={12} color={theme.success} />
                  <ThemedText style={[styles.trendText, { color: theme.success }]}>+12%</ThemedText>
                </View>
              </View>
              <View style={[styles.progressBar, { backgroundColor: theme.border }]}>
                <View style={[styles.progressFill, { backgroundColor: theme.primary, width: '78%' }]} />
              </View>
              <View style={styles.progressLabels}>
                <ThemedText style={[styles.progressLabel, { color: theme.textMuted }]}>
                  Goal: ₱160
                </ThemedText>
                <ThemedText style={[styles.progressLabel, { color: theme.textMuted }]}>78%</ThemedText>
              </View>
            </View>
          )}

          {/* Stats Cards */}
          <View style={styles.statsGrid}>
            <View style={[styles.statCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={[styles.statIcon, { backgroundColor: theme.primary + '20' }]}>
                <Ionicons name="time-outline" size={20} color={theme.primary} />
              </View>
              <ThemedText style={[styles.statValue, { color: theme.text }]}>6.5h</ThemedText>
              <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>Online</ThemedText>
            </View>
            <View style={[styles.statCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={[styles.statIcon, { backgroundColor: theme.info + '20' }]}>
                <Ionicons name="cube-outline" size={20} color={theme.info} />
              </View>
              <ThemedText style={[styles.statValue, { color: theme.text }]}>{stats?.totalBookings ?? 0}</ThemedText>
              <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>Trips</ThemedText>
            </View>
            <View style={[styles.statCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={[styles.statIcon, { backgroundColor: theme.warning + '20' }]}>
                <Ionicons name="star-outline" size={20} color={theme.warning} />
              </View>
              <ThemedText style={[styles.statValue, { color: theme.text }]}>4.9</ThemedText>
              <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>Rating</ThemedText>
            </View>
          </View>

          {/* Quick Actions */}
          {stats?.canAccessWallet && (
            <View style={styles.quickActionsSection}>
              <ThemedText type="subtitle" style={styles.sectionTitle}>
                Quick Actions
              </ThemedText>
              <TouchableOpacity
                style={[styles.quickActionCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
                onPress={() => router.push('/(tabs)/wallet')}>
                <View style={[styles.quickActionIconContainer, { backgroundColor: theme.border + '80' }]}>
                  <Ionicons name="wallet-outline" size={24} color={theme.text} />
                </View>
                <ThemedText style={[styles.quickActionTitle, { color: theme.text }]}>
                  Wallet
                </ThemedText>
                <ThemedText style={[styles.quickActionSubtitle, { color: theme.textSecondary }]}>
                  Manage payout
                </ThemedText>
              </TouchableOpacity>
            </View>
          )}

          {/* New Offers Section */}
          {isOnline && (
            <View style={styles.offersSection}>
              <View style={styles.sectionHeader}>
                <ThemedText type="subtitle" style={styles.sectionTitle}>
                  New Offers
                </ThemedText>
                {validOffers.length > 0 && (
                  <View style={[styles.badge, { backgroundColor: theme.primary + '20' }]}>
                    <ThemedText style={[styles.badgeText, { color: theme.primary }]}>
                      {validOffers.length}
                    </ThemedText>
                  </View>
                )}
              </View>

              {offersLoading && validOffers.length === 0 ? (
                <View style={[styles.emptyState, { backgroundColor: theme.surface }]}>
                  <ActivityIndicator size="small" color={theme.primary} />
                  <ThemedText style={[styles.emptyText, { color: theme.textSecondary, marginTop: 8 }]}>
                    Loading offers...
                  </ThemedText>
                </View>
              ) : validOffers.length === 0 ? (
                <View style={[styles.emptyState, { backgroundColor: theme.surface }]}>
                  <Ionicons name="megaphone-outline" size={32} color={theme.textSecondary} />
                  <ThemedText style={[styles.emptyText, { color: theme.textSecondary, marginTop: 8 }]}>
                    No new offers available
                  </ThemedText>
                </View>
              ) : (
                validOffers.map((offer) => {
                  const remaining = timeRemaining[offer.id] ?? getTimeRemaining(offer);
                  const minutes = Math.floor(remaining / 60);
                  const seconds = remaining % 60;
                  const isExpiringSoon = remaining < 60; // Less than 1 minute
                  
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

                      <View style={[styles.offerActions, { borderTopColor: theme.border }]}>
                        <SwipeToAccept
                          label="Swipe to accept"
                          disabled={acceptingOfferId !== null && acceptingOfferId !== offer.id}
                          trackColor={theme.border}
                          thumbColor={theme.primary}
                          textColor={theme.text}
                          style={styles.swipeToAcceptFull}
                          onAccept={async () => {
                            setAcceptingOfferId(offer.id);
                            try {
                              await acceptOffer(offer.id);
                              Alert.alert('Success', 'Offer accepted! Check your bookings.');
                            } catch (error) {
                              setAcceptingOfferId(null);
                              Alert.alert('Error', error instanceof Error ? error.message : 'Failed to accept offer. Please try again.');
                            }
                          }}
                        />
                        <TouchableOpacity
                          style={[styles.rejectButton, { borderColor: theme.border }]}
                          onPress={async () => {
                            try {
                              await rejectOffer(offer.id);
                            } catch (error) {
                              Alert.alert('Error', 'Failed to reject offer. Please try again.');
                            }
                          }}>
                          <Ionicons name="close-outline" size={18} color={theme.textSecondary} />
                          <ThemedText style={[styles.rejectButtonText, { color: theme.textSecondary }]}>
                            Not for me
                          </ThemedText>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          )}

          {/* Assigned Bookings (Operator Driver) or Active Bookings (Solo) */}
          <View style={styles.bookingsSection}>
            <View style={styles.sectionHeader}>
              <ThemedText type="subtitle" style={styles.sectionTitle}>
                {isSoloDriver ? 'Active Bookings' : 'Assigned Bookings'}
              </ThemedText>
              <View style={[styles.badge, { backgroundColor: theme.border }]}>
                <ThemedText style={[styles.badgeText, { color: theme.textSecondary }]}>Today</ThemedText>
              </View>
            </View>

            {bookings.length === 0 ? (
              <View style={[styles.emptyState, { backgroundColor: theme.surface }]}>
                <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
                  No active bookings
                </ThemedText>
              </View>
            ) : (
              bookings.slice(0, 3).map((booking) => (
                <TouchableOpacity
                  key={booking.id}
                  style={[styles.bookingCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
                  onPress={() => router.push(`/booking/${booking.id}`)}>
                  <View style={[styles.bookingIndicator, { backgroundColor: theme.primary }]} />
                  <View style={styles.bookingHeader}>
                    <View style={styles.bookingHeaderLeft}>
                      <View style={[styles.statusBadge, { backgroundColor: theme.success + '20' }]}>
                        <ThemedText style={[styles.statusBadgeText, { color: theme.success }]}>
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
                  <View style={styles.bookingTimeline}>
                    <View style={[styles.timelineLine, { backgroundColor: theme.border }]} />
                    <View style={styles.timelineItem}>
                      <View style={[styles.timelineDot, { backgroundColor: theme.surface, borderColor: theme.primary }]} />
                      <View style={styles.timelineContent}>
                        <ThemedText style={[styles.timelineTime, { color: theme.textSecondary }]}>
                          Pickup • {new Date(booking.scheduleDate).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                        </ThemedText>
                        <ThemedText style={[styles.timelineLocation, { color: theme.text }]}>
                          {booking.pickupLocation}
                        </ThemedText>
                      </View>
                    </View>
                    <View style={styles.timelineItem}>
                      <View style={[styles.timelineDot, { backgroundColor: theme.primary, borderColor: theme.primary }]} />
                      <View style={styles.timelineContent}>
                        <ThemedText style={[styles.timelineTime, { color: theme.textSecondary }]}>
                          Delivery • Est. {new Date(new Date(booking.scheduleDate).getTime() + 45 * 60000).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                        </ThemedText>
                        <ThemedText style={[styles.timelineLocation, { color: theme.text }]}>
                          {booking.dropoffLocation}
                        </ThemedText>
                      </View>
                    </View>
                  </View>
                  <View style={[styles.bookingActions, { borderTopColor: theme.border }]}>
                    <TouchableOpacity style={[styles.actionButton, { backgroundColor: theme.border }]}>
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
                      <ThemedText style={[styles.actionButtonText, { color: theme.primaryText }]}>Navigate</ThemedText>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>

          {/* Weekly Quest (Solo Driver Only) */}
          {isSoloDriver && (
            <View style={[styles.questCard, { backgroundColor: theme.card }]}>
              <View style={styles.questContent}>
                <View>
                  <View style={styles.questHeader}>
                    <Ionicons name="trophy-outline" size={14} color={theme.primary} />
                    <ThemedText style={[styles.questLabel, { color: theme.primary }]}>
                      WEEKLY QUEST
                    </ThemedText>
                  </View>
                  <ThemedText style={[styles.questTitle, { color: theme.text }]}>
                    Complete 5 more deliveries
                  </ThemedText>
                  <ThemedText style={[styles.questSubtitle, { color: theme.textSecondary }]}>
                    To unlock a ₱20 bonus bee-ward!
                  </ThemedText>
                </View>
                <View style={styles.questProgress}>
                  <View style={[styles.questProgressCircle, { borderColor: theme.border }]}>
                    <ThemedText style={[styles.questProgressText, { color: theme.text }]}>75%</ThemedText>
                  </View>
                </View>
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  header: {
    paddingTop: 48,
    paddingBottom: 32,
    paddingHorizontal: 24,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    position: 'relative',
    overflow: 'hidden',
  },
  beeLogoWrapper: {
    position: 'absolute',
    top: 0,
    right: 16,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 0,
  },
  beeLogo: {
    width: 200,
    height: 200,
    opacity: 0.15,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  profileImageContainer: {
    position: 'relative',
  },
  profileImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
  },
  welcomeSection: {
    gap: 2,
  },
  welcomeText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    opacity: 0.8,
  },
  userName: {
    fontSize: 20,
    fontWeight: '700',
  },
  notificationButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  onlineStatusCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 4,
    paddingLeft: 16,
    paddingRight: 50, // Align with notification button (header padding handles the margin)
    borderRadius: 12,
  },
  onlineStatusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  onlineIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  onlineStatusText: {
    fontSize: 14,
    fontWeight: '700',
  },
  toggleContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    position: 'relative',
  },
  locationStatusIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
  },
  toggle: {
    width: 48,
    height: 24,
    borderRadius: 12,
    padding: 2,
    justifyContent: 'center',
  },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginLeft: 0,
  },
  toggleThumbActive: {
    marginLeft: 24, // 48 (width) - 20 (thumb width) - 2*2 (padding) = 24
  },
  mainContent: {
    padding: 20,
    gap: 24,
    marginTop: -12,
  },
  earningsCard: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  earningsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  earningsLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  earningsValue: {
    fontSize: 32,
    fontWeight: '700',
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  trendText: {
    fontSize: 12,
    fontWeight: '700',
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
    marginTop: 12,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  progressLabel: {
    fontSize: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  quickActionsSection: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  quickActionCard: {
    flex: 1,
    minWidth: '47%',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  quickActionIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  quickActionSubtitle: {
    fontSize: 12,
    marginTop: 4,
  },
  bookingsSection: {
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 4,
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
  emptyState: {
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
  },
  bookingCard: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
    position: 'relative',
    overflow: 'hidden',
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
  timelineTime: {
    fontSize: 12,
    fontWeight: '500',
  },
  timelineLocation: {
    fontSize: 14,
    fontWeight: '600',
  },
  bookingActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
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
  questCard: {
    padding: 20,
    borderRadius: 16,
    position: 'relative',
    overflow: 'hidden',
  },
  questContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  questHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  questLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  questTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  questSubtitle: {
    fontSize: 14,
  },
  questProgress: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  questProgressCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  questProgressText: {
    fontSize: 12,
    fontWeight: '700',
  },
  offersSection: {
    gap: 12,
  },
  offerCard: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
    position: 'relative',
    overflow: 'hidden',
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
  offerActions: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    gap: 10,
  },
  swipeToAcceptFull: {
    width: '100%',
    minHeight: 48,
  },
  rejectButton: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  rejectButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
