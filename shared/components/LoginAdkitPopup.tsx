import React, { useEffect, useMemo, useState } from 'react';
import { Image, Modal, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/features/auth';
import { campaignService, type CampaignItem } from '@/features/campaigns';
import { ThemedText } from '@/shared/components/themed-text';
import { useTheme } from '@/shared/hooks/use-theme';

export function LoginAdkitPopup() {
  const { user, isLoading } = useAuth();
  const theme = useTheme();
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [items, setItems] = useState<CampaignItem[]>([]);
  const [sessionKey, setSessionKey] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setSessionKey(null);
      setVisible(false);
      setItems([]);
    }
  }, [user]);

  useEffect(() => {
    const load = async () => {
      // Only show campaigns/giveaways if user is fully onboarded
      if (isLoading || !user || !user.isOnboarded) {
        setVisible(false);
        setItems([]);
        return;
      }
      
      const currentKey = `${user.id}:${Date.now()}`;
      if (sessionKey && sessionKey.startsWith(`${user.id}:`)) return;

      try {
        const active = await campaignService.getActiveCampaigns();
        setItems(active);
        setVisible(active.length > 0);
      } catch {
        setItems([]);
        setVisible(false);
      } finally {
        setSessionKey(currentKey);
      }
    };
    load();
  }, [isLoading, user, sessionKey]);

  const firstItem = useMemo(() => items[0], [items]);

  if (!firstItem) return null;

  const onCtaPress = () => {
    setVisible(false);
    const route = firstItem.ctaRoute;
    if (route) {
      try {
        router.push(route as any);
      } catch {
        // ignore invalid route
      }
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <ThemedText style={[styles.badge, { color: theme.primary }]}>
            {firstItem.type === 0 || firstItem.type === 'Giveaway' ? 'Giveaway' : 'News'}
          </ThemedText>
          <ThemedText type="subtitle" style={[styles.title, { color: theme.text }]}>
            {firstItem.title}
          </ThemedText>
          {!!firstItem.imageUrl && (
            <Image source={{ uri: firstItem.imageUrl }} style={styles.image} resizeMode="cover" />
          )}
          {!!firstItem.body && (
            <ThemedText style={[styles.body, { color: theme.textSecondary }]}>{firstItem.body}</ThemedText>
          )}
          <View style={styles.actions}>
            <TouchableOpacity style={[styles.btn, { backgroundColor: theme.border }]} onPress={() => setVisible(false)}>
              <ThemedText style={{ color: theme.text }}>Close</ThemedText>
            </TouchableOpacity>
            {!!firstItem.ctaText && (
              <TouchableOpacity style={[styles.btn, { backgroundColor: theme.primary }]} onPress={onCtaPress}>
                <ThemedText style={{ color: '#111', fontWeight: '700' }}>{firstItem.ctaText}</ThemedText>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  card: {
    width: '100%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 10,
  },
  badge: {
    fontSize: 12,
    fontWeight: '700',
  },
  title: {
    fontSize: 18,
  },
  body: {
    fontSize: 14,
  },
  image: {
    width: '100%',
    height: 160,
    borderRadius: 10,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 4,
  },
  btn: {
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
});
