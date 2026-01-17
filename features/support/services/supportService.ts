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
   * Get support tickets
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

      // Handle both { data: { items: [] } } and { data: [] } formats
      const data = response.data.data || response.data;
      const items = Array.isArray(data.items)
        ? data.items
        : Array.isArray(data)
        ? data
        : [];

      return items.map((ticket) => ({
        id: ticket.id,
        ticketNumber: ticket.ticketNumber || `TKT-${ticket.id.slice(0, 8)}`,
        subject: ticket.subject || '',
        description: ticket.description || '',
        category: ticket.category || 'General',
        priority: ticket.priority || 'Normal',
        status: ticket.status || 'Open',
        createdAt: this.parseDate(ticket.createdAt) || new Date(),
        updatedAt: this.parseDate(ticket.updatedAt),
        resolvedAt: this.parseDate(ticket.resolvedAt),
        resolution: ticket.resolution ?? null,
      }));
    } catch (error) {
      console.error('Failed to fetch tickets:', error);
      throw new Error(
        `Failed to fetch tickets: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Create support ticket
   * POST /api/tickets
   */
  async createTicket(data: CreateTicketRequest): Promise<SupportTicket> {
    try {
      const response = await apiClient.post<SupportTicket>('/api/tickets', {
        requiresAuth: true,
        body: data,
      });

      if (!response.success || !response.data) {
        throw new Error('Failed to create ticket');
      }

      const ticket = response.data;
      return {
        ...ticket,
        createdAt: this.parseDate(ticket.createdAt as any) || new Date(),
        updatedAt: this.parseDate(ticket.updatedAt as any),
        resolvedAt: this.parseDate(ticket.resolvedAt as any),
      };
    } catch (error) {
      console.error('Failed to create ticket:', error);
      throw new Error(
        `Failed to create ticket: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
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

