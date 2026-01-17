import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, View, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/shared/hooks/use-theme';
import { useChat, supportService } from '@/features/support';
import { useAuth } from '@/features/auth';
import { ThemedView } from '@/shared/components/themed-view';
import { ThemedText } from '@/shared/components/themed-text';
import { Ionicons } from '@expo/vector-icons';

/**
 * Chat screen for support conversations
 */
export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ conversationId?: string }>();
  const { user } = useAuth();
  const {
    messages,
    isLoading,
    error,
    isConnected,
    sendMessage,
    loadMessages,
    isTyping,
    setTyping,
  } = useChat(params.conversationId || null);
  const [messageText, setMessageText] = useState('');
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (messages.length > 0) {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }
  }, [messages]);

  const handleSend = async () => {
    if (!messageText.trim() || !params.conversationId) {
      return;
    }

    try {
      setTyping(false); // Stop typing when sending
      await sendMessage(messageText);
      setMessageText('');
    } catch (err) {
      // Error handled by hook
    }
  };

  const handleTextChange = (text: string) => {
    setMessageText(text);
    // Show typing indicator when user types
    if (text.trim().length > 0 && !isTyping) {
      setTyping(true);
    } else if (text.trim().length === 0 && isTyping) {
      setTyping(false);
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const isMyMessage = (senderId: string) => {
    return senderId === user?.id;
  };

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={styles.headerTitleRow}>
            <ThemedText type="title" style={[styles.headerTitle, { color: theme.text }]}>
              Support Chat
            </ThemedText>
            <View
              style={[
                styles.connectionIndicator,
                { backgroundColor: isConnected ? theme.success : theme.error },
              ]}
            />
          </View>
          <ThemedText style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
            {isConnected ? "We'll respond as soon as possible" : 'Connecting...'}
          </ThemedText>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      {/* Messages */}
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={insets.top + 60}>
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}>
          {isLoading && messages.length === 0 ? (
            <View style={styles.loadingContainer}>
              <ThemedText style={[styles.loadingText, { color: theme.textSecondary }]}>
                Loading messages...
              </ThemedText>
            </View>
          ) : messages.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="chatbubble-outline" size={48} color={theme.textSecondary} />
              <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
                {isLoading
                  ? 'Loading messages...'
                  : 'No messages yet. Start the conversation!'}
              </ThemedText>
            </View>
          ) : (
            <>
              {isTyping && (
                <View style={styles.typingIndicator}>
                  <ThemedText style={[styles.typingText, { color: theme.textSecondary }]}>
                    Support is typing...
                  </ThemedText>
                </View>
              )}
              {messages.map((message, index) => {
              const isMine = isMyMessage(message.senderId);
              const showAvatar = index === 0 || messages[index - 1].senderId !== message.senderId;

              return (
                <View
                  key={message.id}
                  style={[
                    styles.messageContainer,
                    isMine ? styles.messageContainerRight : styles.messageContainerLeft,
                  ]}>
                  {!isMine && showAvatar && (
                    <View style={[styles.avatar, { backgroundColor: theme.primary }]}>
                      <Ionicons name="person" size={16} color="#111" />
                    </View>
                  )}
                  <View
                    style={[
                      styles.messageBubble,
                      {
                        backgroundColor: isMine ? theme.primary : theme.border,
                        marginLeft: isMine ? 'auto' : showAvatar ? 8 : 40,
                        marginRight: isMine ? (showAvatar ? 8 : 40) : 'auto',
                      },
                    ]}>
                    {!isMine && (
                      <ThemedText style={[styles.messageSender, { color: theme.textSecondary }]}>
                        {message.senderName}
                      </ThemedText>
                    )}
                    <ThemedText
                      style={[
                        styles.messageText,
                        { color: isMine ? '#111' : theme.text },
                      ]}>
                      {message.content}
                    </ThemedText>
                    <ThemedText
                      style={[
                        styles.messageTime,
                        { color: isMine ? '#111' + '80' : theme.textSecondary },
                      ]}>
                      {formatTime(message.createdAt)}
                    </ThemedText>
                  </View>
                  {isMine && showAvatar && (
                    <View style={[styles.avatar, { backgroundColor: theme.primary }]}>
                      <Ionicons name="person" size={16} color="#111" />
                    </View>
                  )}
                </View>
                  );
                })}
              </>
            )}
          </ScrollView>

        {/* Input Area */}
        <View style={[styles.inputContainer, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
            <TextInput
              style={[styles.input, { backgroundColor: theme.border, color: theme.text }]}
              placeholder="Type your message..."
              placeholderTextColor={theme.textSecondary}
              value={messageText}
              onChangeText={handleTextChange}
              multiline
              maxLength={500}
              editable={isConnected}
            />
          <TouchableOpacity
            style={[
              styles.sendButton,
              { backgroundColor: messageText.trim() ? theme.primary : theme.border },
            ]}
            onPress={handleSend}
            disabled={!messageText.trim()}>
            <Ionicons
              name="send"
              size={20}
              color={messageText.trim() ? '#111' : theme.textSecondary}
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 12,
  },
  connectionIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  headerSpacer: {
    width: 40,
  },
  keyboardView: {
    flex: 1,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 16,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  loadingText: {
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 16,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
  },
  messageContainer: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'flex-end',
  },
  messageContainerLeft: {
    justifyContent: 'flex-start',
  },
  messageContainerRight: {
    justifyContent: 'flex-end',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageBubble: {
    maxWidth: '75%',
    padding: 12,
    borderRadius: 16,
    gap: 4,
  },
  messageSender: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  messageTime: {
    fontSize: 10,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    gap: 8,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    padding: 12,
    borderRadius: 20,
    maxHeight: 100,
    fontSize: 16,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typingIndicator: {
    padding: 12,
    alignItems: 'flex-start',
  },
  typingText: {
    fontSize: 12,
    fontStyle: 'italic',
  },
});

