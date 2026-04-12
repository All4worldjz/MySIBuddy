#!/bin/bash
# update_telegram_account_interactive.sh - Interactive Telegram Account Update Script
# Provides interactive prompts for updating Telegram account configurations

set -e

OPENCLAW_JSON="/home/admin/.openclaw/openclaw.json"
SECRETS_JSON="/home/admin/.openclaw/runtime-secrets.json"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_header() {
    echo -e "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║         Telegram Account Configuration Updater             ║${NC}"
    echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

print_step() {
    echo -e "${YELLOW}[$1]${NC} $2"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Show current config
show_current_config() {
    echo "Current Telegram Accounts:"
    echo ""
    jq -r '.channels.telegram.accounts | to_entries[] | "  \(.key): \(.value.name) @\(.value.botToken.id | split("_")[2] | split("/")[0])"' "$OPENCLAW_JSON" 2>/dev/null || true
    echo ""
}

# Get input with prompt
get_input() {
    local prompt="$1"
    local var_name="$2"
    local default="$3"
    local is_secret="$4"

    echo -n "$prompt"
    if [[ -n "$default" ]]; then
        if [[ "$is_secret" == "secret" ]]; then
            echo -n " [$default] "
        else
            echo -n " [$default] "
        fi
    else
        echo -n ": "
    fi

    read "$var_name"
    if [[ -z "${!var_name}" && -n "$default" ]]; then
        eval "$var_name=$default"
    fi
}

# Update single account
update_account() {
    local old_account="$1"
    local new_account="$2"
    local new_token="$3"
    local new_username="$4"

    print_step "1" "Backup"
    BACKUP_DIR="/home/admin/.openclaw/docs/telegram-account-backup-$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$BACKUP_DIR"
    cp "$OPENCLAW_JSON" "$BACKUP_DIR/openclaw.json.bak"
    cp "$SECRETS_JSON" "$BACKUP_DIR/runtime-secrets.json.bak"
    print_success "Backup created at $BACKUP_DIR"

    print_step "2" "Add new token to runtime-secrets.json"
    jq --arg key "TELEGRAM_BOT_TOKEN_${new_account^^}" --arg value "$new_token" \
        '. + {($key): $value}' "$SECRETS_JSON" > /tmp/secrets_tmp.json
    mv /tmp/secrets_tmp.json "$SECRETS_JSON"
    chmod 600 "$SECRETS_JSON"
    print_success "Token added as TELEGRAM_BOT_TOKEN_${new_account^^}"

    print_step "3" "Rename account in openclaw.json"
    jq --arg oldAccount "$old_account" --arg newAccount "$new_account" \
        '.channels.telegram.accounts[$newAccount] = .channels.telegram.accounts[$oldAccount] |
         del(.channels.telegram.accounts[$oldAccount])' \
        "$OPENCLAW_JSON" > /tmp/openclaw_tmp.json

    jq --arg newAccount "$new_account" \
        '(.channels.telegram.accounts[$newAccount].botToken.id) = "/TELEGRAM_BOT_TOKEN_\($newAccount | ascii_upcase)"' \
        /tmp/openclaw_tmp.json > /tmp/openclaw_tmp2.json
    mv /tmp/openclaw_tmp2.json "$OPENCLAW_JSON"
    print_success "Account renamed and token reference updated"

    print_step "4" "Update bot username"
    jq --arg newUsername "$new_username" \
        ".channels.telegram.accounts.[\"$new_account\"].name = \$newUsername" \
        "$OPENCLAW_JSON" > /tmp/openclaw_tmp.json
    mv /tmp/openclaw_tmp.json "$OPENCLAW_JSON"
    print_success "Bot username updated to $new_username"

    print_step "5" "Update bindings"
    jq --arg oldAccount "$old_account" --arg newAccount "$new_account" \
        '.bindings = [.bindings[] | if .match.accountId == $old_account then .match.accountId = $newAccount else . end]' \
        "$OPENCLAW_JSON" > /tmp/openclaw_tmp.json
    mv /tmp/openclaw_tmp.json "$OPENCLAW_JSON"
    print_success "Bindings updated"

    print_step "6" "Validate JSON syntax"
    if jq empty "$OPENCLAW_JSON" 2>/dev/null; then
        print_success "openclaw.json is valid JSON"
    else
        print_error "JSON syntax error - restoring backup"
        cp "$BACKUP_DIR/openclaw.json.bak" "$OPENCLAW_JSON"
        cp "$BACKUP_DIR/runtime-secrets.json.bak" "$SECRETS_JSON"
        exit 1
    fi
}

# Main
print_header

echo "Current Configuration:"
show_current_config

echo "Enter updates for each account (press Enter to accept default value):"
echo ""

# Get oracle token fix
echo -e "${YELLOW}--- oracle (mentor → oracle) ---${NC}"
echo "Current token for oracle appears truncated. Please re-enter:"
get_input "New Bot Token for oracle" "ORACLE_TOKEN" "" "secret"
get_input "New Bot Username for oracle" "ORACLE_USER" "@Oracle4MySiBuddy_bot"

if [[ -n "$ORACLE_TOKEN" ]]; then
    print_step "FIX" "Fixing oracle token..."
    jq ".TELEGRAM_BOT_TOKEN_ORACLE = \"$ORACLE_TOKEN\"" "$SECRETS_JSON" > /tmp/secrets.json && mv /tmp/secrets.json "$SECRETS_JSON"
    chmod 600 "$SECRETS_JSON"
    print_success "Oracle token fixed"
fi

echo ""
echo -e "${YELLOW}--- personal (morpheus group + oracle direct) ---${NC}"
get_input "New Account ID" "PERSONAL_NEW_ACCOUNT" "personal"
get_input "New Bot Token" "PERSONAL_TOKEN" "" "secret"
get_input "New Bot Username" "PERSONAL_USER" "@AIboxBD_Bot"

echo ""
echo -e "${YELLOW}--- sysop → link ---${NC}"
get_input "New Account ID" "SYSOP_NEW_ACCOUNT" "link"
get_input "New Bot Token" "SYSOP_TOKEN" "" "secret"
get_input "New Bot Username" "SYSOP_USER" "@ksniuma4cc_bot"

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo "Review of changes:"
echo ""

[[ -n "$ORACLE_TOKEN" ]] && echo "  oracle token: FIXED"
[[ -n "$PERSONAL_TOKEN" ]] && echo "  personal: → $PERSONAL_NEW_ACCOUNT | $PERSONAL_USER | ${PERSONAL_TOKEN%%:*}..."
[[ -n "$SYSOP_TOKEN" ]] && echo "  sysop: → $SYSOP_NEW_ACCOUNT | $SYSOP_USER | ${SYSOP_TOKEN%%:*}..."

echo ""
read -p "Proceed with updates? (y/N): " CONFIRM
if [[ "$CONFIRM" != "y" && "$CONFIRM" != "Y" ]]; then
    echo "Aborted."
    exit 0
fi

echo ""

# Execute updates
[[ -n "$PERSONAL_TOKEN" ]] && update_account "personal" "$PERSONAL_NEW_ACCOUNT" "$PERSONAL_TOKEN" "$PERSONAL_USER"
[[ -n "$SYSOP_TOKEN" ]] && update_account "sysop" "$SYSOP_NEW_ACCOUNT" "$SYSOP_TOKEN" "$SYSOP_USER"

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}All updates complete!${NC}"
echo ""
echo "Restart gateway with:"
echo -e "  ${YELLOW}systemctl --user restart openclaw-gateway${NC}"
echo ""
echo "Backup location: $BACKUP_DIR"
