# Splash screen (single source)

The app has **one** splash screen: the **native** one defined in `app.json`. It uses your transparent logo on the brand yellow background.

- **Image:** `assets/images/splash-icon.png` (transparent PNG)
- **Background:** `#ffcd36` (brand yellow) — shows through the transparent parts of the image
- **Resize:** `contain` so the full logo is visible and not cropped

## Why you might still see the old splash or only yellow

The native splash is baked into the app at **build time**. If you only replace the image file:

- The **running app** (existing install) still has the old asset until you reinstall.
- **Expo Go** may cache the old splash.
- **Development builds** need a clean prebuild so the new image is copied into the native project.

So you must **rebuild** to see the new transparent image.

## After updating the splash image

1. **Clear Metro cache** (so the new file is used in JS/bundled assets):
   ```bash
   npx expo start -c
   ```

2. **Rebuild the native app** so the new splash is embedded:
   - **Development build (local):**
     ```bash
     npx expo prebuild --clean
     npx expo run:ios
     # or
     npx expo run:android
     ```
   - **EAS build:** run a new build (e.g. `eas build --platform ios`). The new splash will appear in the next build.

3. **Reinstall** the app on the device/simulator so the new binary (with the new splash) is installed.

## Android: circular clip (cannot be removed)

On **Android 12 and later**, the system Splash Screen API **always** shows the splash image inside a **circular mask**. This is a platform rule from Google and cannot be turned off in Expo or in the native project.

**Workaround:** Design your `splash-icon.png` so the important part (logo + “BEE ON-DEMAND”) fits inside a circle:

- Use a **square** image (e.g. 1024×1024 px).
- Put the logo and text **centered** so the circular crop doesn’t cut them off.
- Keep the outer corners simple or transparent; they will be clipped by the circle.

On **iOS**, the splash is not forced into a circle; the full image is shown with your `resizeMode` and background color.

## Removed: second (in-app) splash

The old in-app splash screen (`_splash.tsx`) was removed so there is only one splash: the native one. That avoids two different splash experiences and ensures the transparent image and yellow background from `app.json` are the only ones used.
