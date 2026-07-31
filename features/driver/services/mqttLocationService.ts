import mqtt, { MqttClient } from 'mqtt';
import * as SecureStore from 'expo-secure-store';
import { apiClient } from '@/shared/services/apiClient';

// The issued token is persisted so a cold start doesn't need the API to be reachable before
// location can flow — the previous token stays usable until it expires. It is a credential,
// so it goes in SecureStore, never AsyncStorage.
const CREDENTIALS_STORAGE_KEY = 'mqtt_credentials';

// The backend is the single source of truth for the MQTT connection: host, port, protocol,
// credentials and topic all come from GET /api/mqtt/credentials. Nothing here is resolved
// from Vault/env any more, so the driver app and the backend can never disagree about the
// broker, and the driver can only publish to the topic its own token authorizes.

// Re-fetch the token once this fraction of its lifetime has elapsed, so a publish never
// races the broker's expiry check. EMQX with disconnect_after_expire drops the connection
// the moment the token lapses.
const TOKEN_REFRESH_AT = 0.75;
// ...but never sit closer than this to the expiry, however short the TTL.
const TOKEN_MIN_REMAINING_MS = 5 * 60 * 1000;

/** Envelope returned by GET /api/mqtt/credentials. */
interface MqttCredentialsEnvelope {
  success: boolean;
  data: {
    host: string;
    port: number;
    protocol: string;
    wsUrl: string;
    username: string;
    password: string;
    topic: string;
    environment: string;
    clientId: string;
    expiresAt: string;
    expiresInSeconds: number;
  };
}

// Polyfills for React Native / Hermes environment where these might be missing
if (typeof setImmediate === 'undefined') {
  // @ts-ignore
  global.setImmediate = (callback, ...args) => setTimeout(callback, 0, ...args);
}
if (typeof process.nextTick === 'undefined') {
  // @ts-ignore
  process.nextTick = (callback, ...args) => setTimeout(callback, 0, ...args);
}

/**
 * MQTT connection credentials. Either per-driver (a JWT minted by the backend) or the
 * legacy shared credential resolved from Vault/env.
 */
export interface MqttCredentials {
  host: string;
  port: number;
  protocol: 'ws' | 'wss';
  wsUrl: string;
  username: string;
  password: string;
  /**
   * The driver's COMPLETE location topic, to be used verbatim — the broker's ACL is scoped
   * to exactly this string, and it is derived from the token's driver id, so the client
   * never asserts which driver it is publishing as.
   */
  topic: string;
  clientId: string;
  /** Epoch ms at which `password` (a JWT) stops being accepted. */
  expiresAt: number | null;
}

/**
 * MQTT Location Service
 * Handles direct MQTT connection for location updates
 * OTA-compatible (pure JavaScript, no native code)
 */
interface MqttDebugInfo {
  connectionState: 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error';
  lastEvent: string;
  lastEventTime: number;
  connectionAttempts: number;
  lastError: string | null;
  wsUrl: string | null;
  events: Array<{ time: number; event: string; details?: string }>;
}

class MqttLocationService {
  private client: MqttClient | null = null;
  private credentials: MqttCredentials | null = null;
  /** Full lifetime of the cached token, used to compute the refresh point. */
  private credentialLifetimeMs: number | null = null;
  /** Fires before the token expires so refresh doesn't depend on publish cadence. */
  private tokenRefreshTimer: NodeJS.Timeout | null = null;
  private publishedCount: number = 0;
  private publishFailedCount: number = 0;
  private isConnecting: boolean = false;
  private reconnectAttempts: number = 0;
  private readonly maxReconnectAttempts: number = 999999; // Effectively infinite for OTA survival
  private reconnectTimer: NodeJS.Timeout | null = null;
  private lastError: string | null = null;
  private debugInfo: MqttDebugInfo = {
    connectionState: 'idle',
    lastEvent: 'Initialized',
    lastEventTime: Date.now(),
    connectionAttempts: 0,
    lastError: null,
    wsUrl: null,
    events: [],
  };

  private readonly MAX_DEBUG_EVENTS = 20;

