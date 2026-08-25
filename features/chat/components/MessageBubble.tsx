import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/shared/hooks/use-theme';
import type { ChatMessage } from '../types';

function noticeCopy(message: ChatMessage): { icon: keyof typeof Ionicons.glyphMap; text: string } {
  if (message.appBeeEvent === 'driver_assigned') {
    return {
      icon: 'person-add-outline',
      text: message.appBeeDriverName ? `${message.appBeeDriverName} was assigned to this booking.` : message.body,
    };
  }
  return { icon: 'information-circle-outline', text: message.body };
}

interface MessageBubbleProps {
  message: ChatMessage;
  isOwn: boolean;
  onRetry?: () => void;
}

export function MessageBubble({ message, isOwn, onRetry }: MessageBubbleProps) {
  const theme = useTheme();

  if (message.kind === 'notice') {
    const { icon, text } = noticeCopy(message);
    return (
      <View style={styles.noticeRow}>
        <View style={[styles.noticePill, { backgroundColor: theme.inputBackground }]}>
          <Ionicons name={icon} size={13} color={theme.textSecondary} />
          <Text style={[styles.noticeText, { color: theme.textSecondary }]}>{text}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.row, isOwn ? styles.rowOwn : styles.rowOther]}>
      <View
        style={[
          styles.bubble,
          isOwn
            ? { backgroundColor: theme.primary, borderBottomRightRadius: 4 }
            : { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1, borderBottomLeftRadius: 4 },
        ]}
      >
        <Text style={[styles.bodyText, { color: isOwn ? theme.primaryText : theme.text }]}>{message.body}</Text>
      </View>
      {isOwn ? (
        <View style={styles.statusRow}>
          {message.status === 'sending' ? <ActivityIndicator size="small" color={theme.textMuted} /> : null}
          {message.status === 'failed' ? (
            <TouchableOpacity onPress={onRetry} style={styles.retryButton}>
              <Ionicons name="refresh" size={12} color={theme.error} />
              <Text style={[styles.retryText, { color: theme.error }]}>Failed — tap to retry</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  noticeRow: {
    alignItems: 'center',
    marginVertical: 8,
  },
  noticePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    maxWidth: '85%',
  },
  noticeText: {
    fontSize: 12,
    flexShrink: 1,
  },
  row: {
    marginVertical: 4,
    maxWidth: '80%',
  },
  rowOwn: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  rowOther: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  bubble: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bodyText: {
    fontSize: 15,
    lineHeight: 20,
  },
  statusRow: {
    marginTop: 2,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  retryText: {
    fontSize: 11,
  },
});
