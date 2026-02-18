# MQTT Connection Troubleshooting Guide

## Error: "EXPO_PUBLIC_MQTT_HOST is required"

This error means the MQTT host environment variable is not set. 

### Solution

1. Create a `.env` file in the `bee-drivers-app` directory (if it doesn't exist)
2. Add the required MQTT configuration:

```env
EXPO_PUBLIC_MQTT_HOST=mqtt.ilocosscript.live
EXPO_PUBLIC_MQTT_PORT=80
EXPO_PUBLIC_MQTT_USE_SSL=false
EXPO_PUBLIC_MQTT_USERNAME=ilocosscript
EXPO_PUBLIC_MQTT_PASSWORD=passwordZxc123AbC
```

3. **Restart the Expo development server** (environment variables are loaded at startup)

### Important Notes

- Environment variables must be prefixed with `EXPO_PUBLIC_` in Expo
- After changing `.env`, you must restart Expo (`npm start` or `expo start`)
- For production builds, set environment variables in EAS secrets or `eas.json`

## Error: "MQTT connection failed, will use HTTP fallback"

This is **not an error** - it's a fallback mechanism. The app will:
1. Try to connect to MQTT
2. If it fails, automatically use HTTP batch API instead
3. Location updates will still work, just via HTTP instead of MQTT

### MQTT behind Cloudflare Tunnel (WS on port 80)

If your broker is behind a **Cloudflare Tunnel** and you can only connect with **WS** (not WSS) in MQTT Explorer:

- Use **plain WebSocket** on port **80** in the app:
  ```env
  EXPO_PUBLIC_MQTT_USE_SSL=false
  EXPO_PUBLIC_MQTT_PORT=80
  ```
- The app will connect with `ws://your-host:80/mqtt`. Restart Expo after changing `.env` (`npx expo start --clear`).

### To Fix MQTT Connection

1. **Verify Environment Variables**:
   - Check that `.env` file exists in `bee-drivers-app` directory
   - Verify `EXPO_PUBLIC_MQTT_HOST` is set correctly
   - Check `EXPO_PUBLIC_MQTT_PORT` matches your MQTT broker port
   - Ensure `EXPO_PUBLIC_MQTT_USE_SSL` is correct (`true` for WSS, `false` for WS)

2. **Restart Expo Server**:
   ```bash
   # Stop the current server (Ctrl+C)
   # Then restart
   npm start
   # or
   expo start
   ```

3. **Check MQTT Broker**:
   - Verify MQTT broker is running and accessible
   - Test connection from your network/device
   - Check firewall rules allow connections to MQTT port

4. **Check Network Connectivity**:
   - Ensure device/emulator can reach MQTT broker
   - Test with `ping` or `telnet` to MQTT host:port

## Error: "Invalid MQTT wsUrl format"

This means the WebSocket URL couldn't be constructed properly.

### Solution

1. Check environment variables are set correctly:
   ```env
   EXPO_PUBLIC_MQTT_HOST=mqtt.example.com  # No http:// or ws:// prefix
   EXPO_PUBLIC_MQTT_PORT=80                # Valid port number
   EXPO_PUBLIC_MQTT_USE_SSL=false          # true or false
   ```

2. Verify the MQTT broker supports WebSocket connections (not just TCP)

## Checking MQTT Connection Status

The app logs MQTT connection status. Look for these log messages:

- `[MQTT] Loading credentials from environment` - Loading from env vars
- `[MQTT] Credentials loaded from environment` - Credentials loaded successfully
- `[MQTT] Connecting with credentials` - Attempting connection
- `MQTT connected successfully` - Connection successful
- `MQTT connection failed, will use HTTP fallback` - Fallback to HTTP

## Common Issues

### Issue 1: Environment Variables Not Loading

**Symptom**: Error "EXPO_PUBLIC_MQTT_HOST is required" even though `.env` file exists

**Solutions**:
1. Make sure `.env` file is in `bee-drivers-app` directory (not root)
2. Restart Expo development server after creating/modifying `.env`
3. Check variable names have `EXPO_PUBLIC_` prefix
4. Verify no typos in variable names

### Issue 2: Wrong Port or Protocol (Connection Timeout)

**Symptom**: `MQTT connection timeout` or connection refused

**Cause**: WSS (secure WebSocket) must use port **443**. If your env has port **80** with `EXPO_PUBLIC_MQTT_USE_SSL=true`, the connection will fail (brokers typically serve WSS on 443 only). The app now auto-corrects port 80 → 443 when SSL is enabled.

**Solutions**:
1. For **Secure WebSocket (WSS)** use port **443**: `EXPO_PUBLIC_MQTT_PORT=443` and `EXPO_PUBLIC_MQTT_USE_SSL=true`
2. For plain WebSocket (WS) use port **80**: `EXPO_PUBLIC_MQTT_PORT=80` and `EXPO_PUBLIC_MQTT_USE_SSL=false`
3. After changing `.env`, **restart Expo** and clear cache if needed: `npx expo start --clear`
4. Verify the MQTT broker is listening for WebSocket on the chosen port

### Issue 3: Authentication Failed

**Symptom**: Connection established but authentication fails

**Solutions**:
1. Check `EXPO_PUBLIC_MQTT_USERNAME` and `EXPO_PUBLIC_MQTT_PASSWORD` are correct
2. Verify credentials with MQTT broker administrator
3. Check if MQTT broker requires authentication (some allow anonymous)

### Issue 4: Production Build Not Using Environment Variables

**Symptom**: Works in development but fails in production build

**Solutions**:
1. Set environment variables in EAS secrets:
   ```bash
   eas secret:create --scope project --name EXPO_PUBLIC_MQTT_HOST --value mqtt.example.com
   eas secret:create --scope project --name EXPO_PUBLIC_MQTT_PORT --value 80
   eas secret:create --scope project --name EXPO_PUBLIC_MQTT_USE_SSL --value false
   ```

2. Or configure in `eas.json`:
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

## Testing MQTT Connection

1. Add MQTT configuration to `.env` file:
   ```env
   EXPO_PUBLIC_MQTT_HOST=mqtt.ilocosscript.live
   EXPO_PUBLIC_MQTT_PORT=80
   EXPO_PUBLIC_MQTT_USE_SSL=false
   EXPO_PUBLIC_MQTT_USERNAME=ilocosscript
   EXPO_PUBLIC_MQTT_PASSWORD=passwordZxc123AbC
   ```

2. Restart Expo development server

3. Start the app and enable location tracking

4. Check the logs for:
   - `[MQTT] Loading credentials from environment` ✓
   - `[MQTT] Credentials loaded from environment` ✓
   - `[MQTT] Connecting with credentials` ✓
   - `MQTT connected successfully` ✓

5. If connection fails:
   - Check MQTT broker is accessible
   - Verify network connectivity
   - Check environment variable values
   - Review MQTT broker logs

## Environment Variable Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `EXPO_PUBLIC_MQTT_HOST` | Yes | - | MQTT broker hostname |
| `EXPO_PUBLIC_MQTT_PORT` | No | `80` | MQTT broker port |
| `EXPO_PUBLIC_MQTT_USE_SSL` | No | `false` | Use SSL/TLS (`true`/`false`) |
| `EXPO_PUBLIC_MQTT_USERNAME` | No | `""` | MQTT broker username |
| `EXPO_PUBLIC_MQTT_PASSWORD` | No | `""` | MQTT broker password |
| `EXPO_PUBLIC_MQTT_TOPIC_PREFIX` | No | `beelogistics/drivers` | Topic prefix for location updates |

## Still Having Issues?

1. Check app logs for detailed error messages
2. Verify `.env` file is in the correct location (`bee-drivers-app/.env`)
3. Restart Expo server after changing environment variables
4. Test MQTT broker connectivity from your network
5. Verify MQTT broker supports WebSocket connections
6. Check firewall rules allow connections to MQTT port
