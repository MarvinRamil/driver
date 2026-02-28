#!/bin/bash
# Environment Setup Script for Multi-Environment CI/CD
# This script detects the environment from the branch and sets up environment variables

set -e

# Ensure we're in the project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

echo "=== Environment Setup ==="
echo "Working directory: $(pwd)"
echo "Script location: $SCRIPT_DIR"

# IMPORTANT: Remove any existing .env files first to prevent using stale values
# Remove from root and common subdirectories
echo "🔍 Searching for existing .env files..."
find . -maxdepth 3 -name ".env" -type f 2>/dev/null | while read -r env_file; do
  echo "⚠️  Found existing .env file: $env_file"
  rm -f "$env_file"
  echo "✅ Removed: $env_file"
done

# Also remove .env.backup files
find . -maxdepth 3 -name ".env.backup" -type f 2>/dev/null | while read -r env_file; do
  echo "⚠️  Found backup .env file: $env_file"
  rm -f "$env_file"
  echo "✅ Removed: $env_file"
done

# CRITICAL: Unset any EXPO_PUBLIC_* variables that might have been loaded from old .env
# This ensures we start with a clean slate
echo ""
echo "🧹 Unsetting any existing EXPO_PUBLIC_* environment variables..."
for var in $(env | grep "^EXPO_PUBLIC_" | cut -d= -f1); do
  echo "  Unsetting: $var"
  unset "$var"
done
echo "✅ All EXPO_PUBLIC_* variables cleared"

# Detect environment from branch name
BRANCH_NAME=${CI_COMMIT_REF_SLUG:-unknown}
BUILD_NUM=${CI_PIPELINE_IID:-1}

echo "Branch: $BRANCH_NAME"
echo "Build Number: $BUILD_NUM"

# Map branch to environment
if [ "$BRANCH_NAME" = "features" ]; then
  ENV="dev"
  ENV_PREFIX="DEV"
  ENV_DISPLAY="Development"
elif [ "$BRANCH_NAME" = "dev" ]; then
  ENV="staging"
  ENV_PREFIX="STAGING"
  ENV_DISPLAY="Staging"
elif [ "$BRANCH_NAME" = "main" ] || [ "$BRANCH_NAME" = "master" ]; then
  ENV="production"
  ENV_PREFIX="PROD"
  ENV_DISPLAY="Production"
else
  # Default to development for unknown branches
  ENV="dev"
  ENV_PREFIX="DEV"
  ENV_DISPLAY="Development (default)"
fi

echo "Environment: $ENV_DISPLAY ($ENV)"
echo "Variable Prefix: ${ENV_PREFIX}_"

# Debug: Show available GitLab variables for this environment
echo ""
echo "=== Available GitLab Variables (for debugging) ==="
echo "Looking for variables with prefix: ${ENV_PREFIX}_"
env | grep "^${ENV_PREFIX}_" | sed 's/=.*/=***masked***/' | head -20 || echo "  No variables found with prefix ${ENV_PREFIX}_"
echo ""

# Function to get environment variable with fallback
# Uses indirect variable expansion to read GitLab CI/CD variables
get_env_var() {
  local var_name=$1
  local default_value=$2
  
  # Try environment-specific variable first (e.g., DEV_EXPO_PUBLIC_API_URL)
  local env_var="${ENV_PREFIX}_${var_name}"
  
  # Use indirect expansion: ${!var} reads the value of the variable named by $var
  # This is more reliable than eval and directly reads from GitLab CI/CD environment
  local value="${!env_var}"
  
  # Debug output (only for non-sensitive variables)
  # IMPORTANT: Redirect to stderr (>&2) so it doesn't get captured in variable assignment
  if [[ "$var_name" != *"PASSWORD"* ]] && [[ "$var_name" != *"API_KEY"* ]]; then
    if [ -n "$value" ]; then
      echo "  ✓ Found ${env_var}: ${value:0:50}..." >&2
    else
      echo "  ✗ ${env_var} not set" >&2
    fi
  else
    if [ -n "$value" ]; then
      echo "  ✓ Found ${env_var}: ***masked***" >&2
    else
      echo "  ✗ ${env_var} not set" >&2
    fi
  fi
  
  # If not set, try generic variable (e.g., EXPO_PUBLIC_API_URL)
  if [ -z "$value" ]; then
    value="${!var_name}"
    if [ -n "$value" ]; then
      if [[ "$var_name" != *"PASSWORD"* ]] && [[ "$var_name" != *"API_KEY"* ]]; then
        echo "  ✓ Using generic ${var_name}: ${value:0:50}..." >&2
      else
        echo "  ✓ Using generic ${var_name}: ***masked***" >&2
      fi
    fi
  fi
  
  # If still not set, use default
  if [ -z "$value" ]; then
    value=$default_value
    echo "  → Using default value for ${var_name}" >&2
  fi
  
  # Output only the value to stdout (for variable assignment)
  echo "$value"
}