  /**
   * GET /api/mqtt/credentials — the single source of the MQTT connection: a short-lived JWT
   * (used as the MQTT password), the broker URL, and the one topic this driver is permitted
   * to publish to. The backend derives the URL from its own broker config, so driver and
   * backend can't drift apart.
   *
   * There is deliberately no fallback to a shared credential: it could not be authorized
   * per-driver, and silently degrading to it would hide a broken JWT path. If this throws,
   * MQTT is unavailable and locationTrackingService falls back to the HTTP batch endpoint.
   */
  async fetchCredentials(): Promise<MqttCredentials> {
    console.log('[MQTT] 🔑 Requesting per-driver token from GET /api/mqtt/credentials...');
    this.addDebugEvent('Requesting token from backend');

    let payload: MqttCredentialsEnvelope['data'] | undefined;
    try {
      const response = await apiClient.get<MqttCredentialsEnvelope>('/api/mqtt/credentials');
      payload = response.data?.data;
    } catch (error) {
      const status = (error as { status?: number })?.status;
      const message = error instanceof Error ? error.message : String(error);
      // 401/403 here almost always means the driver's local user hasn't synced yet or the
      // role claim isn't Driver/Owner — not a broker problem. Say so, or this looks like MQTT.
      const hint = status === 401 || status === 403
        ? ' (token rejected by the API — check the driver role claim and that /api/auth/me resolves)'
        : '';
      console.error(`[MQTT] ❌ Token request failed${status ? ` [HTTP ${status}]` : ''}: ${message}${hint}`);
      this.addDebugEvent('Token request FAILED', message);
      throw error;
    }

    if (!payload?.wsUrl || !payload?.password || !payload?.topic) {
      console.error('[MQTT] ❌ Token response was malformed:', JSON.stringify(payload ?? null));
      this.addDebugEvent('Token response malformed');
      throw new Error('Credentials response was missing wsUrl, password or topic');
    }

    // Trust the server's protocol; it built wsUrl from the config the backend itself uses.
    const protocol: 'ws' | 'wss' = payload.wsUrl.startsWith('wss://') ? 'wss' : 'ws';

    // Prefer the absolute expiresAt over expiresInSeconds: device clocks drift, but a
    // relative TTL measured from our own "now" stays correct even on a skewed clock.
    const parsedExpiry = Date.parse(payload.expiresAt);
    const expiresAt = Number.isFinite(payload.expiresInSeconds)
      ? Date.now() + payload.expiresInSeconds * 1000
      : Number.isNaN(parsedExpiry) ? null : parsedExpiry;

    const credentials: MqttCredentials = {
      host: payload.host,
      port: payload.port,
      protocol,
      wsUrl: payload.wsUrl,
      username: payload.username,
      password: payload.password,
      topic: payload.topic,
      clientId: payload.clientId,
      expiresAt,
    };

    this.credentials = credentials;
    this.credentialLifetimeMs = expiresAt ? expiresAt - Date.now() : null;
    await this.persistCredentials(credentials);

    console.log('[MQTT] ✅ Token issued:', {
      wsUrl: credentials.wsUrl,
      username: credentials.username,
      topic: credentials.topic,
      environment: payload.environment,
      expiresIn: expiresAt ? `${Math.round((expiresAt - Date.now()) / 60000)}m` : '(no expiry)',
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : '(none)',
    });
    this.addDebugEvent('Token issued', credentials.topic);

    this.scheduleTokenRefresh();

    return credentials;
  }


  /**
   * Get credentials from cache, re-fetching when the token is at or near expiry.
   *
   * The cache used to be permanent, which is safe for a static password but fatal for a JWT:
   * the broker disconnects on expiry and every retry would re-present the same dead token.
   */
  private async getValidCredentials(): Promise<MqttCredentials> {
    if (this.credentials && !this.isCredentialStale(this.credentials)) {
      return this.credentials;
    }

    if (this.credentials) {
      console.log('[MQTT] Credentials are at/near expiry — requesting a fresh token');
      this.credentials = null;
      this.credentialLifetimeMs = null;
    } else {
      // Cold start: a persisted token means we can connect without waiting on the API.
      const stored = await this.loadPersistedCredentials();
      if (stored) {
        this.credentials = stored;
        this.credentialLifetimeMs = stored.expiresAt ? stored.expiresAt - Date.now() : null;
        this.scheduleTokenRefresh();
        return stored;
      }
    }

    return await this.fetchCredentials();
  }

