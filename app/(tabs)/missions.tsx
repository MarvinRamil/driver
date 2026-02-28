import React from 'react';
import { StyleSheet, ScrollView, View, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '@/shared/hooks/use-theme';
import { useMissions, MissionStatus } from '@/features/missions';
import { useAuth } from '@/features/auth';
import { ThemedView } from '@/shared/components/themed-view';
import { ThemedText } from '@/shared/components/themed-text';
import { Ionicons } from '@expo/vector-icons';

export default function MissionsScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const {
    missions,
    isLoading,
    error,
    filter,
    setFilter,
    refresh,
    claimMission,
    activeMissions,
  } = useMissions(user?.id || '');

  const filters: (MissionStatus | 'All')[] = ['All', 'Active', 'Available', 'Completed'];

  const handleClaim = async (missionId: string) => {
    try {
      await claimMission(missionId);
      Alert.alert('Success', 'Mission reward claimed!');
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to claim reward');
    }
  };

  const currentFocus = activeMissions[0];

  const getProgressPercentage = (mission: any) => {
    if (mission.target === 0) return 0;
    return Math.min(100, (mission.progress / mission.target) * 100);
  };

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refresh} />}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <ThemedText type="title" style={[styles.headerTitle, { color: theme.text }]}>
            Weekly Missions
          </ThemedText>
          <TouchableOpacity>
            <Ionicons name="help-circle-outline" size={24} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>


        {/* Stats */}
        <View style={styles.statsContainer}>
          <View style={[styles.statCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <ThemedText style={[styles.statValue, { color: theme.text }]}>
              ₱{activeMissions.reduce((sum, m) => sum + m.reward, 0).toFixed(2)}
            </ThemedText>
            <View style={styles.statLabelRow}>
              <Ionicons name="wallet-outline" size={16} color={theme.primary} />
              <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>
                Current Bonus
              </ThemedText>
            </View>
          </View>
          <View style={[styles.statCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <ThemedText style={[styles.statValue, { color: theme.text }]}>
              {activeMissions.length}
            </ThemedText>
            <View style={styles.statLabelRow}>
              <Ionicons name="flash-outline" size={16} color={theme.primary} />
              <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>
                Active Missions
              </ThemedText>
            </View>
          </View>
        </View>

        {/* Filters */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersContainer}>
          {filters.map((f) => (
            <TouchableOpacity
              key={f}
              style={[
                styles.filterButton,
                filter === f
                  ? { backgroundColor: theme.primary, borderColor: theme.primary }
                  : { backgroundColor: theme.surface, borderColor: theme.border },
              ]}
              onPress={() => setFilter(f)}>
              <ThemedText
                style={[
                  styles.filterText,
                  { color: filter === f ? '#111' : theme.text },
                ]}>
                {f}
              </ThemedText>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Current Focus */}
        {currentFocus && (
          <View style={styles.currentFocusSection}>
            <View style={styles.currentFocusHeader}>
              <Ionicons name="flame" size={20} color={theme.primary} />
              <ThemedText type="subtitle" style={[styles.sectionTitle, { color: theme.text }]}>
                Current Focus
              </ThemedText>
            </View>
            <View style={[styles.focusCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={styles.focusHeader}>
                <View style={styles.focusContent}>
                  <ThemedText type="subtitle" style={[styles.focusTitle, { color: theme.text }]}>
                    {currentFocus.title}
                  </ThemedText>
                  <ThemedText style={[styles.focusDescription, { color: theme.textSecondary }]}>
                    {currentFocus.description}
                  </ThemedText>
                </View>
                <View style={[styles.rewardBadge, { backgroundColor: theme.primary + '33' }]}>
                  <ThemedText style={[styles.rewardText, { color: theme.text }]}>
                    ₱{currentFocus.reward.toFixed(2)} Bonus
                  </ThemedText>
                </View>
              </View>
              <View style={styles.progressSection}>
                <View style={styles.progressHeader}>
                  <ThemedText style={[styles.progressText, { color: theme.text }]}>
                    {currentFocus.progress} completed
                  </ThemedText>
                  <ThemedText style={[styles.progressText, { color: theme.text }]}>
                    {currentFocus.target} goal
                  </ThemedText>
                </View>
                <View style={[styles.progressBar, { backgroundColor: theme.border }]}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        backgroundColor: theme.primary,
                        width: `${getProgressPercentage(currentFocus)}%`,
                      },
                    ]}
                  />
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Other Missions */}
        <View style={styles.missionsSection}>
          <ThemedText type="subtitle" style={[styles.sectionTitle, { color: theme.text }]}>
            Other Missions
          </ThemedText>
          {missions
            .filter((m) => m.id !== currentFocus?.id)
            .map((mission) => (
              <View
                key={mission.id}
                style={[styles.missionCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <View style={[styles.missionIcon, { backgroundColor: theme.primary + '33' }]}>
                  <Ionicons name="trophy-outline" size={20} color={theme.primary} />
                </View>
                <View style={styles.missionContent}>
                  <View style={styles.missionHeader}>
                    <ThemedText style={[styles.missionTitle, { color: theme.text }]}>
                      {mission.title}
                    </ThemedText>
                    <View style={[styles.missionReward, { backgroundColor: theme.border }]}>
                      <ThemedText style={[styles.missionRewardText, { color: theme.text }]}>
                        +₱{mission.reward.toFixed(2)}
                      </ThemedText>
                    </View>
                  </View>
                  <ThemedText style={[styles.missionDescription, { color: theme.textSecondary }]}>
                    {mission.description}
                  </ThemedText>
                  {mission.status === 'Available' ? (
                    <TouchableOpacity
                      style={[styles.acceptButton, { borderColor: theme.primary }]}
                      onPress={() => handleClaim(mission.id)}>
                      <ThemedText style={[styles.acceptButtonText, { color: theme.primary }]}>
                        Accept Mission
                      </ThemedText>
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.missionProgress}>
                      <View style={[styles.missionProgressBar, { backgroundColor: theme.border }]}>
                        <View
                          style={[
                            styles.missionProgressFill,
                            {
                              backgroundColor: theme.primary,
                              width: `${getProgressPercentage(mission)}%`,
                            },
                          ]}
                        />
                      </View>
                      <ThemedText style={[styles.missionProgressText, { color: theme.textSecondary }]}>
                        {mission.progress}/{mission.target}
                      </ThemedText>
                    </View>
                  )}
                </View>
              </View>
            ))}
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
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
    alignItems: 'center',
    gap: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
  },
  statLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  filtersContainer: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterText: {
    fontSize: 14,
    fontWeight: '600',
  },
  currentFocusSection: {
    paddingHorizontal: 16,
    marginBottom: 24,
    gap: 12,
  },
  currentFocusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  focusCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 16,
  },
  focusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  focusContent: {
    flex: 1,
    gap: 4,
  },
  focusTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  focusDescription: {
    fontSize: 14,
  },
  rewardBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  rewardText: {
    fontSize: 14,
    fontWeight: '700',
  },
  progressSection: {
    gap: 8,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressText: {
    fontSize: 12,
    fontWeight: '600',
  },
  progressBar: {
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 6,
  },
  missionsSection: {
    paddingHorizontal: 16,
    gap: 12,
  },
  missionCard: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  missionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  missionContent: {
    flex: 1,
    gap: 8,
  },
  missionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  missionTitle: {
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  missionReward: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  missionRewardText: {
    fontSize: 12,
    fontWeight: '700',
  },
  missionDescription: {
    fontSize: 12,
  },
  acceptButton: {
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  acceptButtonText: {
    fontSize: 12,
    fontWeight: '700',
  },
  missionProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  missionProgressBar: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  missionProgressFill: {
    height: '100%',
    borderRadius: 4,
  },
  missionProgressText: {
    fontSize: 12,
    fontWeight: '700',
  },
});

