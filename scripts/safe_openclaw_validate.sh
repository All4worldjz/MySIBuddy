#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/lib_openclaw_guardrails.sh"

CANDIDATE="${1:-}"
[[ -n "$CANDIDATE" ]] || die "usage: $0 /path/to/candidate.json"

require_file "$CANDIDATE"
json_pretty_check "$CANDIDATE"
validate_config_python "$CANDIDATE"
log "validated candidate: $CANDIDATE"