  /** Persist the issued token so it survives an app restart. Never throws. */
  private async persistCredentials(credentials: MqttCredentials): Promise<void> {
    try {
      await SecureStore.setItemAsync(CREDENTIALS_STORAGE_KEY, JSON.stringify(credentials));
    } catch (error) {
      // Non-fatal: we just lose the cold-start shortcut.
      console.warn('[MQTT] Could not persist credentials to SecureStore:', error);
    }
  }

  /**
   * Load a previously issued token, if one is stored and still has useful life left.
   * Returns null when absent, unreadable, or too close to expiry to be worth using.
   */
  private async loadPersistedCredentials(): Promise<MqttCredentials | null> {
    try {
      const raw = await SecureStore.getItemAsync(CREDENTIALS_STORAGE_KEY);
      if (!raw) return null;

      const stored = JSON.parse(raw) as MqttCredentials;
      if (!stored?.wsUrl || !stored?.password || !stored?.topic) return null;

      const remaining = stored.expiresAt ? stored.expiresAt - Date.now() : 0;
      if (remaining <= TOKEN_MIN_REMAINING_MS) {
        console.log('[MQTT] 🗄️ Stored token is expired or too close to expiry — ignoring it');
        await this.clearPersistedCredentials();
        return null;
      }

      console.log(`[MQTT] 🗄️ Reusing stored token (${Math.round(remaining / 60000)}m left) — no API call needed`);
      return stored;
    } catch (error) {
      console.warn('[MQTT] Could not read stored credentials:', error);
      return null;
    }
  }

