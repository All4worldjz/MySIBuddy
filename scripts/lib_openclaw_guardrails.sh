#!/usr/bin/env bash
set -euo pipefail

OPENCLAW_ROOT="${OPENCLAW_ROOT:-/home/admin/.openclaw}"
OPENCLAW_CONFIG="${OPENCLAW_CONFIG:-$OPENCLAW_ROOT/openclaw.json}"
OPENCLAW_SERVICE="${OPENCLAW_SERVICE:-openclaw-gateway}"
EXPECTED_AGENTS=("chief-of-staff" "work-hub" "venture-hub" "life-hub" "product-studio" "zh-scribe" "tech-mentor" "devcopilot-hub")
EXPECTED_TELEGRAM_ACCOUNTS=("chief" "mentor" "personal")
EXPECTED_FEISHU_ACCOUNTS=("scribe" "work")
EXPECTED_PLUGIN_ALLOW=("acpx" "browser" "duckduckgo" "exa" "kimi" "minimax" "openai" "openclaw-lark" "openclaw-weixin" "openshell" "tavily" "telegram" "unified-search")
EXPECTED_PLUGIN_DENY=()

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

expected_agents = ["chief-of-staff", "devcopilot-hub", "life-hub", "product-studio", "tech-mentor", "venture-hub", "work-hub", "zh-scribe"]
expected_telegram = ["chief", "mentor", "personal"]
expected_feishu = ["scribe", "work"]
expected_allow = ["acpx", "browser", "duckduckgo", "exa", "kimi", "minimax", "openai", "openclaw-lark", "openclaw-weixin", "openshell", "tavily", "telegram", "unified-search"]
expected_deny = []

agents = [a.get("id") for a in d.get("agents", {}).get("list", [])]
if sorted(agents) != sorted(expected_agents):
    errors.append(f"agents.list mismatch: {agents}")

plugins = d.get("plugins", {})
if sorted(plugins.get("allow", [])) != sorted(expected_allow):
    errors.append(f"plugins.allow mismatch: {plugins.get('allow')}")
if plugins.get("deny") != expected_deny:
    errors.append(f"plugins.deny mismatch: {plugins.get('deny')}")

channels = d.get("channels", {})
if sorted(channels.keys()) != ["feishu", "openclaw-weixin", "telegram"]:
    errors.append(f"channels mismatch: {list(channels.keys())}")

telegram_accounts = list(channels.get("telegram", {}).get("accounts", {}).keys())
if sorted(telegram_accounts) != sorted(expected_telegram):
    errors.append(f"telegram accounts mismatch: {telegram_accounts}")

feishu = channels.get("feishu", {})
feishu_accounts = list(feishu.get("accounts", {}).keys())
if sorted(feishu_accounts) != sorted(expected_feishu):
    errors.append(f"feishu accounts mismatch: {feishu_accounts}")
if "appId" in feishu or "appSecret" in feishu:
    errors.append("top-level channels.feishu.appId/appSecret must not exist")
if "default" in feishu.get("accounts", {}):
    errors.append("channels.feishu.accounts.default must not exist")

bindings = d.get("bindings", [])
if len(bindings) != 8:
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
    required = ["work-hub", "venture-hub", "life-hub", "product-studio", "zh-scribe", "tech-mentor", "devcopilot-hub"]
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
