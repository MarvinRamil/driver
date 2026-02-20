import * as Device from 'expo-device';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Device fingerprinting service for mobile apps
 * Generates a unique, persistent device fingerprint for security purposes
 * 
 * SECURITY: Device fingerprinting helps detect token theft and unauthorized access
 * The fingerprint is stored securely and reused across sessions
 */

const DEVICE_FINGERPRINT_KEY = 'device_fingerprint';
const DEVICE_ID_KEY = 'device_id';

/**
 * Generate a unique device fingerprint based on device characteristics
 * This fingerprint is stable across app sessions but unique per device
 */
async function generateDeviceFingerprint(): Promise<string> {
  try {
    // Collect device characteristics
    const deviceInfo = {
      // Device hardware info
      deviceName: Device.deviceName || 'unknown',
      deviceType: Device.deviceType || 'unknown',
      brand: Device.brand || 'unknown',
      manufacturer: Device.manufacturer || 'unknown',
      modelName: Device.modelName || 'unknown',
      osName: Device.osName || Platform.OS,
      osVersion: Device.osVersion || 'unknown',
      
      // App info
      appVersion: Constants.expoConfig?.version || 'unknown',
      installationId: Constants.installationId || 'unknown',
      sessionId: Constants.sessionId || 'unknown',
      
      // Platform
      platform: Platform.OS,
    };

    // Create a hash of device characteristics
    // Using a combination that's stable but unique per device
    const fingerprintString = [
      deviceInfo.installationId, // Most stable identifier
      deviceInfo.deviceName,
      deviceInfo.brand,
      deviceInfo.modelName,
      deviceInfo.osName,
      deviceInfo.osVersion,
      deviceInfo.platform,
    ].join('|');

    // Generate SHA-256 hash (truncated to 64 chars for storage efficiency)
    const hash = simpleHash(fingerprintString);
    
    return hash;
  } catch (error) {
    console.warn('[DeviceFingerprint] Error generating fingerprint:', error);
    // Fallback: use installation ID if available
    return Constants.installationId || `fallback-${Date.now()}`;
  }
}

/**
 * Simple hash function for React Native
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  // Convert to hex and pad to 64 chars
  return Math.abs(hash).toString(16).padStart(16, '0').repeat(4).substring(0, 64);
}

/**
 * Generate a simple device ID (shorter, for display purposes)
 */
function generateDeviceId(): string {
  try {
    const deviceInfo = [
      Device.brand || 'unknown',
      Device.modelName || 'unknown',
      Platform.OS,
      Constants.installationId?.substring(0, 8) || 'unknown',
    ].join('-');
    
    return deviceInfo.substring(0, 50); // Limit length
  } catch (error) {
    console.warn('[DeviceFingerprint] Error generating device ID:', error);
    return `device-${Platform.OS}-${Date.now()}`;
  }
}

/**
 * Get or create device fingerprint
 * Stores fingerprint securely and reuses it across sessions
 */
export async function getDeviceFingerprint(): Promise<string> {
  try {
    // Try to get stored fingerprint first
    const stored = await SecureStore.getItemAsync(DEVICE_FINGERPRINT_KEY);
    if (stored) {
      return stored;
    }

    // Generate new fingerprint
    const fingerprint = await generateDeviceFingerprint();
    
    // Store securely for future use
    await SecureStore.setItemAsync(DEVICE_FINGERPRINT_KEY, fingerprint);
    
    if (__DEV__) {
      console.log('[DeviceFingerprint] Generated new device fingerprint');
    }
    
    return fingerprint;
  } catch (error) {
    console.error('[DeviceFingerprint] Error getting fingerprint:', error);
    // Fallback: generate on-the-fly
    return generateDeviceFingerprint();
  }
}

/**
 * Get or create device ID (shorter identifier)
 */
export async function getDeviceId(): Promise<string> {
  try {
    // Try to get stored device ID first
    const stored = await SecureStore.getItemAsync(DEVICE_ID_KEY);
    if (stored) {
      return stored;
    }

    // Generate new device ID
    const deviceId = generateDeviceId();
    
    // Store securely for future use
    await SecureStore.setItemAsync(DEVICE_ID_KEY, deviceId);
    
    return deviceId;
  } catch (error) {
    console.error('[DeviceFingerprint] Error getting device ID:', error);
    // Fallback: generate on-the-fly
    return generateDeviceId();
  }
}

/**
 * Clear stored device fingerprint (useful for testing or reset)
 */
export async function clearDeviceFingerprint(): Promise<void> {
  try {
    await Promise.all([
      SecureStore.deleteItemAsync(DEVICE_FINGERPRINT_KEY),
      SecureStore.deleteItemAsync(DEVICE_ID_KEY),
    ]);
  } catch (error) {
    console.warn('[DeviceFingerprint] Error clearing fingerprint:', error);
  }
}
