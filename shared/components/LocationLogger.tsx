import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '@/shared/hooks/use-theme';
import { ThemedText } from '@/shared/components/themed-text';
import { Ionicons } from '@expo/vector-icons';
import { BeeColors } from '@/constants/theme';
import { mqttLocationService } from '@/features/driver/services/mqttLocationService';
import { useLocationTrackingStatus } from '@/features/driver/hooks/useLocationTracking';

/**
 * Location Logger Component
 * Shows real-time location tracking status (MQTT/HTTP)
 * OTA-compatible - pure React component
 */
export function LocationLogger() {
  const theme = useTheme();
  const locationStatus = useLocationTrackingStatus();
  const [mqttConnected, setMqttConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(0);
  const [mqttError, setMqttError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<any>(null);

  useEffect(() => {
    // Check MQTT connection status
    const checkMqttStatus = () => {
      const connected = mqttLocationService.isConnected();
      const error = mqttLocationService.getLastError();
      const debug = mqttLocationService.getDebugInfo();
      setMqttConnected(connected);
      setMqttError(error);
      setDebugInfo(debug);
    };

    // Check immediately
    checkMqttStatus();

    // Update every second
    const interval = setInterval(checkMqttStatus, 1000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Update last sent time
    if (locationStatus.lastSentTime > 0) {
      setLastUpdate(locationStatus.lastSentTime);
    }
  }, [locationStatus.lastSentTime]);

  // Calculate time since last sent
  const getTimeSinceLastSent = (): string => {
    if (locationStatus.lastSentTime === 0) {
      return 'Never';
    }
    const seconds = Math.floor((Date.now() - locationStatus.lastSentTime) / 1000);
    if (seconds < 10) {
      return 'Just now';
    }
    if (seconds < 60) {
      return `${seconds}s ago`;
    }
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) {
      return `${minutes}m ago`;
    }
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  // Determine method (MQTT or HTTP)
  const getMethod = (): string => {
    if (mqttConnected && locationStatus.hasRecentUpdate) {
      return 'MQTT';
    }
    if (locationStatus.hasRecentUpdate) {
      return 'HTTP';
    }
    return 'None';
  };

  // Check if env vars are loaded (for debugging)
  const [envCheck, setEnvCheck] = useState({
    hasHost: false,
    hostValue: '',
    hasUsername: false,
    usernameValue: '',
    hasPassword: false,
    passwordValue: '',
    portValue: '',
    useSsl: false,
    wsUrl: '',
  });

  useEffect(() => {
    // Check env vars (for debugging)
    const checkEnv = () => {
      const host = process.env.EXPO_PUBLIC_MQTT_HOST;
      const username = process.env.EXPO_PUBLIC_MQTT_USERNAME;
      const password = process.env.EXPO_PUBLIC_MQTT_PASSWORD;
      const port = process.env.EXPO_PUBLIC_MQTT_PORT || '80';
      const useSsl = process.env.EXPO_PUBLIC_MQTT_USE_SSL === 'true' || process.env.EXPO_PUBLIC_MQTT_USE_SSL === '1';
      
      // Build WebSocket URL to show
      const protocol = useSsl || port === '443' ? 'wss' : 'ws';
      const wsUrl = `${protocol}://${host}:${port}/mqtt`;
      
      setEnvCheck({
        hasHost: !!host,
        hostValue: host || 'NOT SET',
        hasUsername: !!username,
        usernameValue: username || 'NOT SET',
        hasPassword: !!password,
        passwordValue: password || 'NOT SET',
        portValue: port,
        useSsl,
        wsUrl: host ? wsUrl : 'NOT SET',
      });
    };
    checkEnv();
  }, []);

  // Get status color
  const getStatusColor = (): string => {
    if (!locationStatus.isTracking) {
      return theme.textSecondary;
    }
    if (locationStatus.hasRecentUpdate) {
      return mqttConnected ? theme.success : '#FFA500'; // Orange for HTTP
    }
    return BeeColors.red[600];
  };

  // Get status icon
  const getStatusIcon = (): string => {
    if (!locationStatus.isTracking) {
      return 'stop-circle-outline';
    }
    if (locationStatus.hasRecentUpdate) {
      return mqttConnected ? 'checkmark-circle' : 'warning-outline';
    }
    return 'alert-circle-outline';
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons 
            name="location-outline" 
            size={16} 
            color={theme.textSecondary} 
          />
          <ThemedText style={[styles.title, { color: theme.text }]}>
            Location Tracker
          </ThemedText>
        </View>
        <View style={[styles.statusIndicator, { backgroundColor: getStatusColor() + '20' }]}>
          <Ionicons 
            name={getStatusIcon()} 
            size={12} 
            color={getStatusColor()} 
          />
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.row}>
          <ThemedText style={[styles.label, { color: theme.textSecondary }]}>
            Status:
          </ThemedText>
          <ThemedText style={[styles.value, { color: theme.text }]}>
            {locationStatus.isTracking ? 'Active' : 'Inactive'}
          </ThemedText>
        </View>

        <View style={styles.row}>
          <ThemedText style={[styles.label, { color: theme.textSecondary }]}>
            Method:
          </ThemedText>
          <ThemedText style={[styles.value, { color: mqttConnected ? theme.success : theme.text }]}>
            {getMethod()}
          </ThemedText>
        </View>

        <View style={styles.row}>
          <ThemedText style={[styles.label, { color: theme.textSecondary }]}>
            MQTT:
          </ThemedText>
          <ThemedText style={[styles.value, { color: mqttConnected ? theme.success : BeeColors.red[600] }]}>
            {mqttConnected ? 'Connected' : 'Disconnected'}
          </ThemedText>
        </View>

        <View style={styles.row}>
          <ThemedText style={[styles.label, { color: theme.textSecondary }]}>
            Last Sent:
          </ThemedText>
          <ThemedText style={[styles.value, { color: locationStatus.hasRecentUpdate ? theme.success : theme.textSecondary }]}>
            {getTimeSinceLastSent()}
          </ThemedText>
        </View>

        <View style={styles.row}>
          <ThemedText style={[styles.label, { color: theme.textSecondary }]}>
            Count:
          </ThemedText>
          <ThemedText style={[styles.value, { color: theme.text }]}>
            {locationStatus.lastSentCount}
          </ThemedText>
        </View>

        <View style={styles.row}>
          <ThemedText style={[styles.label, { color: theme.textSecondary }]}>
            Env Host:
          </ThemedText>
          <ThemedText 
            style={[styles.value, styles.hostValue, { color: envCheck.hasHost ? theme.success : BeeColors.red[600] }]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {envCheck.hasHost ? envCheck.hostValue : 'NOT SET'}
          </ThemedText>
        </View>

        <View style={styles.row}>
          <ThemedText style={[styles.label, { color: theme.textSecondary }]}>
            Env Username:
          </ThemedText>
          <ThemedText 
            style={[styles.value, styles.hostValue, { color: envCheck.hasUsername ? theme.success : BeeColors.red[600] }]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {envCheck.hasUsername ? envCheck.usernameValue : 'NOT SET'}
          </ThemedText>
        </View>

        <View style={styles.row}>
          <ThemedText style={[styles.label, { color: theme.textSecondary }]}>
            Env Password:
          </ThemedText>
          <ThemedText 
            style={[styles.value, styles.hostValue, { color: envCheck.hasPassword ? theme.success : BeeColors.red[600] }]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {envCheck.hasPassword ? envCheck.passwordValue : 'NOT SET'}
          </ThemedText>
        </View>

        <View style={styles.row}>
          <ThemedText style={[styles.label, { color: theme.textSecondary }]}>
            Env Port:
          </ThemedText>
          <ThemedText 
            style={[styles.value, { color: theme.text }]}
          >
            {envCheck.portValue || 'NOT SET'}
          </ThemedText>
        </View>

        <View style={styles.row}>
          <ThemedText style={[styles.label, { color: theme.textSecondary }]}>
            Env SSL:
          </ThemedText>
          <ThemedText 
            style={[styles.value, { color: theme.text }]}
          >
            {envCheck.useSsl ? 'Yes' : 'No'}
          </ThemedText>
        </View>

        <View style={styles.row}>
          <ThemedText style={[styles.label, { color: theme.textSecondary }]}>
            WS URL:
          </ThemedText>
          <ThemedText 
            style={[styles.value, styles.hostValue, { color: envCheck.hasHost ? theme.text : BeeColors.red[600] }]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {envCheck.wsUrl}
          </ThemedText>
        </View>

        {mqttError && !mqttConnected && (
          <View style={[styles.errorRow, { backgroundColor: BeeColors.red[50] }]}>
            <Ionicons name="alert-circle" size={12} color={BeeColors.red[600]} />
            <ThemedText style={[styles.errorText, { color: BeeColors.red[700] }]} numberOfLines={2}>
              MQTT: {mqttError}
            </ThemedText>
          </View>
        )}

        {/* Debug Section */}
        {debugInfo && (
          <View style={[styles.debugSection, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}>
            <ThemedText style={[styles.debugTitle, { color: theme.text }]}>
              🔍 MQTT Debug
            </ThemedText>
            
            <View style={styles.row}>
              <ThemedText style={[styles.label, { color: theme.textSecondary }]}>
                State:
              </ThemedText>
              <ThemedText style={[styles.value, { 
                color: debugInfo.connectionState === 'connected' ? theme.success : 
                       debugInfo.connectionState === 'error' ? BeeColors.red[600] : 
                       debugInfo.connectionState === 'connecting' ? '#FFA500' : theme.text 
              }]}>
                {debugInfo.connectionState.toUpperCase()}
              </ThemedText>
            </View>

            <View style={styles.row}>
              <ThemedText style={[styles.label, { color: theme.textSecondary }]}>
                Attempts:
              </ThemedText>
              <ThemedText style={[styles.value, { color: theme.text }]}>
                {debugInfo.connectionAttempts}
              </ThemedText>
            </View>

            <View style={styles.row}>
              <ThemedText style={[styles.label, { color: theme.textSecondary }]}>
                Last Event:
              </ThemedText>
              <ThemedText style={[styles.value, { color: theme.text, flex: 1 }]} numberOfLines={1}>
                {debugInfo.lastEvent}
              </ThemedText>
            </View>

            {debugInfo.wsUrl && (
              <View style={styles.row}>
                <ThemedText style={[styles.label, { color: theme.textSecondary }]}>
                  WS URL:
                </ThemedText>
                <ThemedText style={[styles.value, styles.hostValue, { color: theme.text }]} numberOfLines={1}>
                  {debugInfo.wsUrl}
                </ThemedText>
              </View>
            )}

            {debugInfo.events && debugInfo.events.length > 0 && (
              <View style={styles.eventsContainer}>
                <ThemedText style={[styles.eventsTitle, { color: theme.textSecondary }]}>
                  Recent Events ({debugInfo.events.length}):
                </ThemedText>
                {debugInfo.events.slice(0, 5).map((event: any, index: number) => {
                  const timeAgo = Math.floor((Date.now() - event.time) / 1000);
                  return (
                    <View key={index} style={styles.eventRow}>
                      <ThemedText style={[styles.eventTime, { color: theme.textSecondary }]}>
                        {timeAgo}s ago
                      </ThemedText>
                      <ThemedText style={[styles.eventText, { color: theme.text }]} numberOfLines={1}>
                        {event.event}
                      </ThemedText>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {locationStatus.lastError && (
          <View style={[styles.errorRow, { backgroundColor: BeeColors.red[50] }]}>
            <Ionicons name="alert-circle" size={12} color={BeeColors.red[600]} />
            <ThemedText style={[styles.errorText, { color: BeeColors.red[700] }]} numberOfLines={1}>
              {locationStatus.lastError}
            </ThemedText>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statusIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    gap: 4,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 11,
    fontWeight: '500',
  },
  value: {
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  hostValue: {
    maxWidth: '60%',
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 6,
    borderRadius: 6,
    marginTop: 4,
  },
  errorText: {
    flex: 1,
    fontSize: 10,
  },
  debugSection: {
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  debugTitle: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
  },
  eventsContainer: {
    marginTop: 8,
  },
  eventsTitle: {
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 4,
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    gap: 8,
  },
  eventTime: {
    fontSize: 9,
    minWidth: 50,
  },
  eventText: {
    fontSize: 9,
    flex: 1,
  },
});

