import { getSession } from './matrixSessionService';
import {
  ChatConnectionStatus,
  ChatMessage,
  ChatSenderRole,
  MatrixApiError,
  MatrixErrorBody,
  MatrixSessionState,
  RoomInfo,
} from '../types';

/**
 * This app is only ever used by drivers, so the local user's role in any booking
 * room is always "driver" and the counterpart is always "customer". (The backend's
 * own SenderRole concept compares against BookingRoom.CustomerMatrixUserId /
 * DriverMatrixUserId, which client apps don't have access to — this static mapping
 * is equivalent for a single-role app and avoids needing a room-membership scan.)
 */
const SELF_ROLE: ChatSenderRole = 'driver';
const OTHER_ROLE: ChatSenderRole = 'customer';

interface MatrixSyncStateEvent {
  type: string;
  state_key?: string;
  sender: string;
  content: Record<string, unknown>;
}

interface MatrixSyncTimelineEvent {
  type: string;
  event_id: string;
  sender: string;
  origin_server_ts: number;
  content: Record<string, unknown>;
  unsigned?: { transaction_id?: string };
}

interface MatrixJoinedRoom {
  state?: { events: MatrixSyncStateEvent[] };
  timeline?: { events: MatrixSyncTimelineEvent[]; prev_batch?: string };
}

interface MatrixSyncResponse {
  next_batch: string;
  rooms?: {
    join?: Record<string, MatrixJoinedRoom>;
    leave?: Record<string, unknown>;
  };
}

interface MatrixMessagesResponse {
  chunk: MatrixSyncTimelineEvent[];
  end?: string;
}

// ---------------------------------------------------------------------------
// Low-level fetch helper
// ---------------------------------------------------------------------------

async function matrixFetch<T>(
  session: MatrixSessionState,
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const base = session.homeserverUrl.replace(/\/+$/, '');
  const cleanPath = path.replace(/^\/+/, '');
  const url = `${base}/${cleanPath}`;

  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string> | undefined),
    Authorization: `Bearer ${session.accessToken}`,
  };
  if (init.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(url, { ...init, headers });
  const text = await response.text().catch(() => '');
  let data: unknown = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = {};
    }
  }

  if (!response.ok) {
    const body = data as MatrixErrorBody;
    throw new MatrixApiError(
      body.error || `Matrix request failed with HTTP ${response.status}`,
      response.status,
      body.errcode
    );
  }

  return data as T;
}

function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === 'AbortError';
}

