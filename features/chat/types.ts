/**
 * Types for the booking chat feature (customer <-> driver messaging over Matrix).
 */

export type ChatSenderRole = 'customer' | 'driver' | 'system' | 'unknown';

export type ChatMessageKind = 'text' | 'notice';

export type ChatMessageStatus = 'sending' | 'sent' | 'failed';

export interface ChatMessage {
  /** Matrix event_id once confirmed by the server; equals txnId for an optimistic local message. */
  eventId: string;
  /** Present on locally-sent messages until reconciled with the synced echo. */
  txnId?: string;
  roomId: string;
  senderMxid: string;
  senderRole: ChatSenderRole;
  kind: ChatMessageKind;
  body: string;
  appBeeEvent?: 'driver_assigned' | 'booking_status';
  appBeeStatus?: string;
  appBeeDriverName?: string;
  /** origin_server_ts, ms epoch */
  sentAt: number;
  status: ChatMessageStatus;
}

export type RoomLifecycleState =
  | 'unknown'
  | 'not_provisioned'
  | 'active'
  | 'frozen'
  | 'unavailable';

export interface RoomInfo {
  bookingId: string;
  roomId: string;
  state: RoomLifecycleState;
  customerMxid?: string;
  driverMxid?: string;
}

/** In-memory representation of a Matrix session. accessToken is never persisted to disk. */
export interface MatrixSessionState {
  homeserverUrl: string;
  userId: string;
  accessToken: string;
  deviceId: string;
  issuedAt: number;
}

export type ChatConnectionStatus = 'idle' | 'connecting' | 'live' | 'reconnecting' | 'error';

export interface MatrixErrorBody {
  errcode?: string;
  error?: string;
}

export class MatrixApiError extends Error {
  status?: number;
  errcode?: string;

  constructor(message: string, status?: number, errcode?: string) {
    super(message);
    this.name = 'MatrixApiError';
    this.status = status;
    this.errcode = errcode;
  }
}
