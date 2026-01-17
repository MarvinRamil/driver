import * as signalR from '@microsoft/signalr';
import { tokenStorage } from '@/shared/services/tokenStorage';
import type { ChatMessage } from '../types';

/**
 * SignalR service for real-time chat messaging
 * Connects to /hubs/chat endpoint
 */
class ChatSignalRService {
  private connection: signalR.HubConnection | null = null;
  private apiBaseUrl: string;

  constructor() {
    // Get API base URL from environment or default
    this.apiBaseUrl = process.env.EXPO_PUBLIC_API_URL || 'https://localhost:5001';
    // Remove /api suffix if present for SignalR
    this.apiBaseUrl = this.apiBaseUrl.replace(/\/api$/, '');
  }

  /**
   * Start SignalR connection
   * Non-blocking - errors are logged but don't throw
   */
  async start(): Promise<void> {
    try {
      const token = await tokenStorage.getAccessToken();
      if (!token) {
        console.warn('No access token available for SignalR connection');
        return;
      }

      // Don't recreate if already connected
      if (this.connection?.state === signalR.HubConnectionState.Connected) {
        return;
      }

      // Don't recreate if connecting
      if (this.connection?.state === signalR.HubConnectionState.Connecting) {
        return;
      }
    } catch (err) {
      console.warn('Error checking token for SignalR:', err);
      return;
    }

    this.connection = new signalR.HubConnectionBuilder()
      .withUrl(`${this.apiBaseUrl}/hubs/chat`, {
        accessTokenFactory: async () => {
          const currentToken = await tokenStorage.getAccessToken();
          return currentToken || '';
        },
      })
      .withAutomaticReconnect({
        nextRetryDelayInMilliseconds: (retryContext) => {
          // Exponential backoff: 0s, 2s, 10s, 30s
          if (retryContext.previousRetryCount === 0) return 0;
          if (retryContext.previousRetryCount === 1) return 2000;
          if (retryContext.previousRetryCount === 2) return 10000;
          return 30000;
        },
      })
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    try {
      await this.connection.start();
      console.log('Chat SignalR connected');
    } catch (err) {
      // Log error but don't throw - SignalR is optional for chat functionality
      console.warn('Chat SignalR connection error (non-critical):', err);
      // Don't throw - allow app to continue without SignalR
    }
  }

  /**
   * Stop SignalR connection
   */
  async stop(): Promise<void> {
    if (this.connection) {
      try {
        await this.connection.stop();
      } catch (err) {
        console.error('Error stopping SignalR connection:', err);
      }
      this.connection = null;
    }
  }

  /**
   * Check if connection is active
   */
  isConnected(): boolean {
    return this.connection?.state === signalR.HubConnectionState.Connected;
  }

  /**
   * Get connection state
   */
  getState(): signalR.HubConnectionState | null {
    return this.connection?.state ?? null;
  }

  /**
   * Register handler for receiving messages
   */
  onReceiveMessage(callback: (message: ChatMessage) => void): void {
    this.connection?.on('ReceiveMessage', (message: any) => {
      // Map API message to ChatMessage type
      const chatMessage: ChatMessage = {
        id: message.id,
        conversationId: message.conversationId,
        senderId: message.senderId,
        senderName: message.senderName,
        content: message.content,
        messageType: message.messageType || 'Text',
        createdAt: new Date(message.createdAt),
        isEdited: message.isEdited || false,
        isDeleted: message.isDeleted || false,
      };
      callback(chatMessage);
    });
  }

  /**
   * Register handler for user typing indicator
   */
  onUserTyping(
    callback: (data: { conversationId: string; userId: string; userName: string }) => void
  ): void {
    this.connection?.on('UserTyping', callback);
  }

  /**
   * Register handler for user stopped typing
   */
  onUserStoppedTyping(callback: (data: { conversationId: string; userId: string }) => void): void {
    this.connection?.on('UserStoppedTyping', callback);
  }

  /**
   * Remove event handler
   */
  off(eventName: string): void {
    this.connection?.off(eventName);
  }

  /**
   * Join a conversation group
   */
  async joinConversation(conversationId: string): Promise<void> {
    if (!this.isConnected()) {
      throw new Error('SignalR connection not established');
    }
    try {
      await this.connection?.invoke('JoinConversation', conversationId);
    } catch (err) {
      console.error('Error joining conversation:', err);
      throw err;
    }
  }

  /**
   * Leave a conversation group
   */
  async leaveConversation(conversationId: string): Promise<void> {
    if (!this.isConnected()) {
      return;
    }
    try {
      await this.connection?.invoke('LeaveConversation', conversationId);
    } catch (err) {
      console.error('Error leaving conversation:', err);
    }
  }

  /**
   * Send a message via SignalR
   * Note: This is optional - you can also use REST API
   */
  async sendMessage(conversationId: string, content: string): Promise<void> {
    if (!this.isConnected()) {
      throw new Error('SignalR connection not established');
    }
    try {
      await this.connection?.invoke('SendMessage', conversationId, content);
    } catch (err) {
      console.error('Error sending message via SignalR:', err);
      throw err;
    }
  }

  /**
   * Mark conversation as read
   */
  async markAsRead(conversationId: string): Promise<void> {
    if (!this.isConnected()) {
      return;
    }
    try {
      await this.connection?.invoke('MarkAsRead', conversationId);
    } catch (err) {
      console.error('Error marking as read:', err);
    }
  }

  /**
   * Start typing indicator
   */
  async startTyping(conversationId: string): Promise<void> {
    if (!this.isConnected()) {
      return;
    }
    try {
      await this.connection?.invoke('StartTyping', conversationId);
    } catch (err) {
      console.error('Error starting typing:', err);
    }
  }

  /**
   * Stop typing indicator
   */
  async stopTyping(conversationId: string): Promise<void> {
    if (!this.isConnected()) {
      return;
    }
    try {
      await this.connection?.invoke('StopTyping', conversationId);
    } catch (err) {
      console.error('Error stopping typing:', err);
    }
  }

  /**
   * Register connection state change handler
   */
  onConnectionStateChange(callback: (state: signalR.HubConnectionState) => void): void {
    if (!this.connection) return;

    this.connection.onclose((error) => {
      if (error) {
        console.error('SignalR connection closed with error:', error);
      } else {
        console.log('SignalR connection closed');
      }
      callback(signalR.HubConnectionState.Disconnected);
    });

    this.connection.onreconnecting((error) => {
      console.log('SignalR reconnecting...', error);
      callback(signalR.HubConnectionState.Reconnecting);
    });

    this.connection.onreconnected((connectionId) => {
      console.log('SignalR reconnected:', connectionId);
      callback(signalR.HubConnectionState.Connected);
    });
  }
}

export const chatSignalRService = new ChatSignalRService();

