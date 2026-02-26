import { apiClient } from '@/shared/services/apiClient';
import type {
  SupportTicket,
  CreateTicketRequest,
  FAQArticle,
  Conversation,
  ChatMessage,
  CreateConversationRequest,
  SendMessageRequest,
} from '../types';

/**
 * Service for managing support tickets, FAQ, and chat
 */
class SupportService {
  /**
   * Parse date string to Date object
   */
  private parseDate(dateString: string | null | undefined): Date | null {
    if (!dateString) {
      return null;
    }

    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return null;
      }
      return date;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get support tickets (all — requires back-office role).
   * GET /api/tickets
   */
  async getTickets(status?: string): Promise<SupportTicket[]> {
    try {
      const params: Record<string, string> = {};
      if (status) {
        params.status = status;
      }

      const response = await apiClient.get<{ data: { items: any[] } }>('/api/tickets', {
        requiresAuth: true,
        params,
      });

      if (!response.success || !response.data) {
        return [];
      }

      const data = response.data.data || response.data;
      const items = Array.isArray(data.items)
        ? data.items
        : Array.isArray(data)
          ? data
          : [];

      return items.map((ticket) => this.mapTicket(ticket, 'driver'));
    } catch (error) {
      console.error('Failed to fetch tickets:', error);
      throw new Error(
        `Failed to fetch tickets: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get current user's tickets (driver or customer).
   * GET /api/tickets/my
   */
  async getMyTickets(): Promise<SupportTicket[]> {
    try {
      const response = await apiClient.get<{ data: { items: any[] } }>('/api/tickets/my', {
        requiresAuth: true,
      });

      if (!response.success || !response.data) {
        return [];
      }

      const data = response.data.data || response.data;
      const items = Array.isArray(data?.items)
        ? data.items
        : Array.isArray(data)
          ? data
          : [];

      return items.map((ticket) => this.mapTicket(ticket, 'driver'));
    } catch (error) {
      console.error('Failed to fetch my tickets:', error);
      throw new Error(
        `Failed to fetch tickets: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get a single ticket by ID, optionally with Zammad updates/articles.
   * GET /api/tickets/{id}?includeZammad=true returns { ticket, zammad: { title, state, articles } }
   */
  async getTicket(ticketId: string, includeZammad = true): Promise<SupportTicket | null> {
    try {
      const params = includeZammad ? { includeZammad: true } : undefined;
      const response = await apiClient.get<SupportTicket | TicketWithZammadResponse>(`/api/tickets/${ticketId}`, {
        requiresAuth: true,
        params: params as Record<string, string | number | boolean> | undefined,
      });

      if (!response.success || !response.data) {
        return null;
      }

      // API returns { data: ticketDto } or { data: { ticket, zammad } } - unwrap
      const raw = response.data as { data?: unknown } | TicketWithZammadResponse | SupportTicket;
      const payload = raw && typeof raw === 'object' && 'data' in raw ? (raw as { data: unknown }).data : raw;
      if (!payload) return null;

      const withZammad = payload as TicketWithZammadResponse;
      if (withZammad.ticket) {
        const t = this.mapTicket(withZammad.ticket as any, 'driver');
        const zammad = withZammad.zammad;
        return {
          ...t,
          subject: t.subject || zammad?.title || t.subject,
          zammadArticles: zammad?.articles ?? [],
        };
      }
      return this.mapTicket(payload as any, 'driver');
    } catch (error) {
      console.error('Failed to fetch ticket:', error);
      return null;
    }
  }

  private mapTicket(ticket: any, defaultUserType: string): SupportTicket {
    return {
      id: ticket.id,
      ticketNumber: ticket.ticketNumber || `TKT-${(ticket.id || '').slice(0, 8)}`,
      subject: ticket.subject || '',
      description: ticket.description || '',
      category: ticket.category || 'General',
      priority: ticket.priority || 'Normal',
      status: ticket.status || 'Open',
      createdAt: this.parseDate(ticket.createdAt) || new Date(),
      updatedAt: this.parseDate(ticket.updatedAt),
      resolvedAt: this.parseDate(ticket.resolvedAt),
      resolution: ticket.resolution ?? null,
      zammadTicketId: ticket.zammadTicketId ?? null,
      userType: ticket.userType || defaultUserType,
      zammadArticles: ticket.zammadArticles,
    };
  }

  /**
   * Create support ticket
   * POST /api/tickets
   * Pass idempotencyKey to avoid duplicate tickets on double-submit or retry (same key = same ticket returned).
   */
  async createTicket(data: CreateTicketRequest, idempotencyKey?: string): Promise<SupportTicket> {
    try {
      console.log('[Support] createTicket: sending request...', { subject: data.subject?.slice(0, 30) });
      const headers: Record<string, string> = {};
      if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
      const response = await apiClient.post<SupportTicket>('/api/tickets', {
        requiresAuth: true,
        headers: Object.keys(headers).length ? headers : undefined,
        body: {
          ...data,
          userType: 'driver', // Always 'driver' from this app
        },
        timeout: 20000, // 20s - fail fast if backend hangs
      });

      console.log('[Support] createTicket: got response', { success: response.success, hasData: !!response.data });
      if (!response.success || !response.data) {
        throw new Error('Failed to create ticket');
      }

      // API returns { data: ticketDto } - unwrap if wrapped
      const raw = response.data as { data?: SupportTicket } | SupportTicket;
      const ticket = raw && typeof raw === 'object' && 'data' in raw ? raw.data : raw;
      if (!ticket) throw new Error('Failed to create ticket');

      console.log('[Support] createTicket: success');
      return this.mapTicket(ticket as any, 'driver');
    } catch (error) {
      const msg = error && typeof error === 'object' && 'message' in error
        ? String((error as { message: string }).message)
        : error instanceof Error ? error.message : 'Unknown error';
      console.error('[Support] createTicket failed:', msg, error);
      throw new Error(msg.includes('Failed to create ticket') ? msg : `Failed to create ticket: ${msg}`);
    }
  }

  /**
   * Add a comment to a ticket (syncs to Zammad).
   * POST /api/tickets/{id}/comments
   * Only allowed for open tickets; closed/resolved tickets cannot receive comments.
   */
  async addComment(ticketId: string, body: string): Promise<void> {
    const response = await apiClient.post(`/api/tickets/${ticketId}/comments`, {
      requiresAuth: true,
      body: { body },
    });

    if (!response.success) {
      throw new Error('Failed to add comment');
    }
  }

  /**
   * Get FAQ articles
   * GET /api/faq/articles
   */
  async getFAQ(category?: string): Promise<FAQArticle[]> {
    try {
      const params: Record<string, string> = {};
      if (category) {
        params.category = category;
      }

      const response = await apiClient.get<{ data: FAQArticle[] }>('/api/faq/articles', {
        requiresAuth: false, // FAQ is public
        params,
      });

      if (!response.success || !response.data) {
        return [];
      }

      // Handle both { data: [] } and [] formats
      const data = response.data.data || response.data;
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error('Failed to fetch FAQ:', error);
      return []; // Return empty array on error, FAQ is not critical
    }
  }

  /**
   * Get conversations
   * GET /api/chat/conversations
   */
  async getConversations(): Promise<Conversation[]> {
    try {
      const response = await apiClient.get<{ data: Conversation[] }>('/api/chat/conversations', {
        requiresAuth: true,
      });

      if (!response.success || !response.data) {
        return [];
      }

      // Handle both { data: [] } and [] formats
      const data = response.data.data || response.data;
      const conversations = Array.isArray(data) ? data : [];
      return conversations.map((conv) => ({
        ...conv,
        lastMessageAt: this.parseDate(conv.lastMessageAt as any),
        lastMessage: conv.lastMessage
          ? {
            ...conv.lastMessage,
            createdAt: this.parseDate(conv.lastMessage.createdAt as any) || new Date(),
          }
          : null,
        participants: (conv.participants || []).map((p) => ({
          ...p,
          joinedAt: this.parseDate(p.joinedAt as any) || new Date(),
          lastReadAt: this.parseDate(p.lastReadAt as any),
        })),
      }));
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
      throw new Error(
        `Failed to fetch conversations: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Create support conversation
   * POST /api/chat/conversations
   */
  async createSupportConversation(title: string): Promise<Conversation> {
    try {
      const response = await apiClient.post<Conversation>('/api/chat/conversations', {
        requiresAuth: true,
        body: {
          title,
          type: 'Support',
        } as CreateConversationRequest,
      });

      if (!response.success || !response.data) {
        throw new Error('Failed to create conversation');
      }

      const conv = response.data;
      return {
        ...conv,
        lastMessageAt: this.parseDate(conv.lastMessageAt as any),
        lastMessage: conv.lastMessage
          ? {
            ...conv.lastMessage,
            createdAt: this.parseDate(conv.lastMessage.createdAt as any) || new Date(),
          }
          : null,
        participants: (conv.participants || []).map((p) => ({
          ...p,
          joinedAt: this.parseDate(p.joinedAt as any) || new Date(),
          lastReadAt: this.parseDate(p.lastReadAt as any),
        })),
      };
    } catch (error) {
      console.error('Failed to create conversation:', error);
      throw new Error(
        `Failed to create conversation: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get messages for a conversation
   * GET /api/chat/conversations/{id}/messages
   */
  async getMessages(conversationId: string, skip = 0, take = 50): Promise<ChatMessage[]> {
    try {
      const response = await apiClient.get<{ data: ChatMessage[] }>(
        `/api/chat/conversations/${conversationId}/messages`,
        {
          requiresAuth: true,
          params: {
            skip: skip.toString(),
            take: take.toString(),
          },
        }
      );

      if (!response.success || !response.data) {
        return [];
      }

      // Handle both { data: [] } and [] formats
      const data = response.data.data || response.data;
      const messages = Array.isArray(data) ? data : [];
      return messages.map((msg) => ({
        ...msg,
        createdAt: this.parseDate(msg.createdAt as any) || new Date(),
      }));
    } catch (error) {
      console.error('Failed to fetch messages:', error);
      throw new Error(
        `Failed to fetch messages: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Send message
   * POST /api/chat/messages
   */
  async sendMessage(data: SendMessageRequest): Promise<ChatMessage> {
    try {
      const response = await apiClient.post<ChatMessage>('/api/chat/messages', {
        requiresAuth: true,
        body: data,
      });

      if (!response.success || !response.data) {
        throw new Error('Failed to send message');
      }

      const message = response.data;
      return {
        ...message,
        createdAt: this.parseDate(message.createdAt as any) || new Date(),
      };
    } catch (error) {
      console.error('Failed to send message:', error);
      throw new Error(
        `Failed to send message: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Mark conversation as read
   * POST /api/chat/conversations/{id}/read
   */
  async markAsRead(conversationId: string): Promise<void> {
    try {
      await apiClient.post(`/api/chat/conversations/${conversationId}/read`, {
        requiresAuth: true,
      });
    } catch (error) {
      console.error('Failed to mark as read:', error);
      // Don't throw, this is not critical
    }
  }
}

export const supportService = new SupportService();

