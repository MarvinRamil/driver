import { useCallback, useEffect, useState } from 'react';
import { supportService } from '../services/supportService';
import type { SupportTicket, FAQArticle, Conversation } from '../types';

interface UseSupportReturn {
  /** Support tickets */
  tickets: SupportTicket[];
  /** FAQ articles */
  faq: FAQArticle[];
  /** Conversations */
  conversations: Conversation[];
  /** Loading state */
  isLoading: boolean;
  /** Error message */
  error: string | null;
  /** Refresh all data */
  refresh: () => Promise<void>;
  /** Refresh tickets */
  refreshTickets: () => Promise<void>;
  /** Refresh FAQ */
  refreshFAQ: () => Promise<void>;
  /** Refresh conversations */
  refreshConversations: () => Promise<void>;
}

/**
 * Hook for managing support data
 */
export function useSupport(): UseSupportReturn {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [faq, setFAQ] = useState<FAQArticle[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTickets = useCallback(async () => {
    try {
      const data = await supportService.getMyTickets();
      setTickets(data);
    } catch (err) {
      console.error('Error fetching tickets:', err);
    }
  }, []);

  const fetchFAQ = useCallback(async () => {
    try {
      const data = await supportService.getFAQ();
      setFAQ(data);
    } catch (err) {
      console.error('Error fetching FAQ:', err);
    }
  }, []);

  const fetchConversations = useCallback(async () => {
    try {
      const data = await supportService.getConversations();
      setConversations(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch conversations';
      setError(errorMessage);
      console.error('Error fetching conversations:', err);
    }
  }, []);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      await Promise.all([fetchTickets(), fetchFAQ(), fetchConversations()]);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to refresh';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [fetchTickets, fetchFAQ, fetchConversations]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    tickets,
    faq,
    conversations,
    isLoading,
    error,
    refresh,
    refreshTickets: fetchTickets,
    refreshFAQ: fetchFAQ,
    refreshConversations: fetchConversations,
  };
}

