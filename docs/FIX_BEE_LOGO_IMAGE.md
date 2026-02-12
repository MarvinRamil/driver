# Fix bee_logo.png Image Format Issue

## Problem
`bee_logo.png` has a `.png` extension but the file content is actually JPG format. Expo requires PNG files for app icons.

## Error Messages
- `the file extension should match the content, but the file extension is .png while the file content is of type jpg`
- `field 'icon' should point to .png image but the file has type jpg`

## Solution

### Option 1: Convert JPG to PNG (Recommended)

1. Open `bee_logo.png` in an image editor (Photoshop, GIMP, or online tool)
2. Export/Save as PNG format
3. Ensure it's 1024x1024 pixels (square) for best results
4. Replace the existing file

### Option 2: Use Online Converter

1. Go to an online JPG to PNG converter (e.g., convertio.co, iloveimg.com)
2. Upload `bee_logo.png`
3. Convert to PNG
4. Download and replace the file

### Option 3: Use Command Line (if ImageMagick is installed)

```bash
cd bee-drivers-app/assets/images
magick bee_logo.png bee_logo_fixed.png
# Or with convert command:
convert bee_logo.png bee_logo_fixed.png
```

### Option 4: Rename and Update References

If you want to keep it as JPG:
1. Rename: `bee_logo.png` → `bee_logo.jpg`
2. Update `app.json` to use `.jpg` extension (but this won't work for icons - icons must be PNG)

## After Fixing

Once you have a proper PNG file:

1. Update `app.json` to use `bee_logo.png`:
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

2. Verify with expo-doctor:
   ```bash
   npx expo-doctor
   ```

## Current Status

✅ **Temporary Fix Applied**: Using `icon.png` instead of `bee_logo.png` until the logo is converted to PNG format.

The app will work with `icon.png`, but you should convert `bee_logo.png` to proper PNG format and update the references to use it.

## Image Requirements

For app icons:
- **Format**: PNG (not JPG)
- **Size**: 1024x1024 pixels recommended
- **Square**: Best results with square images
- **No transparency**: For Android adaptive icon (or minimal transparency)

