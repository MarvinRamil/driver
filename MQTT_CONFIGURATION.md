# MQTT Configuration Guide

## Overview

The drivers app uses MQTT for real-time location updates. MQTT credentials are **loaded from environment variables** at runtime.

## Environment Variables

Create a `.env` file in the `bee-drivers-app` directory with the following variables:

```env
# MQTT Broker Configuration (REQUIRED)
EXPO_PUBLIC_MQTT_HOST=mqtt.ilocosscript.live
EXPO_PUBLIC_MQTT_PORT=80
EXPO_PUBLIC_MQTT_USE_SSL=false

# MQTT Authentication (Optional, but recommended)
EXPO_PUBLIC_MQTT_USERNAME=ilocosscript
EXPO_PUBLIC_MQTT_PASSWORD=passwordZxc123AbC

# MQTT Topic Configuration (Optional)
EXPO_PUBLIC_MQTT_TOPIC_PREFIX=beelogistics/drivers

# API Configuration (Optional)
EXPO_PUBLIC_API_URL=https://api.mybeeapp.com
EXPO_PUBLIC_API_DEBUG=false
```

## Required Variables

- **EXPO_PUBLIC_MQTT_HOST** - MQTT broker hostname (e.g., `mqtt.ilocosscript.live`)
- **EXPO_PUBLIC_MQTT_PORT** - MQTT broker port (default: `80` for WS, `443` for WSS)
- **EXPO_PUBLIC_MQTT_USE_SSL** - Use SSL/TLS (`true` or `false`, default: `false`)

## Optional Variables

- **EXPO_PUBLIC_MQTT_USERNAME** - MQTT broker username (default: empty)
- **EXPO_PUBLIC_MQTT_PASSWORD** - MQTT broker password (default: empty)
- **EXPO_PUBLIC_MQTT_TOPIC_PREFIX** - Topic prefix for location updates (default: `beelogistics/drivers`)

## Configuration Examples

### WebSocket (WS) Connection
```env
EXPO_PUBLIC_MQTT_HOST=mqtt.example.com
EXPO_PUBLIC_MQTT_PORT=80
EXPO_PUBLIC_MQTT_USE_SSL=false
EXPO_PUBLIC_MQTT_USERNAME=driver-app
EXPO_PUBLIC_MQTT_PASSWORD=secure-password
```

### Secure WebSocket (WSS) Connection
```env
EXPO_PUBLIC_MQTT_HOST=mqtt.example.com
EXPO_PUBLIC_MQTT_PORT=443
EXPO_PUBLIC_MQTT_USE_SSL=true
EXPO_PUBLIC_MQTT_USERNAME=driver-app
EXPO_PUBLIC_MQTT_PASSWORD=secure-password
```

### TCP Connection (if supported)
```env
EXPO_PUBLIC_MQTT_HOST=mqtt.example.com
EXPO_PUBLIC_MQTT_PORT=1883
EXPO_PUBLIC_MQTT_USE_SSL=false
```

## How It Works

1. **Environment Variables**: The app reads MQTT configuration from environment variables at startup
2. **Automatic Connection**: When location tracking starts, the app automatically attempts to connect to MQTT
3. **HTTP Fallback**: If MQTT connection fails, the app automatically falls back to HTTP batch API
4. **No Expiration**: Environment-based credentials don't expire (unlike API-based tokens)

## Important Notes

- **EXPO_PUBLIC_ Prefix**: In Expo/React Native, environment variables must be prefixed with `EXPO_PUBLIC_` to be accessible in the app
- **Restart Required**: After changing `.env` file, you must restart the Expo development server
- **Build Time**: Environment variables are embedded at build time, so you need to rebuild the app for production changes

## Troubleshooting

### Error: "EXPO_PUBLIC_MQTT_HOST is required"

**Solution**: Add `EXPO_PUBLIC_MQTT_HOST` to your `.env` file:
```env
EXPO_PUBLIC_MQTT_HOST=your-mqtt-broker.com
```

### Error: "MQTT connection failed, will use HTTP fallback"

This is **not an error** - it's a fallback mechanism. The app will:
1. Try to connect to MQTT
2. If it fails, automatically use HTTP batch API instead
3. Location updates will still work, just via HTTP instead of MQTT

**To fix MQTT connection**:
1. Verify MQTT broker is accessible from your device/network
2. Check that `EXPO_PUBLIC_MQTT_HOST` and `EXPO_PUBLIC_MQTT_PORT` are correct
3. Verify MQTT broker supports WebSocket connections
4. Check network connectivity

### Checking MQTT Connection Status

The app logs MQTT connection status. Look for these log messages:

- `[MQTT] Loading credentials from environment` - Loading from env vars
- `[MQTT] Credentials loaded from environment` - Credentials loaded
- `[MQTT] Connecting with credentials` - Attempting connection
- `MQTT connected successfully` - Connection successful
- `MQTT connection failed, will use HTTP fallback` - Fallback to HTTP

## Testing MQTT Connection

1. Add MQTT configuration to `.env` file
2. Restart Expo development server (`npm start` or `expo start`)
3. Start the app and enable location tracking
4. Check the logs for MQTT connection messages
5. If connection fails, check:
   - MQTT broker configuration
   - Network connectivity
   - MQTT broker accessibility
   - Environment variable values

## Production Builds

For production builds (EAS Build), you can set environment variables in:

1. **EAS Secrets** (recommended):
   ```bash
   eas secret:create --scope project --name EXPO_PUBLIC_MQTT_HOST --value mqtt.example.com
   eas secret:create --scope project --name EXPO_PUBLIC_MQTT_PORT --value 80
   eas secret:create --scope project --name EXPO_PUBLIC_MQTT_USE_SSL --value false
   ```

2. **eas.json** build profiles:
   ```json
   {
     "build": {
       "production": {
         "env": {
           "EXPO_PUBLIC_MQTT_HOST": "mqtt.example.com",
           "EXPO_PUBLIC_MQTT_PORT": "80",
           "EXPO_PUBLIC_MQTT_USE_SSL": "false"
         }
       }
     }
   }
   ```

## Summary

- **MQTT credentials come from environment variables** (`.env` file)
- Use `EXPO_PUBLIC_` prefix for all environment variables
- Restart Expo server after changing `.env` file
- The app automatically falls back to HTTP if MQTT fails
- No backend API calls needed for MQTT credentials
