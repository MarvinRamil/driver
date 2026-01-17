import React, { useState } from 'react';
import { StyleSheet, View, TouchableOpacity, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/shared/hooks/use-theme';
import { ThemedView } from '@/shared/components/themed-view';
import { ThemedText } from '@/shared/components/themed-text';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '@/shared/services/apiClient';

export default function InRideScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ dispatchId?: string }>();
  const [status, setStatus] = useState<'InTransit' | 'Delivered'>('InTransit');

  const handleStatusUpdate = async (newStatus: 'InTransit' | 'Delivered') => {
    if (!params.dispatchId) return;

    try {
      await apiClient.patch(`/api/dispatches/${params.dispatchId}/status`, {
        requiresAuth: true,
        body: { status: newStatus },
      });
      setStatus(newStatus);
      if (newStatus === 'Delivered') {
        Alert.alert('Success', 'Dispatch completed!', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      }
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to update status');
    }
  };

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      {/* Map Background Placeholder */}
      <View style={[styles.mapContainer, { backgroundColor: theme.background }]}>
        <Ionicons name="map-outline" size={64} color={theme.textSecondary} />
      </View>

      {/* Top Navigation Instruction */}
      <View style={[styles.navigationCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={[styles.navIcon, { backgroundColor: theme.primary }]}>
          <Ionicons name="arrow-forward" size={32} color={theme.primaryText} />
        </View>
        <View style={styles.navContent}>
          <ThemedText style={[styles.navDistance, { color: theme.text }]}>200m</ThemedText>
          <ThemedText style={[styles.navInstruction, { color: theme.textSecondary }]}>
            Turn right onto Main Street
          </ThemedText>
        </View>
        <View style={styles.navTime}>
          <ThemedText style={[styles.navTimeValue, { color: theme.primary }]}>12:45</ThemedText>
          <ThemedText style={[styles.navTimeLabel, { color: theme.textSecondary }]}>Arrival</ThemedText>
        </View>
      </View>

      {/* Right Controls */}
      <View style={styles.rightControls}>
        <TouchableOpacity
          style={[styles.controlButton, { backgroundColor: theme.error + '20', borderColor: theme.error }]}>
          <Ionicons name="shield-checkmark" size={24} color={theme.error} />
        </TouchableOpacity>
        <View style={[styles.mapControls, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <TouchableOpacity style={styles.mapControlButton}>
            <Ionicons name="add" size={20} color={theme.text} />
          </TouchableOpacity>
          <View style={[styles.mapControlDivider, { backgroundColor: theme.border }]} />
          <TouchableOpacity style={styles.mapControlButton}>
            <Ionicons name="remove" size={20} color={theme.text} />
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={[styles.controlButton, { backgroundColor: theme.primary }]}>
          <Ionicons name="navigate" size={24} color={theme.primaryText} />
        </TouchableOpacity>
      </View>

      {/* Bottom Sheet */}
      <View style={[styles.bottomSheet, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
        {/* Customer Info */}
        <View style={styles.customerSection}>
          <View style={styles.customerInfo}>
            <View style={[styles.avatar, { borderColor: theme.primary }]}>
              <Ionicons name="business-outline" size={24} color={theme.primary} />
            </View>
            <View style={styles.customerDetails}>
              <ThemedText style={[styles.customerName, { color: theme.text }]}>ABC Logistics</ThemedText>
              <View style={styles.customerMeta}>
                <Ionicons name="star" size={14} color={theme.primary} />
                <ThemedText style={[styles.customerRating, { color: theme.text }]}>4.8</ThemedText>
                <ThemedText style={[styles.customerType, { color: theme.textSecondary }]}>
                  • Customer
                </ThemedText>
              </View>
            </View>
          </View>
          <View style={styles.communicationButtons}>
            <TouchableOpacity style={[styles.commButton, { backgroundColor: theme.border }]}>
              <Ionicons name="chatbubble-outline" size={20} color={theme.text} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.commButton, { backgroundColor: theme.border }]}>
              <Ionicons name="call-outline" size={20} color={theme.text} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: theme.border }]} />

        {/* Destination */}
        <View style={styles.destinationSection}>
          <View style={styles.destinationTimeline}>
            <View style={[styles.timelineDot, { backgroundColor: theme.textSecondary }]} />
            <View style={[styles.timelineLine, { backgroundColor: theme.border }]} />
            <Ionicons name="location" size={24} color={theme.primary} />
          </View>
          <View style={styles.destinationContent}>
            <ThemedText style={[styles.destinationTime, { color: theme.text }]}>15 min</ThemedText>
            <ThemedText style={[styles.destinationAddress, { color: theme.text }]}>
              123 Honeycomb Ave
            </ThemedText>
            <ThemedText style={[styles.destinationNote, { color: theme.textSecondary }]}>
              Near Central Park Entrance
            </ThemedText>
          </View>
        </View>

        {/* Action Button */}
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: theme.primary }]}
          onPress={() => {
            if (status === 'InTransit') {
              handleStatusUpdate('Delivered');
            } else {
              router.back();
            }
          }}>
          <View style={[styles.actionIcon, { backgroundColor: theme.primary + '33' }]}>
            <Ionicons name="arrow-forward" size={24} color={theme.primaryText} />
          </View>
          <ThemedText style={[styles.actionText, { color: theme.primaryText }]}>
            {status === 'InTransit' ? 'Mark as Delivered' : 'Complete Dispatch'}
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
  mapContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navigationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    marginTop: 48,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  navIcon: {
    width: 64,
    height: 64,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navContent: {
    flex: 1,
    gap: 4,
  },
  navDistance: {
    fontSize: 24,
    fontWeight: '700',
  },
  navInstruction: {
    fontSize: 16,
    fontWeight: '500',
  },
  navTime: {
    alignItems: 'flex-end',
    gap: 2,
  },
  navTimeValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  navTimeLabel: {
    fontSize: 10,
    textTransform: 'uppercase',
  },
  rightControls: {
    position: 'absolute',
    right: 16,
    top: 200,
    alignItems: 'center',
    gap: 12,
  },
  controlButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  mapControls: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  mapControlButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapControlDivider: {
    height: 1,
    width: '100%',
  },
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    padding: 20,
    paddingBottom: 40,
    gap: 16,
  },
  customerSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  customerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  customerDetails: {
    gap: 4,
  },
  customerName: {
    fontSize: 20,
    fontWeight: '700',
  },
  customerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  customerRating: {
    fontSize: 14,
    fontWeight: '700',
  },
  customerType: {
    fontSize: 14,
  },
  communicationButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  commButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    height: 1,
    marginVertical: 8,
  },
  destinationSection: {
    flexDirection: 'row',
    gap: 12,
  },
  destinationTimeline: {
    alignItems: 'center',
    gap: 4,
  },
  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  timelineLine: {
    width: 2,
    height: 32,
  },
  destinationContent: {
    flex: 1,
    gap: 4,
  },
  destinationTime: {
    fontSize: 24,
    fontWeight: '700',
  },
  destinationAddress: {
    fontSize: 16,
    fontWeight: '600',
  },
  destinationNote: {
    fontSize: 14,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    textTransform: 'uppercase',
  },
});

