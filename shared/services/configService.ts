import * as SecureStore from 'expo-secure-store';
import { apiClient } from './apiClient';

const CONFIG_KEYS = {
  MQTT_HOST: 'bee_config_mqtt_host',
  MQTT_PORT: 'bee_config_mqtt_port',
  MQTT_USERNAME: 'bee_config_mqtt_username',
  MQTT_PASSWORD: 'bee_config_mqtt_password',
  MQTT_USE_SSL: 'bee_config_mqtt_use_ssl',
  MQTT_TOPIC_PREFIX: 'bee_config_mqtt_topic_prefix',
  MQTT_PATH: 'bee_config_mqtt_path',
  GOOGLE_MAPS_API_KEY: 'bee_config_google_maps_api_key',
  MAPBOX_ACCESS_TOKEN: 'bee_config_mapbox_access_token',
} as const;

interface RemoteConfig {
  mqtt_host?: string;
  mqtt_port?: number;
  mqtt_username?: string;
  mqtt_password?: string;
  mqtt_use_ssl?: boolean;
  mqtt_topic_prefix?: string;
  mqtt_path?: string;
  google_maps_api_key?: string;
  mapbox_access_token?: string;
}

// In-memory cache — populated from SecureStore on initialize(), then kept in sync
const cache: Partial<Record<string, string>> = {};

class ConfigService {
  /**
   * Load cached config from SecureStore into memory. Call once at app startup
   * before any service tries to read config values synchronously.
   */
  async initialize(): Promise<void> {
    try {
      await Promise.all(
        Object.values(CONFIG_KEYS).map(async (key) => {
          const value = await SecureStore.getItemAsync(key);
          if (value !== null) {
            cache[key] = value;
          }
        }),
      );
    } catch (error) {
      console.warn('[ConfigService] Failed to hydrate config from SecureStore:', error);
    }
  }

  /**
   * Fetch secrets from the backend /api/config endpoint (which proxies Vault)
   * and persist them to SecureStore + in-memory cache. Non-throwing — falls back
   * to whatever is already cached if the request fails.
   */
  async loadRemoteConfig(): Promise<void> {
    try {
      const response = await apiClient.get<RemoteConfig>('config');
      if (!response.success || !response.data) return;

      const config = response.data;
      const entries: [string, string][] = ([
        [CONFIG_KEYS.MQTT_HOST, config.mqtt_host],
        [CONFIG_KEYS.MQTT_PORT, config.mqtt_port !== undefined ? String(config.mqtt_port) : undefined],
        [CONFIG_KEYS.MQTT_USERNAME, config.mqtt_username],
        [CONFIG_KEYS.MQTT_PASSWORD, config.mqtt_password],
        [CONFIG_KEYS.MQTT_USE_SSL, config.mqtt_use_ssl !== undefined ? String(config.mqtt_use_ssl) : undefined],
        [CONFIG_KEYS.MQTT_TOPIC_PREFIX, config.mqtt_topic_prefix],
        [CONFIG_KEYS.MQTT_PATH, config.mqtt_path],
        [CONFIG_KEYS.GOOGLE_MAPS_API_KEY, config.google_maps_api_key],
        [CONFIG_KEYS.MAPBOX_ACCESS_TOKEN, config.mapbox_access_token],
      ] as [string, string | undefined][]).filter((entry): entry is [string, string] => !!entry[1]);

      await Promise.all(
        entries.map(async ([key, value]) => {
          cache[key] = value;
          await SecureStore.setItemAsync(key, value);
        }),
      );

      console.log('[ConfigService] Remote config loaded successfully');
    } catch (error) {
      console.warn('[ConfigService] Remote config fetch failed, using cached/env fallback:', error);
    }
  }

  /**
   * Wipe all config from SecureStore and memory. Call on logout.
   */
  async clearRemoteConfig(): Promise<void> {
    try {
      await Promise.all(
        Object.values(CONFIG_KEYS).map(async (key) => {
          delete cache[key];
          await SecureStore.deleteItemAsync(key);
        }),
      );
    } catch (error) {
      console.warn('[ConfigService] Failed to clear config:', error);
    }
  }

  private resolve(key: string, envFallback: string | undefined): string | undefined {
    return cache[key] ?? envFallback ?? undefined;
  }

  getMqttHost(): string | undefined {
    return this.resolve(CONFIG_KEYS.MQTT_HOST, process.env.EXPO_PUBLIC_MQTT_HOST);
  }

  getMqttPort(): string | undefined {
    return this.resolve(CONFIG_KEYS.MQTT_PORT, process.env.EXPO_PUBLIC_MQTT_PORT);
  }

  getMqttUsername(): string | undefined {
    return this.resolve(CONFIG_KEYS.MQTT_USERNAME, process.env.EXPO_PUBLIC_MQTT_USERNAME);
  }

  getMqttPassword(): string | undefined {
    return this.resolve(CONFIG_KEYS.MQTT_PASSWORD, process.env.EXPO_PUBLIC_MQTT_PASSWORD);
  }

  getMqttUseSsl(): string | undefined {
    return this.resolve(CONFIG_KEYS.MQTT_USE_SSL, process.env.EXPO_PUBLIC_MQTT_USE_SSL);
  }

  getMqttTopicPrefix(): string | undefined {
    return this.resolve(CONFIG_KEYS.MQTT_TOPIC_PREFIX, process.env.EXPO_PUBLIC_MQTT_TOPIC_PREFIX);
  }

  getMqttPath(): string | undefined {
    return this.resolve(CONFIG_KEYS.MQTT_PATH, process.env.EXPO_PUBLIC_MQTT_PATH);
  }

  getGoogleMapsApiKey(): string | undefined {
    return this.resolve(CONFIG_KEYS.GOOGLE_MAPS_API_KEY, process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY);
  }

  getMapboxAccessToken(): string | undefined {
    return this.resolve(CONFIG_KEYS.MAPBOX_ACCESS_TOKEN, process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN);
  }
}

export const configService = new ConfigService();
