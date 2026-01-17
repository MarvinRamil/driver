/**
 * Support feature types
 */

/**
 * Support ticket
 */
export interface SupportTicket {
  id: string;
  ticketNumber: string;
  subject: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  createdAt: Date;
  updatedAt: Date | null;
  resolvedAt: Date | null;
  resolution: string | null;
}

/**
 * Ticket category
 */
export type TicketCategory = 'General' | 'Booking' | 'Payment' | 'Delivery' | 'Complaint' | 'Feedback';

/**
 * Ticket priority
 */
export type TicketPriority = 'Low' | 'Normal' | 'High' | 'Urgent';

/**
 * Ticket status
 */
export type TicketStatus = 'Open' | 'InProgress' | 'WaitingCustomer' | 'Resolved' | 'Closed';

/**
 * Create ticket request
 */
export interface CreateTicketRequest {
  subject: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
  bookingId?: string;
}

/**
 * FAQ article
 */
export interface FAQArticle {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string;
  isPublished: boolean;
  sortOrder: number;
}

/**
 * Conversation for chat
 */
export interface Conversation {
  id: string;
  title: string;
  type: ConversationType;
  bookingId: string | null;
  dispatchId: string | null;
  lastMessageAt: Date | null;
  unreadCount: number;
  lastMessage: ChatMessage | null;
  participants: Participant[];
}

/**
 * Conversation type
 */
export type ConversationType = 'Direct' | 'Group' | 'Support' | 'Dispatch' | 'Business';

/**
 * Chat message
 */
export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  content: string;
  messageType: MessageType;
  createdAt: Date;
  isEdited: boolean;
  isDeleted: boolean;
}

/**
 * Message type
 */
export type MessageType = 'Text' | 'Image' | 'File' | 'System';

/**
 * Participant
 */
export interface Participant {
  userId: string;
  userName: string;
  joinedAt: Date;
  lastReadAt: Date | null;
}

/**
 * Create conversation request
 */
export interface CreateConversationRequest {
  title: string;
  type: ConversationType;
  participantIds?: string[];
  bookingId?: string | null;
  dispatchId?: string | null;
}

/**
 * Send message request
 */
export interface SendMessageRequest {
  conversationId: string;
  content: string;
}

