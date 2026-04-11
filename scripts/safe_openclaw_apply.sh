#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/lib_openclaw_guardrails.sh"

CANDIDATE="${1:-}"
[[ -n "$CANDIDATE" ]] || die "usage: $0 /path/to/candidate.json"
require_file "$CANDIDATE"

"$SCRIPT_DIR/safe_openclaw_validate.sh" "$CANDIDATE"

# Pre-flight: abort if any tasks are still running to avoid truncating in-flight DB writes
TASKS_DB="${OPENCLAW_ROOT}/tasks/runs.sqlite"
RUNNING_TASKS="$(sqlite3 "$TASKS_DB" "SELECT COUNT(*) FROM task_runs WHERE status='running'" 2>/dev/null || echo 0)"
if [[ "$RUNNING_TASKS" -gt 0 ]]; then
  log "WARNING: $RUNNING_TASKS task(s) still running. Waiting up to 60s for them to finish..."
  for i in $(seq 1 6); do
    sleep 10
    RUNNING_TASKS="$(sqlite3 "$TASKS_DB" "SELECT COUNT(*) FROM task_runs WHERE status='running'" 2>/dev/null || echo 0)"
    [[ "$RUNNING_TASKS" -eq 0 ]] && break
    log "  still waiting... ($RUNNING_TASKS running, attempt $i/6)"
  done
  if [[ "$RUNNING_TASKS" -gt 0 ]]; then
    log "Tasks still running after 60s. To force apply, cancel them first:"
    sqlite3 "$TASKS_DB" "SELECT task_id, agent_id FROM task_runs WHERE status='running'" 2>/dev/null
    die "Aborting apply: running tasks detected after wait (risk of stale_running + inconsistent_timestamps)"
  fi
  log "All tasks finished. Proceeding with apply."
fi

TS="$(date +%Y%m%d-%H%M%S)"
BACKUP="$OPENCLAW_ROOT/openclaw.json.pre-apply-$TS"
cp "$OPENCLAW_CONFIG" "$BACKUP"
log "backup created: $BACKUP"

cp "$CANDIDATE" "$OPENCLAW_CONFIG"
if systemctl --user restart "$OPENCLAW_SERVICE"; then
  sleep 20
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
