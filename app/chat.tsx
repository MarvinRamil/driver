import React, { useCallback, useMemo } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/shared/hooks/use-theme';
import {
  ChatComposer,
  ChatHeader,
  MessageBubble,
  useBookingChatRoom,
  useChatMessages,
} from '@/features/chat';
import type { ChatMessage } from '@/features/chat';

export default function ChatScreen() {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { bookingId, roomId: roomIdHint, counterpartName } = useLocalSearchParams<{
    bookingId: string;
    roomId?: string;
    counterpartName?: string;
  }>();

  const { room, isResolving, error, retry } = useBookingChatRoom(bookingId, roomIdHint);
  const activeRoomId = room && room.state !== 'not_provisioned' ? room.roomId : null;
  const { messages, sendMessage, retrySend, connectionStatus, markRead, loadMoreHistory, hasMoreHistory } =
    useChatMessages(activeRoomId);

  const inverted = useMemo(() => [...messages].reverse(), [messages]);

  const handleBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  }, [router]);

  const renderItem = useCallback(
    ({ item }: { item: ChatMessage }) => (
      <MessageBubble
        message={item}
        isOwn={item.kind === 'text' && item.senderRole === 'driver'}
        onRetry={() => retrySend(item.eventId)}
      />
    ),
    [retrySend]
  );

  const roomState = room?.state ?? 'unknown';
  const composerDisabled = roomState !== 'active';
  const composerReason =
    roomState === 'frozen'
      ? 'This conversation is read-only.'
      : roomState === 'unavailable'
        ? 'Chat is no longer available.'
        : roomState === 'not_provisioned'
          ? 'Setting up chat…'
          : undefined;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={insets.top}
    >
      <ChatHeader
        title={counterpartName || 'Customer'}
        subtitle={isResolving ? 'Setting up chat…' : undefined}
        connectionStatus={connectionStatus}
        roomState={roomState}
        onBack={handleBack}
      />

      {isResolving ? (
        <View style={styles.centered}>
          <Text style={{ color: theme.textSecondary }}>Setting up chat…</Text>
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={{ color: theme.textSecondary, textAlign: 'center', marginBottom: 12 }}>{error.message}</Text>
          <Text style={{ color: theme.primary }} onPress={retry}>
            Tap to retry
          </Text>
        </View>
      ) : (
        <FlatList
          style={styles.list}
          contentContainerStyle={styles.listContent}
          data={inverted}
          inverted
          keyExtractor={(item) => item.eventId}
          renderItem={renderItem}
          onEndReached={() => {
            if (hasMoreHistory) loadMoreHistory();
          }}
          onEndReachedThreshold={0.3}
          onViewableItemsChanged={({ viewableItems }) => {
            const first = viewableItems[0]?.item as ChatMessage | undefined;
            if (first) markRead(first.eventId);
          }}
        />
      )}

      <ChatComposer disabled={composerDisabled} disabledReason={composerReason} onSend={sendMessage} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
});
