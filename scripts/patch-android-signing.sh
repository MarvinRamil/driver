#!/bin/bash
# Script to patch build.gradle for release signing after expo prebuild
# This is needed because the android folder is generated and not in git

set -e

BUILD_GRADLE="android/app/build.gradle"
KEYSTORE_FILE="${ANDROID_KEYSTORE_FILE:-app/release.keystore}"
KEY_ALIAS="${ANDROID_KEY_ALIAS:-release-key}"

if [ ! -f "$BUILD_GRADLE" ]; then
  echo "Error: $BUILD_GRADLE not found"
  exit 1
fi

if [ ! -f "android/app/$KEYSTORE_FILE" ]; then
  echo "Warning: Keystore file not found at android/app/$KEYSTORE_FILE"
  echo "Release signing will not be configured"
  exit 0
fi

echo "Patching $BUILD_GRADLE for release signing..."

# Create a temporary file for the patched build.gradle
TMP_FILE=$(mktemp)

# Read build.gradle and patch it
python3 << PYTHON_SCRIPT > "$TMP_FILE"
import sys
import re

with open('$BUILD_GRADLE', 'r') as f:
    content = f.read()

# Check if release signingConfig already exists
if 'signingConfigs.release' in content:
    print("Release signingConfig already exists, updating...")
    # Update existing release signingConfig
    pattern = r'(signingConfigs\s*\{[^}]*?release\s*\{[^}]*?storeFile\s*)file\([^)]+\)'
    replacement = r'\1file("$KEYSTORE_FILE")'
    content = re.sub(pattern, replacement, content, flags=re.DOTALL)
    
    pattern = r'(signingConfigs\s*\{[^}]*?release\s*\{[^}]*?keyAlias\s*)[^\n]+'
    replacement = r'\1"$KEY_ALIAS"'
    content = re.sub(pattern, replacement, content, flags=re.DOTALL)
else:
    # Add release signingConfig after debug config
    release_config = '''
        release {
            storeFile file("$KEYSTORE_FILE")
            storePassword System.getenv("ANDROID_KEYSTORE_PASSWORD")
            keyAlias "$KEY_ALIAS"
            keyPassword System.getenv("ANDROID_KEY_PASSWORD") ?: System.getenv("ANDROID_KEYSTORE_PASSWORD")
        }
'''
    # Insert after debug signingConfig, before closing brace
    pattern = r'(signingConfigs\s*\{[^}]*?debug\s*\{[^}]*?\}\s*)'
    replacement = r'\1' + release_config
    content = re.sub(pattern, replacement, content, flags=re.DOTALL)

# Update release buildType to use release signingConfig
pattern = r'(release\s*\{[^}]*?)signingConfig\s+signingConfigs\.debug'
replacement = r'\1signingConfig signingConfigs.release'
content = re.sub(pattern, replacement, content, flags=re.DOTALL)

print(content)
PYTHON_SCRIPT

# Replace original file
mv "$TMP_FILE" "$BUILD_GRADLE"

echo "Successfully patched $BUILD_GRADLE for release signing"
