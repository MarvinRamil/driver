import mqtt, { MqttClient } from 'mqtt';
import * as Device from 'expo-device';

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
 * MQTT Credentials from environment variables
 */
export interface MqttCredentials {
  host: string;
  port: number;
  protocol: 'ws' | 'wss';
  wsUrl: string;
  username: string;
  password: string;
  topic: string;
  clientId: string;
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
  private isConnecting: boolean = false;
  private reconnectAttempts: number = 0;
  private readonly maxReconnectAttempts: number = 5;
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
   * Get MQTT credentials from environment variables
   */
  async fetchCredentials(): Promise<MqttCredentials> {
    try {
      console.log('[MQTT] Loading credentials from environment variables');

      // Use env variables but DEFAULT to the working configuration (WSS/443)
      // This ensures that if env vars are missing (OTA issue), it still connects
      const host = process.env.EXPO_PUBLIC_MQTT_HOST || 'mqtt.ilocosscript.live';
      const port = parseInt(process.env.EXPO_PUBLIC_MQTT_PORT || '443', 10);
      const useSsl = (process.env.EXPO_PUBLIC_MQTT_USE_SSL === 'true' || process.env.EXPO_PUBLIC_MQTT_USE_SSL === '1')
        || true; // Default to TRUE (SSL)
      const username = process.env.EXPO_PUBLIC_MQTT_USERNAME || 'ilocosscript';
      const password = process.env.EXPO_PUBLIC_MQTT_PASSWORD || 'passwordZxc123AbC';
      const topicPrefix = process.env.EXPO_PUBLIC_MQTT_TOPIC_PREFIX || 'beelogistics/drivers';
      const path = process.env.EXPO_PUBLIC_MQTT_PATH || '/mqtt';

      console.log('[MQTT] Env check:', {
        hasHost: !!host,
        port,
        useSsl,
        path,
        hasUsername: !!username,
      });

      // Validate required fields
      if (!host) {
        console.error('[MQTT] ❌ EXPO_PUBLIC_MQTT_HOST is missing! This means env vars were not included in the build.');
        console.error('[MQTT] ⚠️ You need to REBUILD the app after setting env vars in Expo.dev');
        throw new Error('EXPO_PUBLIC_MQTT_HOST is required. Please rebuild the app after setting environment variables in Expo.dev.');
      }

      // Determine protocol based on port and SSL setting
      let protocol: 'ws' | 'wss';
      if (port === 443) {
        protocol = 'wss';
      } else {
        protocol = useSsl ? 'wss' : 'ws';
      }

      // Build WebSocket URL
      // Ensure path starts with /
      const safePath = path.startsWith('/') ? path : `/${path}`;
      const wsUrl = `${protocol}://${host}:${port}${safePath}`;

      // Generate unique client ID using device ID or random GUID
      // usage of Device.modelId might need checking if Device is available, otherwise fallback
      const deviceName = Device.modelName || 'unknown-device';
      // Sanitize device name for client ID (remove spaces, special chars)
      const sanitizedDeviceName = deviceName.replace(/[^a-zA-Z0-9-]/g, '').substring(0, 10);
      const clientId = `drv-${sanitizedDeviceName}-${Date.now().toString(36).substring(4)}`;

      // Build topic prefix (driverId will be added when publishing: {prefix}/{driverId}/location)
      const topic = topicPrefix;

      const credentials: MqttCredentials = {
        host,
        port,
        protocol,
        wsUrl,
        username,
        password,
        topic,
        clientId
      };

      console.log('[MQTT] Credentials loaded:', {
        wsUrl: credentials.wsUrl,
        clientId: credentials.clientId,
        username: credentials.username || '(none)',
      });

      this.credentials = credentials;
      return credentials;
    } catch (error) {
      console.error('[MQTT] Error loading credentials from environment:', error);
      throw new Error(
        `Failed to load MQTT credentials: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get valid credentials (from cache or load from env)
   */
  private async getValidCredentials(): Promise<MqttCredentials> {
    // Return in-memory credentials if available
    if (this.credentials) {
      return this.credentials;
    }

    // Load credentials from environment variables
    return await this.fetchCredentials();
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
        connectTimeout: 15000, // Increased timeout
        keepalive: 45, // Increased keepalive
        protocolVersion: 4, // MQTT 3.1.1
        // WebSocket-specific options for React Native
        // Important for self-signed certs or lax security environments
        rejectUnauthorized: false,
        wsOptions: {
          headers: {},
        },
        // Additional options for better compatibility
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
          reject(error);
        };

        // Set timeout
        timeout = setTimeout(() => {
          if (resolved) return;
          resolved = true;
          const elapsed = Date.now() - startTime;
          this.addDebugEvent(`TIMEOUT after ${elapsed}ms`);
          this.lastError = `Connection timeout after ${elapsed}ms`;
          reject(new Error('MQTT connection timeout'));
        }, 15000);

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
      console.error('Max reconnection attempts reached');
      return;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
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
   * @param driverId - Driver ID (required for backend to identify the driver)
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
      // Ensure connected
      if (!this.client?.connected) {
        await this.connect();
      }

      // Get credentials (for topic prefix)
      const credentials = await this.getValidCredentials();

      // Build topic
      let topicPrefix = credentials.topic;
      if (topicPrefix.endsWith('/location')) {
        topicPrefix = topicPrefix.replace(/\/location$/, '');
      }
      topicPrefix = topicPrefix.replace(/\/+$/, '');
      const topic = `${topicPrefix}/${driverId}/location`;

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

      console.log('[MQTT] Publishing location to:', topic);

      // Publish to MQTT
      return new Promise((resolve, reject) => {
        if (!this.client?.connected) {
          reject(new Error('MQTT client not connected'));
          return;
        }

        this.client.publish(topic, payload, { qos: 0 }, (error) => {
          if (error) {
            console.error('[MQTT] Publish error:', error);
            reject(error);
          } else {
            console.log('[MQTT] Location published successfully');
            resolve();
          }
        });
      });
    } catch (error) {
      console.error('[MQTT] Error publishing location:', error);
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

    if (this.client) {
      this.client.end();
      this.client = null;
    }

    this.credentials = null;
    this.reconnectAttempts = 0;
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
   * Refresh credentials (reload from environment)
   */
  async refreshCredentials(): Promise<void> {
    await this.fetchCredentials();
  }
}

export const mqttLocationService = new MqttLocationService();
