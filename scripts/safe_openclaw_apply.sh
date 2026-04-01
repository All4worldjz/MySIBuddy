#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/lib_openclaw_guardrails.sh"

CANDIDATE="${1:-}"
[[ -n "$CANDIDATE" ]] || die "usage: $0 /path/to/candidate.json"
require_file "$CANDIDATE"

"$SCRIPT_DIR/safe_openclaw_validate.sh" "$CANDIDATE"

TS="$(date +%Y%m%d-%H%M%S)"
BACKUP="$OPENCLAW_ROOT/openclaw.json.pre-apply-$TS"
cp "$OPENCLAW_CONFIG" "$BACKUP"
log "backup created: $BACKUP"

cp "$CANDIDATE" "$OPENCLAW_CONFIG"
if systemctl --user restart "$OPENCLAW_SERVICE"; then
  sleep 4
else
  log "restart failed, rolling back"
  "$SCRIPT_DIR/safe_openclaw_rollback.sh" "$BACKUP"
  exit 1
fi

if ! "$SCRIPT_DIR/safe_openclaw_smoke.sh"; then
  log "smoke failed, rolling back"
  "$SCRIPT_DIR/safe_openclaw_rollback.sh" "$BACKUP"
  exit 1
fi

log "apply succeeded"
