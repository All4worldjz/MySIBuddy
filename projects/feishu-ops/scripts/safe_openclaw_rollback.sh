#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/lib_openclaw_guardrails.sh"

BACKUP="${1:-}"
if [[ -z "$BACKUP" ]]; then
  BACKUP="$(latest_backup "$OPENCLAW_ROOT/openclaw.json.pre-*")"
fi

[[ -n "$BACKUP" ]] || die "no backup found"
require_file "$BACKUP"

cp "$BACKUP" "$OPENCLAW_CONFIG"
systemctl --user restart "$OPENCLAW_SERVICE"
sleep 4
"$SCRIPT_DIR/safe_openclaw_smoke.sh"
log "rolled back using $BACKUP"
