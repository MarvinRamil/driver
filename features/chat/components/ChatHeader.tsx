import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/shared/hooks/use-theme';
import type { ChatConnectionStatus, RoomLifecycleState } from '../types';

const STATUS_COLORS: Record<ChatConnectionStatus, string> = {
  idle: '#94a3b8',
  connecting: '#f59e0b',
  live: '#22c55e',
  reconnecting: '#f59e0b',
  error: '#ef4444',
};

interface ChatHeaderProps {
  title: string;
  subtitle?: string;
  connectionStatus: ChatConnectionStatus;
  roomState: RoomLifecycleState;
  onBack: () => void;
}

export function ChatHeader({ title, subtitle, connectionStatus, roomState, onBack }: ChatHeaderProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const banner =
    roomState === 'frozen'
      ? 'This conversation is read-only.'
      : roomState === 'unavailable'
        ? 'Chat is no longer available for this booking.'
        : null;

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
      <View style={styles.row}>
        <TouchableOpacity onPress={onBack} style={styles.backButton} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="chevron-back" size={26} color={theme.text} />
        </TouchableOpacity>
        <View style={styles.titleBlock}>
          <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={[styles.subtitle, { color: theme.textSecondary }]} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[connectionStatus] }]} />
      </View>
      {banner ? (
        <View style={[styles.banner, { backgroundColor: theme.inputBackground }]}>
          <Ionicons name="lock-closed-outline" size={14} color={theme.textSecondary} />
          <Text style={[styles.bannerText, { color: theme.textSecondary }]}>{banner}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 12,
    paddingTop: 8,
  },
  backButton: {
    padding: 4,
  },
  titleBlock: {
    flex: 1,
    marginLeft: 4,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 8,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  bannerText: {
    fontSize: 12,
  },
});
