# URGENT: Fix bee_logo.png to Complete Build

## Problem
The build is failing because `bee_logo.png` is actually a JPG file with a `.png` extension. Android's resource compiler cannot process it.

## Why This Happens
Even though we changed the app icon references, `bee_logo.png` is still used in:
- Splash screen (`app/_splash.tsx`)

Any file referenced in code gets bundled, and Android tries to compile it as a resource.

## Quick Fix Applied
✅ Changed splash screen to use `icon.png` temporarily so the build can complete.

## Permanent Fix Required

You **MUST** convert `bee_logo.png` to a proper PNG file:

### Step 1: Convert the File

**Option A: Using Online Tool (Easiest)**
1. Go to https://convertio.co/jpg-png/ or https://www.iloveimg.com/convert-to-png
2. Upload `bee-drivers-app/assets/images/bee_logo.png`
3. Convert to PNG
4. Download the converted file
5. Replace the original file

**Option B: Using Image Editor**
1. Open `bee_logo.png` in any image editor (Paint, Photoshop, GIMP, etc.)
2. File → Save As → Choose PNG format
3. Save and replace the original

**Option C: Using Command Line (if you have ImageMagick)**
```bash
cd bee-drivers-app/assets/images
magick bee_logo.png -format png bee_logo_fixed.png
# Then replace the original:
move /Y bee_logo_fixed.png bee_logo.png
```

### Step 2: Verify the File
After conversion, verify it's a proper PNG:
```bash
# The file should open in an image viewer without errors
# Check file properties - it should show as PNG format
```

### Step 3: Restore References
Once you have a proper PNG file, update the code:

1. **Splash Screen** (`app/_splash.tsx`):
   ```tsx
   source={require('@/assets/images/bee_logo.png')}
   ```

2. **App Icon** (`app.json`):
   ```json
   "icon": "./assets/images/bee_logo.png",
   "android": {
     "adaptiveIcon": {
       "foregroundImage": "./assets/images/bee_logo.png",
       "backgroundColor": "#FFD700"
     }
   },
   "plugins": [
     [
       "expo-notifications",
       {
         "icon": "./assets/images/bee_logo.png",
         ...
       }
     ]
   ]
   ```

### Step 4: Rebuild
```bash
eas build --profile preview --platform android
```

## Current Status
- ✅ Build will work with `icon.png` (temporary)
- ⚠️ You need to convert `bee_logo.png` to proper PNG for permanent fix
- ⚠️ After conversion, restore `bee_logo.png` references in code

## Why This Matters
- The file is used in the splash screen, so it must be a valid PNG
- Android resource compiler is strict about file formats
- JPG files cannot be used where PNG is expected

## Image Requirements
- **Format**: Must be PNG (not JPG with .png extension)
- **Size**: Any size works for splash screen
- **For app icon**: 1024x1024 recommended

