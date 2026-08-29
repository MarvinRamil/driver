import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { matrixClient } from '../services/matrixClient';
import type { ChatConnectionStatus, ChatMessage } from '../types';

function mergeMessages(existing: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const byKey = new Map<string, ChatMessage>();
  for (const message of existing) {
    byKey.set(message.txnId ?? message.eventId, message);
  }
  for (const message of incoming) {
    // A confirmed echo of an optimistic send carries the same txnId — replace it
    // in place instead of appending a duplicate bubble.
    const key = message.txnId && byKey.has(message.txnId) ? message.txnId : message.eventId;
    byKey.set(key, message);
  }
  return Array.from(byKey.values()).sort((a, b) => a.sentAt - b.sentAt);
}

/** Loads history and live-subscribes to a room's messages while the screen is focused. */
export function useChatMessages(roomId: string | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [hasMoreHistory, setHasMoreHistory] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<ChatConnectionStatus>('idle');
  const nextTokenRef = useRef<string | undefined>(undefined);
  const lastReadRef = useRef<{ eventId: string; at: number } | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!roomId) {
        return;
      }

      let cancelled = false;
      setMessages([]);
      nextTokenRef.current = undefined;
      setHasMoreHistory(true);

      matrixClient.startSyncLoop();

      const unsubscribeMessages = matrixClient.subscribeToRoomMessages(roomId, (message) => {
        if (cancelled) return;
        setMessages((prev) => mergeMessages(prev, [message]));
      });
      const unsubscribeStatus = matrixClient.subscribeToConnectionStatus((status) => {
        if (!cancelled) setConnectionStatus(status);
      });

      setIsLoadingHistory(true);
      matrixClient
        .fetchHistory(roomId, { limit: 50 })
        .then(({ messages: history, nextToken }) => {
          if (cancelled) return;
          setMessages((prev) => mergeMessages(prev, history));
          nextTokenRef.current = nextToken;
          setHasMoreHistory(!!nextToken);
        })
        .catch(() => {
          // History failure isn't fatal — live messages via /sync still work.
        })
        .finally(() => {
          if (!cancelled) setIsLoadingHistory(false);
        });

      return () => {
        cancelled = true;
        unsubscribeMessages();
        unsubscribeStatus();
        matrixClient.stopSyncLoop();
      };
    }, [roomId])
  );

  const loadMoreHistory = useCallback(() => {
    if (!roomId || !nextTokenRef.current || isLoadingHistory) return;
    setIsLoadingHistory(true);
    matrixClient
      .fetchHistory(roomId, { limit: 50, fromToken: nextTokenRef.current })
      .then(({ messages: history, nextToken }) => {
        setMessages((prev) => mergeMessages(prev, history));
        nextTokenRef.current = nextToken;
        setHasMoreHistory(!!nextToken);
      })
      .finally(() => setIsLoadingHistory(false));
  }, [roomId, isLoadingHistory]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!roomId) return;
      const trimmed = text.trim();
      if (!trimmed) return;

      const txnId = matrixClient.generateTxnId();
      const optimistic: ChatMessage = {
        eventId: txnId,
        txnId,
        roomId,
        senderMxid: '',
        senderRole: 'driver',
        kind: 'text',
        body: trimmed,
        sentAt: Date.now(),
        status: 'sending',
      };
      setMessages((prev) => mergeMessages(prev, [optimistic]));

      try {
        await matrixClient.sendMessage(roomId, trimmed, txnId);
        setMessages((prev) => prev.map((m) => (m.eventId === txnId ? { ...m, status: 'sent' } : m)));
      } catch {
        setMessages((prev) => prev.map((m) => (m.eventId === txnId ? { ...m, status: 'failed' } : m)));
      }
    },
    [roomId]
  );

  const retrySend = useCallback(
    async (txnId: string) => {
      if (!roomId) return;
      const target = messages.find((m) => m.eventId === txnId);
      if (!target) return;

      setMessages((prev) => prev.map((m) => (m.eventId === txnId ? { ...m, status: 'sending' } : m)));
      try {
        await matrixClient.retrySend(roomId, target.body, txnId);
        setMessages((prev) => prev.map((m) => (m.eventId === txnId ? { ...m, status: 'sent' } : m)));
      } catch {
        setMessages((prev) => prev.map((m) => (m.eventId === txnId ? { ...m, status: 'failed' } : m)));
      }
    },
    [roomId, messages]
  );

  const markRead = useCallback(
    (eventId: string) => {
      if (!roomId) return;
      const now = Date.now();
      if (lastReadRef.current?.eventId === eventId && now - lastReadRef.current.at < 2000) return;
      lastReadRef.current = { eventId, at: now };
      matrixClient.sendReadReceipt(roomId, eventId).catch(() => {});
    },
    [roomId]
  );

  const isSending = messages.some((m) => m.status === 'sending');

  return {
    messages,
    isLoadingHistory,
    hasMoreHistory,
    loadMoreHistory,
    sendMessage,
    retrySend,
    isSending,
    connectionStatus,
    markRead,
  };
}