# Map environment variables
echo ""
echo "=== Loading Environment Variables from GitLab CI/CD ==="
echo "Reading variables with prefix: ${ENV_PREFIX}_"
echo ""

# API Configuration
echo "Loading API Configuration..."
# CRITICAL: Read directly from GitLab variables, not from shell environment
# This ensures we get fresh values even if shell variables were set earlier
EXPO_PUBLIC_API_URL=$(get_env_var "EXPO_PUBLIC_API_URL" "https://localhost:5001")
echo "DEBUG: After get_env_var, EXPO_PUBLIC_API_URL='$EXPO_PUBLIC_API_URL'" >&2
# Verify we got the right value (not ngrok)
if echo "$EXPO_PUBLIC_API_URL" | grep -q "ngrok"; then
  echo "❌ ERROR: get_env_var returned ngrok value: $EXPO_PUBLIC_API_URL" >&2
  echo "   This suggests GitLab variables contain old values" >&2
  exit 1
fi
EXPO_PUBLIC_API_DEBUG=$(get_env_var "EXPO_PUBLIC_API_DEBUG" "false")

# Google Maps API Configuration
echo ""
echo "Loading Google Maps Configuration..."
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=$(get_env_var "EXPO_PUBLIC_GOOGLE_MAPS_API_KEY" "")

# MQTT Configuration
echo ""
echo "Loading MQTT Configuration..."
EXPO_PUBLIC_MQTT_HOST=$(get_env_var "EXPO_PUBLIC_MQTT_HOST" "mqtt.ilocosscript.live")
EXPO_PUBLIC_MQTT_PORT=$(get_env_var "EXPO_PUBLIC_MQTT_PORT" "443")
EXPO_PUBLIC_MQTT_USE_SSL=$(get_env_var "EXPO_PUBLIC_MQTT_USE_SSL" "true")
EXPO_PUBLIC_MQTT_USERNAME=$(get_env_var "EXPO_PUBLIC_MQTT_USERNAME" "ilocosscript")
EXPO_PUBLIC_MQTT_PASSWORD=$(get_env_var "EXPO_PUBLIC_MQTT_PASSWORD" "")
EXPO_PUBLIC_MQTT_TOPIC_PREFIX=$(get_env_var "EXPO_PUBLIC_MQTT_TOPIC_PREFIX" "beelogistics/drivers")
EXPO_PUBLIC_MQTT_PATH=$(get_env_var "EXPO_PUBLIC_MQTT_PATH" "/mqtt")

# Display loaded values (mask passwords)
echo "API URL: $EXPO_PUBLIC_API_URL"
echo "API Debug: $EXPO_PUBLIC_API_DEBUG"
echo "Google Maps API Key: ${EXPO_PUBLIC_GOOGLE_MAPS_API_KEY:+***masked***}"
echo "MQTT Host: $EXPO_PUBLIC_MQTT_HOST"
echo "MQTT Port: $EXPO_PUBLIC_MQTT_PORT"
echo "MQTT SSL: $EXPO_PUBLIC_MQTT_USE_SSL"
echo "MQTT Username: $EXPO_PUBLIC_MQTT_USERNAME"
echo "MQTT Password: ${EXPO_PUBLIC_MQTT_PASSWORD:+***masked***}"
echo "MQTT Topic Prefix: $EXPO_PUBLIC_MQTT_TOPIC_PREFIX"
echo "MQTT Path: $EXPO_PUBLIC_MQTT_PATH"

# Create .env file for Expo
echo ""
echo "=== Creating .env file ==="
echo "Writing fresh values to .env (any existing file was already removed)"

