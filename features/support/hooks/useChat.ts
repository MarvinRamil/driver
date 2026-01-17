import { useCallback, useEffect, useState, useRef } from 'react';
import { supportService } from '../services/supportService';
import { chatSignalRService } from '../services/chatSignalRService';
import type { ChatMessage, Conversation, SendMessageRequest } from '../types';
// Import useAuth directly from hook to avoid circular dependency
import { useAuth } from '@/features/auth/hooks/useAuth';

interface UseChatReturn {
  /** Messages in current conversation */
  messages: ChatMessage[];
  /** Current conversation */
  conversation: Conversation | null;
  /** Loading state */
  isLoading: boolean;
  /** Error message */
  error: string | null;
  /** SignalR connection state */
  isConnected: boolean;
  /** Send a message */
  sendMessage: (content: string) => Promise<void>;
  /** Load messages */
  loadMessages: () => Promise<void>;
  /** Mark as read */
  markAsRead: () => Promise<void>;
  /** Typing indicator state */
  isTyping: boolean;
  /** Set typing indicator */
  setTyping: (typing: boolean) => void;
}

/**
 * Hook for managing chat in a conversation with SignalR real-time updates
 */
export function useChat(conversationId: string | null): UseChatReturn {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const previousConversationIdRef = useRef<string | null>(null);

  // Initialize SignalR connection
  useEffect(() => {
    const initSignalR = async () => {
      try {
        await chatSignalRService.start();
        setIsConnected(chatSignalRService.isConnected());

        // Listen for connection state changes
        chatSignalRService.onConnectionStateChange((state) => {
          setIsConnected(state === 'Connected');
        });

        // Listen for new messages
        chatSignalRService.onReceiveMessage((message) => {
          // Only add message if it's for the current conversation
          if (message.conversationId === conversationId) {
            setMessages((prev) => {
              // Check if message already exists (avoid duplicates)
              const exists = prev.some((m) => m.id === message.id);
              if (exists) return prev;
              return [message, ...prev];
            });
          }
        });
      } catch (err) {
        console.error('Failed to initialize SignalR:', err);
        setError('Failed to connect to chat service');
      }
    };

    initSignalR();

    return () => {
      // Cleanup: leave conversation and stop SignalR if no conversations are active
      if (previousConversationIdRef.current) {
        chatSignalRService.leaveConversation(previousConversationIdRef.current);
      }
      // Note: We don't stop SignalR here as it might be used by other components
      // It will be stopped when the app closes or user logs out
    };
  }, []);

  // Join/leave conversation when conversationId changes
  useEffect(() => {
    const joinConversation = async () => {
      if (!conversationId || !chatSignalRService.isConnected()) {
        return;
      }

      // Leave previous conversation
      if (previousConversationIdRef.current) {
        await chatSignalRService.leaveConversation(previousConversationIdRef.current);
      }

      // Join new conversation
      try {
        await chatSignalRService.joinConversation(conversationId);
        previousConversationIdRef.current = conversationId;
      } catch (err) {
        console.error('Error joining conversation:', err);
      }
    };

    joinConversation();
  }, [conversationId]);

  const loadMessages = useCallback(async () => {
    if (!conversationId) {
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const data = await supportService.getMessages(conversationId);
      // Reverse to show oldest first (SignalR adds newest first)
      setMessages(data.reverse());
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load messages';
      setError(errorMessage);
      console.error('Error loading messages:', err);
    } finally {
      setIsLoading(false);
    }
  }, [conversationId]);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!conversationId || !content.trim()) {
        return;
      }

      try {
        // Use REST API to send message (SignalR will broadcast it)
        const newMessage = await supportService.sendMessage({
          conversationId,
          content: content.trim(),
        });
        // Add message optimistically (SignalR will also send it, but we add it immediately for better UX)
        setMessages((prev) => {
          const exists = prev.some((m) => m.id === newMessage.id);
          if (exists) return prev;
          return [newMessage, ...prev];
        });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to send message';
        setError(errorMessage);
        throw err;
      }
    },
    [conversationId]
  );

  const markAsRead = useCallback(async () => {
    if (!conversationId) {
      return;
    }

    try {
      await supportService.markAsRead(conversationId);
      // Also mark via SignalR
      await chatSignalRService.markAsRead(conversationId);
    } catch (err) {
      console.error('Error marking as read:', err);
    }
  }, [conversationId]);

  const setTyping = useCallback(
    (typing: boolean) => {
      if (!conversationId || !chatSignalRService.isConnected()) {
        return;
      }

      setIsTyping(typing);

      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }

      if (typing) {
        chatSignalRService.startTyping(conversationId);
        // Auto-stop typing after 3 seconds
        typingTimeoutRef.current = setTimeout(() => {
          setIsTyping(false);
          chatSignalRService.stopTyping(conversationId);
        }, 3000);
      } else {
        chatSignalRService.stopTyping(conversationId);
      }
    },
    [conversationId]
  );

  useEffect(() => {
    if (conversationId) {
      loadMessages();
      markAsRead();
    }
  }, [conversationId, loadMessages, markAsRead]);

  // Cleanup typing timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  return {
    messages,
    conversation,
    isLoading,
    error,
    isConnected,
    sendMessage,
    loadMessages,
    markAsRead,
    isTyping,
    setTyping,
  };
}

