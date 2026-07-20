import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Share,
  Image,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/shared/hooks/use-theme';
import { BeeColors } from '@/constants/theme';
import { useAuth } from '@/features/auth';
import {
  referralService,
  ReferralCode,
  UserPoints,
  ReferralEntry,
} from '@/features/referrals/services/referralService';

/**
 * Refer & Earn screen
 * Shows the driver's referral code + QR, lets them share the link,
 * and lists their points and referred users.
 */
export default function ReferralsScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const router = useRouter();
  const { user } = useAuth();

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState<ReferralCode | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [points, setPoints] = useState<UserPoints | null>(null);
  const [referrals, setReferrals] = useState<ReferralEntry[]>([]);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setError(null);
    try {
      const myCode = await referralService.getMyCode(user.id);
      setCode(myCode);
      // Secondary data — failures here shouldn't block the code display
      const [qr, pts, refs] = await Promise.allSettled([
        referralService.getQrCode(user.id),
        referralService.getPoints(user.id),
        referralService.getReferrals(user.id),
      ]);
      if (qr.status === 'fulfilled') setQrCode(qr.value.qrCode);
      if (pts.status === 'fulfilled') setPoints(pts.value);
      if (refs.status === 'fulfilled') setReferrals(refs.value);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load your referral code');
    }
  }, [user?.id]);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      await load();
      setIsLoading(false);
    })();
  }, [load]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await load();
    setIsRefreshing(false);
  };

  const handleShare = async () => {
    if (!code) return;
    try {
      await Share.share({
        message: `Join me on Bee On-Demand! Use my referral code ${code.code} when you sign up: ${code.referralLink}`,
      });
    } catch {
      // user dismissed the share sheet
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  const completedCount = referrals.filter((r) => r.status === 'Completed').length;

  return (
    <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.text }]}>Refer & Earn</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
        showsVerticalScrollIndicator={false}>
        {error ? (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={16} color={BeeColors.red[600]} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : (
          <>
            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={[styles.cardLabel, { color: theme.textSecondary }]}>Your referral code</Text>
              <Text style={[styles.code, { color: theme.text }]}>{code?.code}</Text>

              {qrCode && (
                <Image
                  source={{
                    uri: qrCode.startsWith('data:') ? qrCode : `data:image/png;base64,${qrCode}`,
                  }}
                  style={styles.qr}
                />
              )}

              <TouchableOpacity
                style={[styles.shareButton, { backgroundColor: theme.primary }]}
                onPress={handleShare}>
                <Ionicons name="share-social-outline" size={20} color={theme.primaryText} />
                <Text style={[styles.shareButtonText, { color: theme.primaryText }]}>
                  Share your link
                </Text>
              </TouchableOpacity>

              <Text style={[styles.hint, { color: theme.textSecondary }]}>
                Friends who sign up with your code earn you points once they complete their first
                booking.
              </Text>
            </View>

            <View style={styles.statsRow}>
              <View style={[styles.statCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text style={[styles.statValue, { color: theme.text }]}>
                  {points?.availablePoints ?? 0}
                </Text>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Available pts</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text style={[styles.statValue, { color: theme.text }]}>
                  {points?.pendingPoints ?? 0}
                </Text>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Pending pts</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text style={[styles.statValue, { color: theme.text }]}>
                  {completedCount}/{referrals.length}
                </Text>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Referrals</Text>
              </View>
            </View>

            {referrals.length > 0 && (
              <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text style={[styles.cardLabel, { color: theme.textSecondary }]}>Your referrals</Text>
                {referrals.map((r) => (
                  <View key={r.id} style={[styles.referralRow, { borderBottomColor: theme.border }]}>
                    <Ionicons
                      name={r.status === 'Completed' ? 'checkmark-circle' : 'time-outline'}
                      size={20}
                      color={r.status === 'Completed' ? BeeColors.yellow[500] : theme.textSecondary}
                    />
                    <View style={styles.referralInfo}>
                      <Text style={[styles.referralStatus, { color: theme.text }]}>{r.status}</Text>
                      <Text style={[styles.referralDate, { color: theme.textSecondary }]}>
                        {new Date(r.referredAt).toLocaleDateString()}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 8,
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
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 16,
  },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  cardLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
    alignSelf: 'flex-start',
  },
  code: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 16,
  },
  qr: {
    width: 180,
    height: 180,
    marginBottom: 16,
    borderRadius: 8,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignSelf: 'stretch',
  },
  shareButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  hint: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 18,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  referralRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
  },
  referralInfo: {
    flex: 1,
  },
  referralStatus: {
    fontSize: 15,
    fontWeight: '600',
  },
  referralDate: {
    fontSize: 12,
    marginTop: 2,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BeeColors.red[50],
    borderWidth: 1,
    borderColor: BeeColors.red[200],
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: BeeColors.red[700],
  },
});