  private async clearPersistedCredentials(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(CREDENTIALS_STORAGE_KEY);
    } catch {
      // Nothing useful to do if the delete fails.
    }
  }

  /**
   * Arm a timer to renew the token before the broker stops accepting it.
   *
   * Publish-time staleness checks alone aren't enough: if the driver stops moving, or
   * tracking pauses while the socket stays open, nothing would trigger a refresh and EMQX
   * (with disconnect_after_expire) would drop the connection at expiry.
   */
  private scheduleTokenRefresh(): void {
    this.clearTokenRefreshTimer();

    const expiresAt = this.credentials?.expiresAt;
    if (!expiresAt) return;

    const lifetime = this.credentialLifetimeMs ?? 0;
    const remaining = expiresAt - Date.now();
    // Whichever comes first: the fraction-of-lifetime point, or the safety floor.
    const byFraction = lifetime > 0 ? lifetime * TOKEN_REFRESH_AT : remaining;
    const byFloor = remaining - TOKEN_MIN_REMAINING_MS;
    const delay = Math.max(30_000, Math.min(byFraction, byFloor));

    console.log(`[MQTT] ⏰ Token refresh scheduled in ${Math.round(delay / 60000)}m (expires in ${Math.round(remaining / 60000)}m)`);

    this.tokenRefreshTimer = setTimeout(async () => {
      console.log('[MQTT] ♻️ Token nearing expiry — renewing');
      this.addDebugEvent('Scheduled token refresh');
      try {
        const wasConnected = this.client?.connected ?? false;
        this.credentials = null;
        this.credentialLifetimeMs = null;
        await this.fetchCredentials();

        if (wasConnected) {
          console.log('[MQTT] ♻️ Reconnecting with the renewed token');
          await this.reconnectWithFreshCredentials();
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[MQTT] ❌ Scheduled token refresh failed: ${message}`);
        this.addDebugEvent('Scheduled refresh FAILED', message);
        // Retry sooner than the (now unknown) expiry so we don't sit dark until the
        // broker disconnects us.
        this.tokenRefreshTimer = setTimeout(() => this.scheduleTokenRefreshRetry(), 60_000) as any;
      }
    }, delay) as any;
  }

  /** Retry a failed scheduled refresh; keeps trying while the app is alive. */
  private async scheduleTokenRefreshRetry(): Promise<void> {
    try {
      await this.fetchCredentials();
      if (this.client?.connected) {
        await this.reconnectWithFreshCredentials();
      }
    } catch {
      this.tokenRefreshTimer = setTimeout(() => this.scheduleTokenRefreshRetry(), 60_000) as any;
    }
  }

  private clearTokenRefreshTimer(): void {
    if (this.tokenRefreshTimer) {
      clearTimeout(this.tokenRefreshTimer);
      this.tokenRefreshTimer = null;
    }
  }

  /** True once the token is past its refresh point (or already expired). */
  private isCredentialStale(credentials: MqttCredentials): boolean {
    if (credentials.expiresAt === null) {
      return false; // legacy static credential
    }

    const remaining = credentials.expiresAt - Date.now();
    if (remaining <= 0) return true;

    // Refresh at TOKEN_REFRESH_AT of the lifetime, but always leave a floor of
    // TOKEN_MIN_REMAINING_MS so a short TTL doesn't get refreshed too late.
    if (remaining <= TOKEN_MIN_REMAINING_MS) return true;

    const issuedFor = this.credentialLifetimeMs ?? 0;
    return issuedFor > 0 && remaining <= issuedFor * (1 - TOKEN_REFRESH_AT);
  }

  /**
   * Drop the cached credential so the next connect re-fetches. Called when the broker
   * rejects us — an expired token is indistinguishable from a bad one at the client.
   */
  private invalidateCredentials(reason: string): void {
    if (!this.credentials) return;
    console.warn(`[MQTT] Discarding cached credentials (${reason})`);
    this.credentials = null;
    this.credentialLifetimeMs = null;
    // Also drop the stored copy — a token the broker just refused must not be reused
    // after the next restart.
    void this.clearPersistedCredentials();
  }

  /**
   * Tear down the live connection and reconnect. connect() short-circuits when already
   * connected, so the client has to be ended first for new credentials to be presented.
   */
  private async reconnectWithFreshCredentials(): Promise<void> {
    if (this.client) {
      try {
        this.client.end(true);
      } catch (error) {
        console.warn('[MQTT] Error ending client before reconnect:', error);
      }
      this.client = null;
    }
    await this.connect();
  }

  /** True when a broker error means "your credentials are not acceptable". */
  private isAuthError(message: string): boolean {
    const m = message.toLowerCase();
    return m.includes('not authorized')
      || m.includes('not authorised')
      || m.includes('unauthorized')
      || m.includes('bad user name or password')
      || m.includes('bad username or password')
      || m.includes('connack')  // MQTT 3.1.1 return codes 4/5 surface via CONNACK
      || m.includes('banned');
  }

  /**
   * Connect to MQTT broker
   */
  async connect(): Promise<void> {
    this.addDebugEvent('connect() called');

    if (this.client?.connected) {
      this.addDebugEvent('Already connected, skipping');
      return; // Already connected
    }

    if (this.isConnecting) {
      this.addDebugEvent('Connection already in progress, skipping');
      return; // Connection in progress
    }

    try {
      this.isConnecting = true;
      this.debugInfo.connectionAttempts++;
      this.addDebugEvent('Starting connection process...');

      // Get valid credentials
      this.addDebugEvent('Fetching credentials...');
      const credentials = await this.getValidCredentials();
      this.addDebugEvent('Credentials fetched successfully');

      // Validate credentials before attempting connection
      this.addDebugEvent('Validating credentials...');
      if (!credentials) {
        throw new Error('MQTT credentials are null or undefined');
      }

      this.debugInfo.wsUrl = credentials.wsUrl;
      this.addDebugEvent(`Connecting to: ${credentials.wsUrl}`);

      // Disconnect existing client if any
      if (this.client) {
        this.addDebugEvent('Disconnecting existing client...');
        this.client.end();
        this.client = null;
      }

      // Connect to MQTT broker
      this.addDebugEvent('Creating MQTT client options...');

      const options: mqtt.IClientOptions = {
        clientId: credentials.clientId,
        username: credentials.username,
        password: credentials.password,
        clean: true,
        reconnectPeriod: 0, // Disable auto-reconnect during initial connection
        connectTimeout: 30000, // 30s for slow/mobile networks and WSS handshake
        keepalive: 45,
        protocolVersion: 4, // MQTT 3.1.1
        // WebSocket-specific options for React Native
        // Important for self-signed certs or lax security environments
        rejectUnauthorized: false,
        wsOptions: {
          headers: {},
        },
        resubscribe: false,
      };

      this.addDebugEvent(`Options: timeout=${options.connectTimeout}ms, clientId=${credentials.clientId}`);

      // Wait for connection - set up promise FIRST before creating client
      this.addDebugEvent('Setting up connection promise...');
      const connectionPromise = new Promise<void>((resolve, reject) => {
        const startTime = Date.now();
        let timeout: any = null;
        let resolved = false;

        const cleanup = () => {
          if (timeout) {
            clearTimeout(timeout);
            timeout = null;
          }
        };

        const onConnect = () => {
          if (resolved) return;
          resolved = true;
          cleanup();
          const elapsed = Date.now() - startTime;
          this.reconnectAttempts = 0;
          this.lastError = null;
          this.addDebugEvent(`✓ CONNECTED after ${elapsed}ms`);
          console.log(`[MQTT] ✅ CONNECTED to ${credentials.wsUrl} in ${elapsed}ms as ${credentials.username}`);
          console.log(`[MQTT] 📍 Ready to publish locations to ${credentials.topic}`);
          resolve();
        };

        const onError = (error: any) => {
          if (resolved) return;
          resolved = true;
          cleanup();
          const elapsed = Date.now() - startTime;
          const errorMessage = error?.message || String(error) || 'Unknown error';
          this.lastError = errorMessage;
          this.addDebugEvent(`ERROR after ${elapsed}ms: ${errorMessage}`);
          // Rejected credentials: drop the cache so the retry mints a new token instead of
          // re-presenting the same rejected one forever.
          if (this.isAuthError(errorMessage)) {
            console.error(
              `[MQTT] ❌ BROKER REJECTED the token after ${elapsed}ms: ${errorMessage}\n` +
              '        → the JWT was refused. Check the EMQX JWT authenticator (secret, iss=BeeLogisticsApi, ' +
              'aud=BeeLogisticsMqtt) and that the token has not expired.'
            );
            this.invalidateCredentials(`broker rejected credentials: ${errorMessage}`);
          } else {
            console.error(
              `[MQTT] ❌ CONNECT FAILED after ${elapsed}ms to ${credentials.wsUrl}: ${errorMessage}\n` +
              '        → transport-level failure. Check the host/port are reachable and that ' +
              'ws/wss matches the broker listener.'
            );
          }
          reject(error);
        };

        // Set timeout (match connectTimeout so we don't fire before the client gives up)
        const timeoutMs = 30000;
        timeout = setTimeout(() => {
          if (resolved) return;
          resolved = true;
          const elapsed = Date.now() - startTime;
          this.addDebugEvent(`TIMEOUT after ${elapsed}ms`);
          this.lastError = `Connection timeout after ${elapsed}ms`;
          reject(new Error('MQTT connection timeout'));
        }, timeoutMs);

        // Create client and attach handlers IMMEDIATELY
        this.addDebugEvent('Creating MQTT client...');
        try {
          // @ts-ignore - mqtt connect types can be finicky
          this.client = mqtt.connect(credentials.wsUrl, options);
          this.addDebugEvent('MQTT client created successfully');

          this.client.on('connect', onConnect);
          this.client.on('error', onError);

          this.client.on('offline', () => {
            this.addDebugEvent('Client offline');
          });

          // Check if already connected (might happen synchronously)
          if (this.client.connected) {
            this.addDebugEvent('Client already connected synchronously');
            onConnect();
          }
        } catch (connectError) {
          this.addDebugEvent(`ERROR creating client: ${connectError}`);
          onError(connectError);
        }
      });

      // Setup general event handlers
      this.setupEventHandlers();

      // Wait for connection
      await connectionPromise;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error) || 'Unknown error';
      this.lastError = errorMessage;
      this.addDebugEvent(`Connection FAILED: ${errorMessage}`);
      throw error;
    } finally {
      this.isConnecting = false;
      this.addDebugEvent('Connection attempt finished');
    }
  }

  /**
   * Setup MQTT event handlers
   */
  private setupEventHandlers(): void {
    if (!this.client) {
      return;
    }

    this.client.on('connect', () => {
      this.addDebugEvent('Event: connect');
      this.reconnectAttempts = 0;
      this.lastError = null;
    });

    this.client.on('error', (error) => {
      const errorMessage = error?.message || String(error) || 'Unknown error';
      this.lastError = errorMessage;
      this.addDebugEvent(`Event: error - ${errorMessage}`);
      if (this.isAuthError(errorMessage)) {
        this.invalidateCredentials(`broker rejected credentials: ${errorMessage}`);
      }
    });

    this.client.on('close', () => {
      this.addDebugEvent('Event: close');
      this.lastError = 'Connection closed';
      this.handleReconnect();
    });

    this.client.on('reconnect', () => {
      this.addDebugEvent('Event: reconnect');
      this.reconnectAttempts++;
    });
  }

  /**
   * Handle reconnection
   */
  private async handleReconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('MQTT Max reconnection attempts reached. Giving up permanently.');
      return;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    // Exponential backoff, max 30 seconds
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    console.log(`[MQTT] Scheduling reconnect attempt ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts} in ${delay}ms...`);
    this.reconnectTimer = setTimeout(async () => {
      try {
        await this.connect();
      } catch (error) {
        console.error('Reconnection failed:', error);
        this.handleReconnect();
      }
    }, delay) as any;
  }

  /**
   * Publish location update to MQTT
   * @param driverId - Driver ID, included in the payload for traceability only. Routing and
   *                   authorization come from the server-issued topic, not from this value.
   * @param latitude - Latitude coordinate
   * @param longitude - Longitude coordinate
   * @param speed - Speed in km/h (optional)
   * @param heading - Heading in degrees (optional)
   * @param deviceId - Device ID (optional)
   */
  async publishLocation(
    driverId: string,
    latitude: number,
    longitude: number,
    speed?: number,
    heading?: number,
    deviceId?: string
  ): Promise<void> {
    try {
      // Resolve credentials BEFORE checking the connection. A token that has aged past its
      // refresh point needs a new connection to present it — riding the existing one until
      // the broker drops it at expiry would lose location updates in the gap.
      const wasStale = this.credentials !== null && this.isCredentialStale(this.credentials);
      const credentials = await this.getValidCredentials();

      if (wasStale && this.client?.connected) {
        console.log('[MQTT] Token refreshed — reconnecting to present the new one');
        await this.reconnectWithFreshCredentials();
      }

      // Ensure connected
      if (!this.client?.connected) {
        await this.connect();
      }

      // The backend issued this topic from the token's driver id, and the broker's ACL is
      // scoped to exactly this string — so use it verbatim. The client no longer decides
      // which driver it publishes as.
      const topic = credentials.topic;

      // Prepare payload
      const payload = JSON.stringify({
        driverId: driverId,
        latitude: latitude,
        longitude: longitude,
        speed: speed != null ? speed : undefined,
        heading: heading != null ? heading : undefined,
        timestamp: new Date().toISOString(),
        deviceId: deviceId || undefined,
      });

      // Publish to MQTT
      return new Promise((resolve, reject) => {
        if (!this.client?.connected) {
          this.publishFailedCount++;
          console.error('[MQTT] ❌ Cannot publish — client not connected (falling back to HTTP)');
          reject(new Error('MQTT client not connected'));
          return;
        }

        this.client.publish(topic, payload, { qos: 0 }, (error) => {
          if (error) {
            this.publishFailedCount++;
            console.error(`[MQTT] ❌ Publish FAILED to ${topic}: ${error.message} ` +
              `(ok=${this.publishedCount} failed=${this.publishFailedCount})`);
            reject(error);
          } else {
            this.publishedCount++;
            console.log(
              `[MQTT] 📤 Location SENT #${this.publishedCount} → ${topic} ` +
              `(${latitude.toFixed(5)}, ${longitude.toFixed(5)})` +
              (this.publishFailedCount > 0 ? ` [failed so far: ${this.publishFailedCount}]` : '')
            );
            resolve();
          }
        });
      });
    } catch (error) {
      this.publishFailedCount++;
      console.error('[MQTT] ❌ Error publishing location:', error);
      throw error;
    }
  }

  /**
   * Disconnect from MQTT broker
   */
  async disconnect(): Promise<void> {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.clearTokenRefreshTimer();

    if (this.client) {
      this.client.end();
      this.client = null;
    }

    // Only the in-memory copy is dropped: the stored token stays valid and lets the next
    // connect start without an API round-trip. Use signOut() to erase it.
    this.credentials = null;
    this.credentialLifetimeMs = null;
    this.reconnectAttempts = 0;
    console.log('[MQTT] Disconnected');
  }

  /**
   * Erase the stored token. Call on logout — the token authorizes publishing as this
   * specific driver, so it must not outlive the session on a shared device.
   */
  async signOut(): Promise<void> {
    await this.disconnect();
    await this.clearPersistedCredentials();
    this.publishedCount = 0;
    this.publishFailedCount = 0;
    console.log('[MQTT] Signed out — stored token erased');
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.client?.connected ?? false;
  }

  /**
   * Get last connection error
   */
  getLastError(): string | null {
    return this.lastError;
  }

  /**
   * One-line answer to "can we connect, and are locations getting through?".
   * Call after login or when diagnosing a driver who isn't showing on the map.
   */
  logStatus(context: string = 'status'): void {
    const expiresIn = this.credentials?.expiresAt
      ? `${Math.round((this.credentials.expiresAt - Date.now()) / 60000)}m`
      : 'n/a';

    console.log(`[MQTT] === ${context} ===`, {
      connected: this.isConnected(),
      canPublish: this.isConnected() && !!this.credentials,
      hasToken: !!this.credentials,
      tokenExpiresIn: expiresIn,
      wsUrl: this.credentials?.wsUrl ?? '(none)',
      topic: this.credentials?.topic ?? '(none)',
      published: this.publishedCount,
      publishFailed: this.publishFailedCount,
      lastError: this.lastError ?? '(none)',
    });
  }

  /**
   * Fetch (or reuse) the MQTT token up front, so the first location publish isn't waiting on
   * an API round-trip and any credential problem shows up in the log at login rather than
   * silently at the first GPS fix. Never throws — MQTT is optional, the HTTP batch endpoint
   * is the fallback.
   */
  async prepareForDriver(): Promise<boolean> {
    try {
      console.log('[MQTT] 🚀 Preparing MQTT for driver session...');
      await this.getValidCredentials();
      this.logStatus('after login');
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(
        `[MQTT] ⚠️ Could not prepare MQTT credentials: ${message}\n` +
        '        → location updates will go over the HTTP batch endpoint instead.'
      );
      return false;
    }
  }

  /**
   * Add debug event
   */
  private addDebugEvent(event: string, details?: string): void {
    this.debugInfo.events.unshift({
      time: Date.now(),
      event,
      details,
    });
    if (this.debugInfo.events.length > this.MAX_DEBUG_EVENTS) {
      this.debugInfo.events = this.debugInfo.events.slice(0, this.MAX_DEBUG_EVENTS);
    }
    this.debugInfo.lastEvent = event;
    this.debugInfo.lastEventTime = Date.now();
  }

  /**
   * Get debug information
   */
  getDebugInfo(): MqttDebugInfo {
    return {
      ...this.debugInfo,
      connectionState: this.getConnectionState(),
      lastError: this.lastError,
    };
  }

  /**
   * Get current connection state
   */
  private getConnectionState(): MqttDebugInfo['connectionState'] {
    if (this.client?.connected) {
      return 'connected';
    }
    if (this.isConnecting) {
      return 'connecting';
    }
    if (this.lastError) {
      return 'error';
    }
    if (this.client) {
      return 'disconnected';
    }
    return 'idle';
  }

  /**
   * Mint a fresh token from the backend, discarding the cached one.
   */
  async refreshCredentials(): Promise<void> {
    this.credentials = null;
    this.credentialLifetimeMs = null;
    await this.fetchCredentials();
  }

  /**
   * Forcefully reconnect to MQTT (useful when reviving from background)
   */
  async forceReconnect(): Promise<void> {
    console.log('[MQTT] Forcing connection resume/reconnect...');
    if (this.client?.connected) {
      console.log('[MQTT] Already connected, skipping force reconnect');
      return;
    }

    // Clear any pending timers
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // Reset attempts and try connecting immediately
    this.reconnectAttempts = 0;
    try {
      await this.connect();
    } catch (error) {
      console.error('[MQTT] Force reconnect failed:', error);
      // Let the normal reconnect loop take over if it fails
      this.handleReconnect();
    }
  }
}

export const mqttLocationService = new MqttLocationService();
