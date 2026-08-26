import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { apiClient } from '@/shared/services/apiClient';
import type { MatrixSessionState } from '../types';

/**
 * SecureStore keys for the Matrix session's durable bits. The access token is
 * intentionally NOT persisted here — the backend mints a fresh one on every
 * `/api/matrix/session` call and never stores it server-side, so the client
 * treats it as memory-only and re-fetches as needed (app start, 401 recovery).
 */
const MATRIX_KEYS = {
  DEVICE_ID: 'matrix_device_id',
  HOMESERVER_URL: 'matrix_homeserver_url',
  USER_ID: 'matrix_user_id',
} as const;

interface MatrixSessionDto {
  homeserverUrl: string;
  userId: string;
  accessToken: string;
  deviceId: string;
}

function currentPlatform(): 'driver-android' | 'driver-ios' | 'web' {
  if (Platform.OS === 'android') return 'driver-android';
  if (Platform.OS === 'ios') return 'driver-ios';
  return 'web';
}

let cachedSession: MatrixSessionState | null = null;
let inflight: Promise<MatrixSessionState> | null = null;

async function requestSession(): Promise<MatrixSessionState> {
  const response = await apiClient.post<MatrixSessionDto>('/api/matrix/session', {
    body: { platform: currentPlatform() },
  });
  // apiClient's own envelope wraps the backend's ApiResponse<T> envelope, so the real
  // payload is nested one level deeper than the `ApiResponse<T>` return type claims.
  let dto = response.data as unknown as MatrixSessionDto;
  if (dto && typeof dto === 'object' && 'data' in dto && (dto as any).data) {
    dto = (dto as any).data;
  }
  const session: MatrixSessionState = {
    homeserverUrl: dto.homeserverUrl,
    userId: dto.userId,
    accessToken: dto.accessToken,
    deviceId: dto.deviceId,
    issuedAt: Date.now(),
  };

  await Promise.all([
    SecureStore.setItemAsync(MATRIX_KEYS.DEVICE_ID, session.deviceId),
    SecureStore.setItemAsync(MATRIX_KEYS.HOMESERVER_URL, session.homeserverUrl),
    SecureStore.setItemAsync(MATRIX_KEYS.USER_ID, session.userId),
  ]);

  return session;
}

/**
 * Get the current Matrix session, minting one via `/api/matrix/session` if none is
 * cached yet (or `forceRefresh` is set, e.g. after a 401 from the homeserver).
 * Concurrent callers coalesce onto a single in-flight request.
 */
export async function getSession(forceRefresh = false): Promise<MatrixSessionState> {
  if (!forceRefresh && cachedSession) {
    return cachedSession;
  }
  if (inflight) {
    return inflight;
  }

  inflight = requestSession()
    .then((session) => {
      cachedSession = session;
      return session;
    })
    .catch((err) => {
      cachedSession = null;
      throw err;
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

/** Clear the cached session and its SecureStore-persisted device info (call on logout). */
export async function clearSession(): Promise<void> {
  cachedSession = null;
  inflight = null;
  await Promise.all([
    SecureStore.deleteItemAsync(MATRIX_KEYS.DEVICE_ID).catch(() => {}),
    SecureStore.deleteItemAsync(MATRIX_KEYS.HOMESERVER_URL).catch(() => {}),
    SecureStore.deleteItemAsync(MATRIX_KEYS.USER_ID).catch(() => {}),
  ]);
}

export const matrixSessionService = {
  getSession,
  clearSession,
};