function isUnauthorized(err: unknown): boolean {
  return err instanceof MatrixApiError && (err.status === 401 || err.errcode === 'M_UNKNOWN_TOKEN');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Runs `fn` with the current session; on 401/M_UNKNOWN_TOKEN, refreshes once and retries. */
async function withSessionRetry<T>(fn: (session: MatrixSessionState) => Promise<T>): Promise<T> {
  const session = await getSession();
  try {
    return await fn(session);
  } catch (err) {
    if (isUnauthorized(err)) {
      const freshSession = await getSession(true);
      return await fn(freshSession);
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Message normalization
// ---------------------------------------------------------------------------

function toChatMessage(ev: MatrixSyncTimelineEvent, roomId: string, selfUserId: string): ChatMessage {
  const content = ev.content as {
    msgtype?: string;
    body?: string;
    app_bee_event?: string;
    app_bee_status?: string;
    app_bee_driver_name?: string;
  };
  const isNotice = content.msgtype === 'm.notice';

  return {
    eventId: ev.event_id,
    txnId: ev.unsigned?.transaction_id,
    roomId,
    senderMxid: ev.sender,
    senderRole: isNotice ? 'system' : ev.sender === selfUserId ? SELF_ROLE : OTHER_ROLE,
    kind: isNotice ? 'notice' : 'text',
    body: content.body ?? '',
    appBeeEvent: content.app_bee_event as ChatMessage['appBeeEvent'],
    appBeeStatus: content.app_bee_status,
    appBeeDriverName: content.app_bee_driver_name,
    sentAt: ev.origin_server_ts,
    status: 'sent',
  };
}

// ---------------------------------------------------------------------------
// Room discovery cache, kept up to date by the sync loop
// ---------------------------------------------------------------------------

const bookingRoomCache = new Map<string, RoomInfo>();
const roomIdToBookingId = new Map<string, string>();
/** Every room id ever seen in `rooms.join`, so `findRoomForBooking` can fall back to a
 * direct state query for rooms `/sync` hasn't tagged with a bookingId yet. */
const knownJoinedRoomIds = new Set<string>();

/**
 * Optimistically register a (bookingId, roomId) pair known ahead of a sync — used
 * on the notification deep-link fast path, where the push payload already carries
 * the room id. The sync loop will correct `state` (active/frozen) once it catches up.
 */
function seedKnownRoom(bookingId: string, roomId: string): void {
  const key = bookingId.toLowerCase();
  roomIdToBookingId.set(roomId, key);
  if (!bookingRoomCache.has(key)) {
    bookingRoomCache.set(key, { bookingId: key, roomId, state: 'active' });
  }
}

function processSyncResponse(data: MatrixSyncResponse, selfUserId: string): void {
  const joined = data.rooms?.join ?? {};

  for (const [roomId, room] of Object.entries(joined)) {
    knownJoinedRoomIds.add(roomId);
    const stateEvents = room.state?.events ?? [];
    const timelineEvents = room.timeline?.events ?? [];

    let bookingId = roomIdToBookingId.get(roomId);
    for (const ev of stateEvents) {
      if (ev.type === 'app.bee.booking') {
        const content = ev.content as { bookingId?: string };
        if (typeof content.bookingId === 'string') {
          bookingId = content.bookingId.toLowerCase();
        }
      }
    }

    let frozen: boolean | undefined;
    for (const ev of [...stateEvents, ...timelineEvents]) {
      if (ev.type === 'm.room.power_levels') {
        const eventsDefault = Number((ev.content as { events_default?: number }).events_default ?? 0);
        frozen = eventsDefault >= 100;
      }
    }

    if (bookingId) {
      roomIdToBookingId.set(roomId, bookingId);
      const existing = bookingRoomCache.get(bookingId);
      const resolvedState =
        frozen === undefined
          ? existing && (existing.state === 'active' || existing.state === 'frozen')
            ? existing.state
            : 'active'
          : frozen
            ? 'frozen'
            : 'active';
      bookingRoomCache.set(bookingId, { bookingId, roomId, state: resolvedState });
    }

    const listeners = roomMessageListeners.get(roomId);
    if (listeners && listeners.size > 0) {
      for (const ev of timelineEvents) {
        if (ev.type === 'm.room.message') {
          const message = toChatMessage(ev, roomId, selfUserId);
          listeners.forEach((fn) => fn(message));
        }
      }
    }
  }

  const left = data.rooms?.leave ?? {};
  for (const roomId of Object.keys(left)) {
    const bookingId = roomIdToBookingId.get(roomId);
    if (bookingId) {
      const existing = bookingRoomCache.get(bookingId);
      if (existing) {
        bookingRoomCache.set(bookingId, { ...existing, state: 'unavailable' });
      }
    }
  }
}

/**
 * Resolve the room for a booking. If a full first sync has completed and the
 * booking still isn't known, this reports `not_provisioned` rather than an
 * error — callers (useBookingChatRoom) are expected to retry with backoff, since
 * the sync loop keeps running and will pick the room up once it appears.
 */
async function findRoomForBooking(bookingId: string): Promise<RoomInfo> {
  const key = bookingId.toLowerCase();
  const cached = bookingRoomCache.get(key);
  if (cached) return cached;

  await waitForFirstSync();

  const afterWait = bookingRoomCache.get(key);
  if (afterWait) return afterWait;

  // `/sync`'s per-room `state` array can omit the booking-id tag for a room the client
  // only recently joined, even with `full_state=true` — observed in practice, not just
  // in theory. Fall back to querying each known-joined, not-yet-tagged room's state
  // directly; that endpoint returns the room's authoritative current state rather than
  // anything computed relative to a sync position.
  for (const roomId of knownJoinedRoomIds) {
    if (roomIdToBookingId.has(roomId)) continue;
    const resolvedBookingId = await resolveBookingIdForRoom(roomId);
    if (resolvedBookingId) {
      roomIdToBookingId.set(roomId, resolvedBookingId);
      if (!bookingRoomCache.has(resolvedBookingId)) {
        bookingRoomCache.set(resolvedBookingId, { bookingId: resolvedBookingId, roomId, state: 'active' });
      }
    }
  }

  const afterFallback = bookingRoomCache.get(key);
  if (afterFallback) return afterFallback;

  return { bookingId: key, roomId: '', state: 'not_provisioned' };
}

/** Direct state query for one room's booking-id tag, bypassing /sync entirely. */
async function resolveBookingIdForRoom(roomId: string): Promise<string | undefined> {
  try {
    const session = await getSession();
    const content = await matrixFetch<{ bookingId?: string }>(
      session,
      `_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/state/app.bee.booking`,
      { method: 'GET' }
    );
    return typeof content.bookingId === 'string' ? content.bookingId.toLowerCase() : undefined;
  } catch {
    // No such state event on this room, or a transient error — not fatal, just unresolved.
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Sync loop (shared singleton, refcounted start/stop)
// ---------------------------------------------------------------------------

let since: string | undefined;
let subscriberCount = 0;
let loopPromise: Promise<void> | null = null;
let abortController: AbortController | null = null;
let firstSyncCompleted = false;
let firstSyncWaiters: Array<() => void> = [];

let connectionStatus: ChatConnectionStatus = 'idle';
const statusListeners = new Set<(status: ChatConnectionStatus) => void>();
const roomMessageListeners = new Map<string, Set<(message: ChatMessage) => void>>();

function setStatus(next: ChatConnectionStatus): void {
  connectionStatus = next;
  statusListeners.forEach((fn) => fn(next));
}

function waitForFirstSync(timeoutMs = 15000): Promise<boolean> {
  if (firstSyncCompleted) return Promise.resolve(true);
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(firstSyncCompleted), timeoutMs);
    firstSyncWaiters.push(() => {
      clearTimeout(timer);
      resolve(true);
    });
  });
}

const BACKOFF_MS = [0, 2000, 10000, 30000];

async function runSyncLoop(): Promise<void> {
  setStatus('connecting');
  let backoffIndex = 0;
  // `since` is a module-level cursor that survives across start/stop cycles of this loop
  // (e.g. re-opening the chat screen), but a room can still be new to the client relative
  // to a stale `since` — Synapse then reports only the state that changed since that token,
  // which can omit custom state (like our booking-id tag) set at room creation. Forcing
  // `full_state=true` on this loop's first request guarantees a complete state snapshot for
  // every joined room, regardless of how old `since` is.
  let isFirstSyncThisLoop = true;

  while (subscriberCount > 0) {
    try {
      const session = await getSession();
      abortController = new AbortController();

      const params = new URLSearchParams({ timeout: '30000' });
      if (since) params.set('since', since);
      if (isFirstSyncThisLoop) params.set('full_state', 'true');

      const data = await matrixFetch<MatrixSyncResponse>(
        session,
        `_matrix/client/v3/sync?${params.toString()}`,
        { method: 'GET', signal: abortController.signal }
      );

      isFirstSyncThisLoop = false;
      since = data.next_batch;
      processSyncResponse(data, session.userId);

      if (!firstSyncCompleted) {
        firstSyncCompleted = true;
        const waiters = firstSyncWaiters;
        firstSyncWaiters = [];
        waiters.forEach((fn) => fn());
      }

      setStatus('live');
      backoffIndex = 0;
    } catch (err) {
      if (isAbortError(err)) {
        continue;
      }
      if (isUnauthorized(err)) {
        try {
          await getSession(true);
        } catch {
          // fall through to backoff below
        }
        continue;
      }
      setStatus('reconnecting');
      const delay = BACKOFF_MS[Math.min(backoffIndex, BACKOFF_MS.length - 1)];
      backoffIndex++;
      await sleep(delay);
    }
  }

  setStatus('idle');
}

function startSyncLoop(): void {
  subscriberCount++;
  if (!loopPromise) {
    loopPromise = runSyncLoop().finally(() => {
      loopPromise = null;
    });
  }
}

function stopSyncLoop(): void {
  subscriberCount = Math.max(0, subscriberCount - 1);
  if (subscriberCount === 0) {
    abortController?.abort();
  }
}

function subscribeToConnectionStatus(listener: (status: ChatConnectionStatus) => void): () => void {
  statusListeners.add(listener);
  listener(connectionStatus);
  return () => {
    statusListeners.delete(listener);
  };
}

function subscribeToRoomMessages(roomId: string, listener: (message: ChatMessage) => void): () => void {
  let set = roomMessageListeners.get(roomId);
  if (!set) {
    set = new Set();
    roomMessageListeners.set(roomId, set);
  }
  set.add(listener);
  return () => {
    set?.delete(listener);
    if (set && set.size === 0) {
      roomMessageListeners.delete(roomId);
    }
  };
}

// ---------------------------------------------------------------------------
// Send / history / receipts
// ---------------------------------------------------------------------------

let txnCounter = 0;

function generateTxnId(): string {
  txnCounter += 1;
  return `bee-${Date.now()}-${txnCounter}-${Math.random().toString(36).slice(2, 8)}`;
}

async function sendMessageWithTxnId(roomId: string, body: string, txnId: string): Promise<void> {
  await withSessionRetry((session) =>
    matrixFetch(
      session,
      `_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/send/m.room.message/${encodeURIComponent(txnId)}`,
      { method: 'PUT', body: JSON.stringify({ msgtype: 'm.text', body }) }
    )
  );
}

async function sendMessage(roomId: string, body: string, txnId?: string): Promise<{ txnId: string }> {
  const id = txnId ?? generateTxnId();
  await sendMessageWithTxnId(roomId, body, id);
  return { txnId: id };
}

async function retrySend(roomId: string, body: string, txnId: string): Promise<void> {
  return sendMessageWithTxnId(roomId, body, txnId);
}

interface FetchHistoryResult {
  messages: ChatMessage[];
  nextToken?: string;
}

async function fetchHistory(
  roomId: string,
  opts: { fromToken?: string; limit?: number } = {}
): Promise<FetchHistoryResult> {
  const limit = opts.limit ?? 50;
  return withSessionRetry(async (session) => {
    const params = new URLSearchParams({ dir: 'b', limit: String(limit) });
    if (opts.fromToken) params.set('from', opts.fromToken);

    const data = await matrixFetch<MatrixMessagesResponse>(
      session,
      `_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/messages?${params.toString()}`,
      { method: 'GET' }
    );

    // dir=b returns newest-first; reverse to chronological order for rendering.
    const messages = (data.chunk ?? [])
      .filter((ev) => ev.type === 'm.room.message')
      .map((ev) => toChatMessage(ev, roomId, session.userId))
      .reverse();

    return { messages, nextToken: data.end };
  });
}

async function sendReadReceipt(roomId: string, eventId: string): Promise<void> {
  await withSessionRetry((session) =>
    matrixFetch(
      session,
      `_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/receipt/m.read/${encodeURIComponent(eventId)}`,
      { method: 'POST', body: JSON.stringify({}) }
    )
  );
}

export const matrixClient = {
  startSyncLoop,
  stopSyncLoop,
  subscribeToConnectionStatus,
  subscribeToRoomMessages,
  findRoomForBooking,
  seedKnownRoom,
  generateTxnId,
  sendMessage,
  retrySend,
  fetchHistory,
  sendReadReceipt,
};
