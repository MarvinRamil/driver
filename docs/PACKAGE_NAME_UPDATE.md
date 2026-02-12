# Package Name Update

## Changes Made

The package names have been updated to be more specific and properly namespaced:

### Driver App
- **Android Package**: `com.mybee.app` → `com.mybeeapp.driver`
- **iOS Bundle Identifier**: `com.anonymous.beedriversapp` → `com.mybeeapp.driver`

### Customer App
- **Android Package**: `com.anonymous.beecustomerapp` → `com.mybeeapp.customer`
- **iOS Bundle Identifier**: `com.anonymous.beecustomerapp` → `com.mybeeapp.customer`

## Important Notes

### 1. Development Build Required

You're seeing this error:
```
CommandError: No development build (com.mybee.app) for this project is installed.
```

**Solution**: You need to build a development build with the new package name:

```bash
# For Android
eas build --profile development --platform android

# For iOS
eas build --profile development --platform ios
```

Then install the build on your device before running `expo start --dev-client`.

### 2. Google Services File

The `google-services.json` file currently has the old package name (`com.mybee.app`). 

**If you're using Firebase for other features** (not just push notifications):
- Go to Firebase Console
- Add a new Android app with package name `com.mybeeapp.driver`
- Download the new `google-services.json`
- Replace the existing file

**If you're only using Expo Push Notifications** (which we just set up):
- You can remove or ignore the `google-services.json` file
- It's not needed for Expo Push Notifications

### 3. Rebuild Required

Since the package name changed, you **must** rebuild the app:
- Old builds won't work with the new package name
- Development builds need to be rebuilt
- Production builds need to be rebuilt

### 4. EAS Credentials

If you've already set up EAS credentials, you may need to:
- Update Android keystore (if package name changed)
- Update iOS certificates (if bundle identifier changed)

Run `eas credentials` to manage credentials.

## Next Steps

1. **Build a new development build**:
   ```bash
   eas build --profile development --platform android
   ```

2. **Install the build** on your device

3. **Run the dev server**:
   ```bash
   expo start --dev-client
   ```

4. **Update Firebase** (if using Firebase features):
   - Add new Android app in Firebase Console
   - Download new `google-services.json`