# Ensure variables don't have any whitespace or debug output
EXPO_PUBLIC_API_URL=$(echo "$EXPO_PUBLIC_API_URL" | xargs)
EXPO_PUBLIC_API_DEBUG=$(echo "$EXPO_PUBLIC_API_DEBUG" | xargs)
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=$(echo "$EXPO_PUBLIC_GOOGLE_MAPS_API_KEY" | xargs)
EXPO_PUBLIC_MQTT_HOST=$(echo "$EXPO_PUBLIC_MQTT_HOST" | xargs)
EXPO_PUBLIC_MQTT_PORT=$(echo "$EXPO_PUBLIC_MQTT_PORT" | xargs)
EXPO_PUBLIC_MQTT_USE_SSL=$(echo "$EXPO_PUBLIC_MQTT_USE_SSL" | xargs)
EXPO_PUBLIC_MQTT_USERNAME=$(echo "$EXPO_PUBLIC_MQTT_USERNAME" | xargs)
EXPO_PUBLIC_MQTT_PASSWORD=$(echo "$EXPO_PUBLIC_MQTT_PASSWORD" | xargs)
EXPO_PUBLIC_MQTT_TOPIC_PREFIX=$(echo "$EXPO_PUBLIC_MQTT_TOPIC_PREFIX" | xargs)
EXPO_PUBLIC_MQTT_PATH=$(echo "$EXPO_PUBLIC_MQTT_PATH" | xargs)

# CRITICAL DEBUG: Show what values we're about to write to .env
echo "=== DEBUG: Values being written to .env file ===" >&2
echo "EXPO_PUBLIC_API_URL='$EXPO_PUBLIC_API_URL'" >&2
if echo "$EXPO_PUBLIC_API_URL" | grep -q "ngrok"; then
  echo "❌ ERROR: About to write ngrok value to .env!" >&2
  echo "   Value: $EXPO_PUBLIC_API_URL" >&2
  echo "   This should not happen - GitLab variables must contain old values" >&2
  exit 1
fi
echo "EXPO_PUBLIC_MQTT_HOST='$EXPO_PUBLIC_MQTT_HOST'" >&2
echo "" >&2

# Write .env file using echo (more reliable than heredoc for variable expansion)
# This ensures we use the exact values from the variables above
{
  echo "# Environment: $ENV_DISPLAY"
  echo "# Branch: $BRANCH_NAME"
  echo "# Build: $BUILD_NUM"
  echo "# Generated: $(date -u +"%Y-%m-%d %H:%M:%S UTC")"
  echo ""
  echo "# API Configuration"
  echo "EXPO_PUBLIC_API_URL=$EXPO_PUBLIC_API_URL"
  echo "EXPO_PUBLIC_API_DEBUG=$EXPO_PUBLIC_API_DEBUG"
  echo ""
  echo "# Google Maps API Configuration"
  echo "EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=$EXPO_PUBLIC_GOOGLE_MAPS_API_KEY"
  echo ""
  echo "# MQTT Configuration"
  echo "EXPO_PUBLIC_MQTT_HOST=$EXPO_PUBLIC_MQTT_HOST"
  echo "EXPO_PUBLIC_MQTT_PORT=$EXPO_PUBLIC_MQTT_PORT"
  echo "EXPO_PUBLIC_MQTT_USE_SSL=$EXPO_PUBLIC_MQTT_USE_SSL"
  echo "EXPO_PUBLIC_MQTT_USERNAME=$EXPO_PUBLIC_MQTT_USERNAME"
  echo "EXPO_PUBLIC_MQTT_PASSWORD=$EXPO_PUBLIC_MQTT_PASSWORD"
  echo "EXPO_PUBLIC_MQTT_TOPIC_PREFIX=$EXPO_PUBLIC_MQTT_TOPIC_PREFIX"
  echo "EXPO_PUBLIC_MQTT_PATH=$EXPO_PUBLIC_MQTT_PATH"
} > .env

echo "✅ .env file created successfully"
# CRITICAL: Verify what was actually written to .env
echo "=== DEBUG: Verifying what was written to .env ===" >&2
if [ -f ".env" ]; then
  WRITTEN_API_URL=$(grep "^EXPO_PUBLIC_API_URL=" .env | cut -d= -f2- | head -1)
  echo "Value written to .env: '$WRITTEN_API_URL'" >&2
  if echo "$WRITTEN_API_URL" | grep -q "ngrok"; then
    echo "❌ ERROR: .env file contains ngrok value!" >&2
    echo "   Written value: $WRITTEN_API_URL" >&2
    echo "   Expected value: $EXPO_PUBLIC_API_URL" >&2
    echo "   This indicates a problem with variable expansion in heredoc" >&2
    exit 1
  fi
  if [ "$WRITTEN_API_URL" != "$EXPO_PUBLIC_API_URL" ]; then
    echo "⚠️  WARNING: .env value doesn't match script variable!" >&2
    echo "   Script variable: $EXPO_PUBLIC_API_URL" >&2
    echo "   .env file value: $WRITTEN_API_URL" >&2
  else
    echo "✅ .env file contains correct value" >&2
  fi
