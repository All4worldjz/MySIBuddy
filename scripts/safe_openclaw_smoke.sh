#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/lib_openclaw_guardrails.sh"

STATUS_FILE="$(mktemp)"
LOG_FILE="$(mktemp)"
trap 'rm -f "$STATUS_FILE" "$LOG_FILE"' EXIT

openclaw status --deep >"$STATUS_FILE"
systemctl --user status "$OPENCLAW_SERVICE" --no-pager >/dev/null
ACTIVE_SINCE="$(systemctl --user show -p ActiveEnterTimestamp --value "$OPENCLAW_SERVICE")"
[[ -n "$ACTIVE_SINCE" ]] || die "failed to read service start time"
journalctl --user -u "$OPENCLAW_SERVICE" --since "$ACTIVE_SINCE" --no-pager >"$LOG_FILE"

grep -q 'Telegram │ ON      │ OK' "$STATUS_FILE" || die "telegram is not ON/OK"
grep -q 'Feishu   │ ON      │ OK' "$STATUS_FILE" || die "feishu is not ON/OK"
grep -q 'Agents               │ 7 ' "$STATUS_FILE" || die "agent count is not 7"

for needle in \
  'Unknown channel' \
  'Outbound not configured' \
  'plugins.allow is empty' \
  'Config write anomaly' \
  'Config observe anomaly'
do
  if grep -q "$needle" "$LOG_FILE"; then
    die "recent log contains forbidden signal: $needle"
  fi
done

log "smoke passed"
