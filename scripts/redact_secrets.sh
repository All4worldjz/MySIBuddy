#!/bin/bash
#
# redact_secrets.sh
# Masks API keys and tokens in local backup files to prevent sensitive data exposure.
#

set -e

# Define patterns to redact
# sk-cp- and sk-sp- keys
SK_PATTERN='sk-[a-zA-Z0-9_-]{20,}'
# Access token in JSON
ACCESS_TOKEN_PATTERN='"accessToken":\s*"[^"]*"'
# Device token
DEVICE_TOKEN_PATTERN='w7FyvZTSBB8nT5EUSbxB4GiG56J-7n58XjA5M5Z3nec'

# Files to process (from docs directory)
TARGET_DIR="./docs"

echo "Starting redaction of secrets in $TARGET_DIR..."

# Use perl for better regex handling if available, otherwise use sed
if command -v perl >/dev/null 2>&1; then
    find "$TARGET_DIR" -type f \( -name "*.json" -o -name "*.md" \) -print0 | xargs -0 perl -i -pe "s/$SK_PATTERN/sk-REDACTED/g"
    find "$TARGET_DIR" -type f \( -name "*.json" -o -name "*.md" \) -print0 | xargs -0 perl -i -pe 's/"accessToken":\s*"[^"]*"/"accessToken": "REDACTED"/g'
    find "$TARGET_DIR" -type f \( -name "*.json" -o -name "*.md" \) -print0 | xargs -0 perl -i -pe "s/$DEVICE_TOKEN_PATTERN/REDACTED-DEVICE-TOKEN/g"
else
    # Fallback to sed (syntax might vary between GNU and BSD/macOS)
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS sed
        find "$TARGET_DIR" -type f \( -name "*.json" -o -name "*.md" \) -exec sed -i '' -E "s/$SK_PATTERN/sk-REDACTED/g" {} +
        find "$TARGET_DIR" -type f \( -name "*.json" -o -name "*.md" \) -exec sed -i '' -E 's/"accessToken":\s*"[^"]*"/"accessToken": "REDACTED"/g' {} +
        find "$TARGET_DIR" -type f \( -name "*.json" -o -name "*.md" \) -exec sed -i '' -E "s/$DEVICE_TOKEN_PATTERN/REDACTED-DEVICE-TOKEN/g" {} +
    else
        # GNU sed
        find "$TARGET_DIR" -type f \( -name "*.json" -o -name "*.md" \) -exec sed -i -E "s/$SK_PATTERN/sk-REDACTED/g" {} +
        find "$TARGET_DIR" -type f \( -name "*.json" -o -name "*.md" \) -exec sed -i -E 's/"accessToken":\s*"[^"]*"/"accessToken": "REDACTED"/g' {} +
        find "$TARGET_DIR" -type f \( -name "*.json" -o -name "*.md" \) -exec sed -i -E "s/$DEVICE_TOKEN_PATTERN/REDACTED-DEVICE-TOKEN/g" {} +
    fi
fi

echo "Redaction complete."
