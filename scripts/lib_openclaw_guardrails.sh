#!/usr/bin/env bash
set -euo pipefail

OPENCLAW_ROOT="${OPENCLAW_ROOT:-/home/admin/.openclaw}"
OPENCLAW_CONFIG="${OPENCLAW_CONFIG:-$OPENCLAW_ROOT/openclaw.json}"
OPENCLAW_SERVICE="${OPENCLAW_SERVICE:-openclaw-gateway}"
EXPECTED_AGENTS=(
  "chief-of-staff"
  "work-hub"
  "venture-hub"
  "life-hub"
  "product-studio"
  "zh-scribe"
  "tech-mentor"
)
EXPECTED_TELEGRAM_ACCOUNTS=("chief" "personal" "mentor")
EXPECTED_FEISHU_ACCOUNTS=("work" "scribe")
EXPECTED_PLUGIN_ALLOW=("openclaw-lark" "telegram")
EXPECTED_PLUGIN_DENY=("feishu")

log() {
  printf '[guardrail] %s\n' "$*"
}

die() {
  printf '[guardrail] ERROR: %s\n' "$*" >&2
  exit 1
}

require_file() {
  local path="$1"
  [[ -f "$path" ]] || die "missing file: $path"
}

json_pretty_check() {
  local path="$1"
  python3 -m json.tool "$path" >/dev/null
}

validate_config_python() {
  local path="$1"
  python3 - "$path" <<'PY'
import json
import sys

path = sys.argv[1]
d = json.load(open(path))
errors = []

expected_agents = [
    "chief-of-staff",
    "work-hub",
    "venture-hub",
    "life-hub",
    "product-studio",
    "zh-scribe",
    "tech-mentor",
]
expected_telegram = ["chief", "personal", "mentor"]
expected_feishu = ["work", "scribe"]
expected_allow = ["openclaw-lark", "telegram", "duckduckgo"]
expected_deny = ["feishu"]

agents = [a.get("id") for a in d.get("agents", {}).get("list", [])]
if agents != expected_agents:
    errors.append(f"agents.list mismatch: {agents}")

plugins = d.get("plugins", {})
if plugins.get("allow") != expected_allow:
    errors.append(f"plugins.allow mismatch: {plugins.get('allow')}")
if plugins.get("deny") != expected_deny:
    errors.append(f"plugins.deny mismatch: {plugins.get('deny')}")

channels = d.get("channels", {})
if sorted(channels.keys()) != ["feishu", "telegram"]:
    errors.append(f"channels mismatch: {list(channels.keys())}")

telegram_accounts = list(channels.get("telegram", {}).get("accounts", {}).keys())
if telegram_accounts != expected_telegram:
    errors.append(f"telegram accounts mismatch: {telegram_accounts}")

feishu = channels.get("feishu", {})
feishu_accounts = list(feishu.get("accounts", {}).keys())
if feishu_accounts != expected_feishu:
    errors.append(f"feishu accounts mismatch: {feishu_accounts}")
if "appId" in feishu or "appSecret" in feishu:
    errors.append("top-level channels.feishu.appId/appSecret must not exist")
if "default" in feishu.get("accounts", {}):
    errors.append("channels.feishu.accounts.default must not exist")

bindings = d.get("bindings", [])
if len(bindings) != 7:
    errors.append(f"bindings count mismatch: {len(bindings)}")

tools = d.get("tools", {})
if tools.get("profile") != "full":
    errors.append(f"tools.profile mismatch: {tools.get('profile')}")
if tools.get("sessions", {}).get("visibility") != "all":
    errors.append(f"tools.sessions.visibility mismatch: {tools.get('sessions', {}).get('visibility')}")

agent_to_agent = tools.get("agentToAgent", {})
if agent_to_agent.get("enabled") is not True:
    errors.append("tools.agentToAgent.enabled must be true")
allow = agent_to_agent.get("allow", [])
if sorted(allow) != sorted(expected_agents):
    errors.append(f"tools.agentToAgent.allow mismatch: {allow}")

chief = None
for agent in d.get("agents", {}).get("list", []):
    if agent.get("id") == "chief-of-staff":
        chief = agent
        break
if not chief:
    errors.append("chief-of-staff missing")
else:
    allowed = chief.get("subagents", {}).get("allowAgents", [])
    required = ["work-hub", "venture-hub", "life-hub", "product-studio", "zh-scribe", "tech-mentor"]
    missing = [x for x in required if x not in allowed]
    if missing:
        errors.append(f"chief-of-staff.subagents.allowAgents missing: {missing}")

for needle in ("*** Begin Patch", "description:"):
    raw = open(path, "r", encoding="utf-8").read()
    if needle in raw:
        errors.append(f"dangerous non-config content present: {needle}")

if errors:
    for item in errors:
        print(f"FAIL {item}")
    sys.exit(1)

print("PASS config topology validated")
PY
}

latest_backup() {
  local pattern="${1:-$OPENCLAW_ROOT/openclaw.json.pre-*}"
  ls -1t $pattern 2>/dev/null | head -n 1
}
