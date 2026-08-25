/**
 * Chat feature public API (customer <-> driver messaging over Matrix).
 * Other features should import from this file, not from internal paths.
 */

// Components
export { ChatHeader } from './components/ChatHeader';
export { MessageBubble } from './components/MessageBubble';
export { ChatComposer } from './components/ChatComposer';

// Hooks
export { useBookingChatRoom } from './hooks/useBookingChatRoom';
export { useChatMessages } from './hooks/useChatMessages';

// Services
export { matrixSessionService } from './services/matrixSessionService';
export { matrixClient } from './services/matrixClient';

// Types
export type {
  ChatMessage,
  ChatMessageKind,
  ChatMessageStatus,
  ChatSenderRole,
  ChatConnectionStatus,
  RoomInfo,
  RoomLifecycleState,
  MatrixSessionState,
} from './types';
