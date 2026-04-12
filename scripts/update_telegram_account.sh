#!/bin/bash
# update_telegram_account.sh - Update Telegram account configuration
# Usage: ./update_telegram_account.sh <old_account_id> <new_account_id> <new_bot_token> <new_bot_username>

set -e

OLD_ACCOUNT="$1"
NEW_ACCOUNT="$2"
NEW_TOKEN="$3"
NEW_USERNAME="$4"

if [[ -z "$OLD_ACCOUNT" || -z "$NEW_ACCOUNT" || -z "$NEW_TOKEN" || -z "$NEW_USERNAME" ]]; then
    echo "Usage: $0 <old_account_id> <new_account_id> <new_bot_token> <new_bot_username>"
    echo "Example: $0 chief neo 8735481198:AAHvLoed7FILA_qX2rQxexO77dREiNedMns @NEO4MySiBuddy_bot"
    exit 1
fi

OPENCLAW_JSON="/home/admin/.openclaw/openclaw.json"
SECRETS_JSON="/home/admin/.openclaw/runtime-secrets.json"
BACKUP_DIR="/home/admin/.openclaw/docs/telegram-account-backup-$(date +%Y%m%d_%H%M%S)"

echo "=== Telegram Account Update Script ==="
echo "Old Account: $OLD_ACCOUNT"
echo "New Account: $NEW_ACCOUNT"
echo "New Bot Username: $NEW_USERNAME"
echo "Token Prefix: ${NEW_TOKEN%%:*}"
echo ""

# Create backup
echo "[1/5] Creating backup at $BACKUP_DIR..."
mkdir -p "$BACKUP_DIR"
cp "$OPENCLAW_JSON" "$BACKUP_DIR/openclaw.json.bak"
cp "$SECRETS_JSON" "$BACKUP_DIR/runtime-secrets.json.bak"
echo "Backup created."

# Step 2: Add new token to runtime-secrets.json
echo "[2/5] Adding new token to runtime-secrets.json..."
jq --arg key "TELEGRAM_BOT_TOKEN_${NEW_ACCOUNT^^}" --arg value "$NEW_TOKEN" \
    '. + {($key): $value}' "$SECRETS_JSON" > /tmp/secrets_tmp.json
mv /tmp/secrets_tmp.json "$SECRETS_JSON"
echo "Token added as TELEGRAM_BOT_TOKEN_${NEW_ACCOUNT^^}"

# Step 3: Rename account in openclaw.json
echo "[3/5] Renaming account in openclaw.json..."
jq --arg oldAccount "$OLD_ACCOUNT" --arg newAccount "$NEW_ACCOUNT" \
    '.channels.telegram.accounts[$newAccount] = .channels.telegram.accounts[$oldAccount] |
     del(.channels.telegram.accounts[$oldAccount])' \
    "$OPENCLAW_JSON" > /tmp/openclaw_tmp.json

# Update the botToken reference to use new account name
jq --arg oldAccount "$OLD_ACCOUNT" --arg newAccount "$NEW_ACCOUNT" \
    '(.channels.telegram.accounts[$newAccount].botToken.id) = "/TELEGRAM_BOT_TOKEN_\($newAccount | ascii_upcase)"' \
    /tmp/openclaw_tmp.json > /tmp/openclaw_tmp2.json
mv /tmp/openclaw_tmp2.json "$OPENCLAW_JSON"
echo "Account renamed and token reference updated."

# Step 4: Update bot username in account name
echo "[4/5] Updating bot username..."
jq --arg newUsername "$NEW_USERNAME" \
    ".channels.telegram.accounts.[\"$NEW_ACCOUNT\"].name = \$newUsername" \
    "$OPENCLAW_JSON" > /tmp/openclaw_tmp.json
mv /tmp/openclaw_tmp.json "$OPENCLAW_JSON"
echo "Bot username updated."

# Step 5: Update bindings
echo "[5/5] Updating bindings..."
jq --arg oldAccount "$OLD_ACCOUNT" --arg newAccount "$NEW_ACCOUNT" \
    '.bindings = [.bindings[] | if .match.accountId == $oldAccount then .match.accountId = $newAccount else . end]' \
    "$OPENCLAW_JSON" > /tmp/openclaw_tmp.json
mv /tmp/openclaw_tmp.json "$OPENCLAW_JSON"
echo "Bindings updated."

echo ""
echo "=== Validation ==="
echo "Checking openclaw.json syntax..."
jq empty "$OPENCLAW_JSON" && echo "OK: openclaw.json is valid JSON" || echo "ERROR: JSON syntax error!"

echo ""
echo "Verifying new account exists..."
jq -r ".channels.telegram.accounts.$NEW_ACCOUNT.name" "$OPENCLAW_JSON"

echo ""
echo "Verifying binding..."
jq -r ".bindings[] | select(.match.accountId == \"$NEW_ACCOUNT\") | .agentId" "$OPENCLAW_JSON"

echo ""
echo "=== Update Complete ==="
echo "Restart gateway with: systemctl --user restart openclaw-gateway"
echo "Backup location: $BACKUP_DIR"