else
  echo "❌ ERROR: .env file was not created!" >&2
  exit 1
fi

# Verify .env file exists and show its location
if [ -f ".env" ]; then
  echo "✅ Verified: .env file exists at $(pwd)/.env"
  ENV_SIZE=$(wc -c < .env | tr -d ' ')
  echo "✅ .env file size: ${ENV_SIZE} bytes"
else
  echo "❌ ERROR: .env file was not created!"
  exit 1
fi

echo ""
echo "=== .env file contents (masked) ==="
# Display .env file but mask passwords and API keys
sed 's/\(EXPO_PUBLIC_MQTT_PASSWORD=\).*/\1***masked***/' .env | \
sed 's/\(EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=\).*/\1***masked***/'
echo ""

# Verify the values we're about to export match what's in .env
echo "=== Verification: Comparing script variables to .env file ==="
# Read back from .env to verify (strip any whitespace)
ENV_API_URL=$(grep "^EXPO_PUBLIC_API_URL=" .env | cut -d= -f2- | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
SCRIPT_API_URL=$(echo "$EXPO_PUBLIC_API_URL" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')

echo "Script variable EXPO_PUBLIC_API_URL: '$SCRIPT_API_URL'"
echo ".env file EXPO_PUBLIC_API_URL: '$ENV_API_URL'"

if [ "$ENV_API_URL" = "$SCRIPT_API_URL" ]; then
  echo "✅ EXPO_PUBLIC_API_URL matches: ${ENV_API_URL:0:50}..."
  # Check for old ngrok value (should not be used)
  if echo "$ENV_API_URL" | grep -q "ngrok"; then
    echo "❌ ERROR: API URL contains 'ngrok' - this is an OLD value!"
    echo "   Current value: $ENV_API_URL"
    echo "   This suggests GitLab CI variables contain old values."
    echo "   Please update GitLab → Settings → CI/CD → Variables"
    echo "   Remove any variables containing 'ngrok' and set correct values"
    exit 1
  fi
  
  if [ "$ENV_API_URL" = "https://localhost:5001" ] || [ -z "$ENV_API_URL" ]; then
    echo "⚠️  WARNING: Value is default/empty! GitLab variables may not be set correctly."
  fi
else
  echo "❌ MISMATCH! Script has: '${SCRIPT_API_URL:0:50}...'"
  echo "   .env file has: '${ENV_API_URL:0:50}...'"
  echo "   This indicates the .env file was not written correctly!"
fi
echo ""

# Export variables for current shell session
export EXPO_PUBLIC_API_URL
export EXPO_PUBLIC_API_DEBUG
export EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
export EXPO_PUBLIC_MQTT_HOST
export EXPO_PUBLIC_MQTT_PORT
export EXPO_PUBLIC_MQTT_USE_SSL
export EXPO_PUBLIC_MQTT_USERNAME
export EXPO_PUBLIC_MQTT_PASSWORD
export EXPO_PUBLIC_MQTT_TOPIC_PREFIX
export EXPO_PUBLIC_MQTT_PATH

# Update app.json with environment metadata (optional)
if [ -f "app.json" ]; then
  echo "=== Updating app.json with environment metadata ==="
  
  # Install json tool if not available
  if ! command -v npx &> /dev/null || ! npx json --version &> /dev/null; then
    npm install json --no-save 2>/dev/null || true
  fi
  
  # Update app.json extra section with environment info
  npx json -I -f app.json -e "this.expo.extra.environment='$ENV'" 2>/dev/null || true
  npx json -I -f app.json -e "this.expo.extra.envDisplay='$ENV_DISPLAY'" 2>/dev/null || true
  npx json -I -f app.json -e "this.expo.extra.buildNumber='$BUILD_NUM'" 2>/dev/null || true
  npx json -I -f app.json -e "this.expo.extra.branch='$BRANCH_NAME'" 2>/dev/null || true
  
  echo "✅ app.json updated with environment metadata"
fi

echo ""
echo "=== Final Verification ==="
echo "Checking that .env file is in the correct location and has correct values..."

# Verify .env is in project root
if [ ! -f ".env" ]; then
  echo "❌ ERROR: .env file not found in project root: $(pwd)"
  echo "   Current directory: $(pwd)"
  echo "   Files in current directory:"
  ls -la | head -10
  exit 1
fi

# Show first few lines to verify it's our file
echo "✅ .env file found at: $(pwd)/.env"
echo "First 3 lines of .env:"
head -3 .env

# Verify it contains our environment marker
if grep -q "Environment: $ENV_DISPLAY" .env; then
  echo "✅ .env file contains correct environment marker: $ENV_DISPLAY"
else
  echo "⚠️  WARNING: .env file doesn't contain expected environment marker"
fi

# Final check: Show what API URL is actually in the file
ACTUAL_API_URL=$(grep "^EXPO_PUBLIC_API_URL=" .env | cut -d= -f2- | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' | head -1)
ACTUAL_MQTT_HOST=$(grep "^EXPO_PUBLIC_MQTT_HOST=" .env | cut -d= -f2- | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' | head -1)
echo ""
echo "📋 Final Values in .env file:"
echo "   EXPO_PUBLIC_API_URL: '$ACTUAL_API_URL'"
echo "   EXPO_PUBLIC_MQTT_HOST: '$ACTUAL_MQTT_HOST'"
echo ""
echo "📋 Exported Shell Variables:"
echo "   EXPO_PUBLIC_API_URL: '${EXPO_PUBLIC_API_URL:-not set}'"
echo "   EXPO_PUBLIC_MQTT_HOST: '${EXPO_PUBLIC_MQTT_HOST:-not set}'"
echo ""
echo "=== Comparison Check ==="
# Check for old ngrok value in final .env file
if echo "$ACTUAL_API_URL" | grep -q "ngrok"; then
  echo "❌ ERROR: Final .env file contains 'ngrok' - this is an OLD value!"
  echo "   Current value: $ACTUAL_API_URL"
  echo "   This suggests GitLab CI variables contain old values."
  echo "   Please update GitLab → Settings → CI/CD → Variables"
  echo "   Remove any variables containing 'ngrok' and set correct values"
  exit 1
fi

if [ "$ACTUAL_API_URL" = "$EXPO_PUBLIC_API_URL" ]; then
  echo "✅ .env file and exported variable MATCH for EXPO_PUBLIC_API_URL"
  if [ "$ACTUAL_API_URL" = "https://localhost:5001" ] || [ -z "$ACTUAL_API_URL" ]; then
    echo "⚠️  WARNING: Value is default/empty! This suggests GitLab variables were not read."
  fi
else
  echo "❌ MISMATCH! .env file has: '$ACTUAL_API_URL'"
  echo "   Exported variable has: '$EXPO_PUBLIC_API_URL'"
fi
echo ""
echo "=== Debug: Searching for ALL .env files in project ==="
echo "Searching for .env files (excluding node_modules and .git):"
find . -maxdepth 5 -name ".env" -type f ! -path "*/node_modules/*" ! -path "*/.git/*" ! -path "*/.expo/*" 2>/dev/null | while read -r env_file; do
  echo "  📄 Found: $env_file"
  echo "     Size: $(wc -c < "$env_file" | tr -d ' ') bytes"
  ENV_FILE_API_URL=$(grep '^EXPO_PUBLIC_API_URL=' "$env_file" | cut -d= -f2- | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' | head -1)
  echo "     EXPO_PUBLIC_API_URL: '$ENV_FILE_API_URL'"
  if [ "$env_file" != "./.env" ]; then
    echo "     ⚠️  WARNING: This is NOT the main .env file! It might be interfering."
  fi
done || echo "  ✅ No additional .env files found (only the main one)"
echo ""
echo "=== Environment Setup Complete ==="
echo "Environment: $ENV_DISPLAY"
echo ".env file location: $(pwd)/.env"
echo "File size: $(wc -c < .env | tr -d ' ') bytes"
echo ""
echo "⚠️  DEBUGGING TIPS: If your app is still using old values:"
echo "   1. Check if any .env files exist in android/ directory (shown above)"
echo "   2. Verify the .env file shown above has the correct values"
echo "   3. Check if Expo is reading from a cached location"
echo "   4. Ensure android/ directory is removed before prebuild"
echo ""

