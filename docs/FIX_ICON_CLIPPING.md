# Fix Android App Icon Clipping Issue

## Problem
The app icon appears clipped or cut off when installed on Android devices. This happens because Android adaptive icons can be displayed in different shapes (circle, rounded square, squircle, etc.) and the outer edges get cropped.

## Root Cause
Android adaptive icons use a **safe zone** system:
- The icon is displayed in a 108x108 dp container
- Different devices apply different masks (circle, rounded square, etc.)
- Content outside the safe zone (center ~66%) can be cropped
- The outer 25% on each side may be cut off

## Solution

### Option 1: Fix the Icon Image (Recommended)

The `adaptive-icon.png` file needs to be redesigned with proper padding:

1. **Open** `assets/images/adaptive-icon.png` in an image editor (Photoshop, GIMP, Figma, etc.)

2. **Create a new canvas** that's 1024x1024 pixels

3. **Add padding/margins** around your logo:
   - Keep important content in the **center 66%** (approximately 675x675 pixels)
   - Leave **at least 17% padding** on all sides (approximately 175 pixels)
   - This ensures your logo won't be clipped on any device

4. **Visual Guide**:
   ```
   ┌─────────────────────────────────┐
   │         Safe Zone (66%)          │
   │    ┌─────────────────────┐      │
   │    │                     │      │
   │    │   Your Logo Here    │      │
   │    │   (Center Content)  │      │
   │    │                     │      │
   │    └─────────────────────┘      │
   │         Padding (17%+)           │
   └─────────────────────────────────┘
   ```

5. **Save** as PNG format (1024x1024 pixels)

6. **Replace** the existing `adaptive-icon.png` file

7. **Rebuild** the app:
   ```bash
   eas build --profile preview --platform android
   ```

### Option 2: Use Online Icon Generator

1. Go to an Android adaptive icon generator (e.g., https://romannurik.github.io/AndroidAssetStudio/icons-adaptive.html)
2. Upload your logo
3. Adjust padding/size to ensure content fits in safe zone
4. Download the generated foreground image
5. Replace `adaptive-icon.png` with the downloaded file

### Option 3: Use Expo Icon Generator

1. Visit: https://expo-assets-generator.vercel.app/
2. Upload your icon
3. Adjust safe area padding
4. Download the optimized adaptive icon
5. Replace `adaptive-icon.png`

## Current Configuration

✅ **Foreground Image**: `./assets/images/adaptive-icon.png`
✅ **Background Color**: `#FFD700` (Yellow/Gold)
✅ **Fallback Icon**: `./assets/images/icon.png`

## Icon Requirements

- **Format**: PNG (with transparency if needed)
- **Size**: 1024x1024 pixels (square)
- **Safe Zone**: Keep important content in center 66%
- **Padding**: Minimum 17% on all sides
- **Background**: Can be transparent (background color will show)

## Testing

After updating the icon:

1. Build a new APK/AAB
2. Install on different Android devices
3. Check icon appearance in:
   - App drawer (various shapes)
   - Home screen
   - Recent apps
   - Settings

## Additional Notes

- The `backgroundColor` in `app.json` will show through transparent areas
- For best results, design your icon with the safe zone in mind
- Some devices use circular masks, others use rounded squares
- The safe zone ensures your icon looks good on all devices

## Quick Fix Checklist

- [ ] Open `adaptive-icon.png` in image editor
- [ ] Resize canvas to 1024x1024 if needed
- [ ] Add padding around logo (17%+ margins)
- [ ] Ensure logo fits in center 66% area
- [ ] Save as PNG format
- [ ] Replace existing file
- [ ] Rebuild app
- [ ] Test on device
