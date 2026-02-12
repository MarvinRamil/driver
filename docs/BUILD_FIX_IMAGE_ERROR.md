# Fix for Android Image Compilation Error

## Problem
Build error: `assets_images_bee_logo.png: AAPT: error: file failed to compile`

## Root Cause
The `bee_logo.png` image is failing Android resource compilation. This can happen if:
1. Image format is corrupted or incompatible
2. Image dimensions are not suitable for Android resources
3. Image has transparency issues for adaptive icon

## Solution

### Option 1: Ensure Image is Properly Formatted (Recommended)

For app icons, the image should be:
- **Format**: PNG
- **Size**: 1024x1024 pixels (square)
- **For Android Adaptive Icon**: 
  - Square image
  - Important content should be in the center 66% (safe area)
  - Outer 25% may be cropped on different devices
  - No transparency (or minimal)

**Steps:**
1. Open `bee_logo.png` in an image editor
2. Resize to 1024x1024 if needed
3. Ensure it's a valid PNG file
4. For adaptive icon, make sure logo is centered with safe margins
5. Save as PNG-24 format

### Option 2: Use a Different Image for Icon

If `bee_logo.png` continues to cause issues, you can:
1. Create a square version of the logo specifically for the app icon
2. Name it `app-icon.png`
3. Update `app.json`:
   ```json
   "icon": "./assets/images/app-icon.png",
   "android": {
     "adaptiveIcon": {
       "foregroundImage": "./assets/images/app-icon.png",
       "backgroundColor": "#FFD700"
     }
   }
   ```

### Option 3: Check Image File Integrity

Verify the image file is not corrupted:
```bash
# Check if file exists and is readable
file bee-drivers-app/assets/images/bee_logo.png

# Try to open it in an image viewer
# If it doesn't open, the file might be corrupted
```

## Current Configuration

✅ **App Name**: Set to "BEE DRIVER APP"
✅ **App Icon**: Using `bee_logo.png`
✅ **Android Label**: Set to "BEE DRIVER APP"
✅ **iOS Display Name**: Set to "BEE DRIVER APP"
✅ **Adaptive Icon Background**: Set to "#FFD700" (yellow)

## Next Steps

1. Verify `bee_logo.png` is a valid 1024x1024 PNG
2. If issues persist, create a square icon version
3. Rebuild: `eas build --profile preview --platform android`

## Image Requirements Summary

| Use Case | Size | Format | Notes |
|----------|------|--------|-------|
| App Icon | 1024x1024 | PNG | Square, no transparency preferred |
| Android Adaptive Icon | 1024x1024 | PNG | Center 66% safe area, square |
| Notification Icon | 96x96 | PNG | White/transparent, will be tinted |
| Splash Screen | Any | PNG | Can be any size, will be scaled |

