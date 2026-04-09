#!/usr/bin/env bash
set -euo pipefail

OPENCLAW_ROOT="${OPENCLAW_ROOT:-/home/admin/.openclaw}"
OPENCLAW_CONFIG="${OPENCLAW_CONFIG:-$OPENCLAW_ROOT/openclaw.json}"
OPENCLAW_SERVICE="${OPENCLAW_SERVICE:-openclaw-gateway}"

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

expected_agents = ["chief-of-staff", "coder-hub", "life-hub", "product-studio", "tech-mentor", "venture-hub", "work-hub", "zh-scribe"]
expected_telegram = ["chief", "mentor", "personal"]
expected_feishu = ["scribe", "work"]
expected_allow = ["duckduckgo", "memory-wiki", "minimax", "openai", "openclaw-lark", "qwen", "telegram"]
expected_deny = ["feishu"]

agents = [a.get("id") for a in d.get("agents", {}).get("list", [])]
if sorted(agents) != sorted(expected_agents):
    errors.append(f"agents.list mismatch: {agents}")

plugins = d.get("plugins", {})
if sorted(plugins.get("allow", [])) != sorted(expected_allow):
    errors.append(f"plugins.allow mismatch: {plugins.get('allow')}")
if sorted(plugins.get("deny", [])) != sorted(expected_deny):
    errors.append(f"plugins.deny mismatch: {plugins.get('deny')}")

channels = d.get("channels", {})
if sorted(channels.keys()) != ["feishu", "telegram"]:
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
if len(bindings) != 7:
    errors.append(f"bindings count mismatch: {len(bindings)}")

tools = d.get("tools", {})
if tools.get("profile") != "full":
    errors.append(f"tools.profile mismatch: {tools.get('profile')}")

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
    required = ["coder-hub", "life-hub", "product-studio", "tech-mentor", "venture-hub", "work-hub", "zh-scribe"]
    missing = [x for x in required if x not in allowed]
    if missing:
        errors.append(f"chief-of-staff.subagents.allowAgents missing: {missing}")

for needle in ("*** Begin Patch", "description:"):
    raw = open(path, "r", encoding="utf-8").read()
    if needle in raw:
        errors.append(f"dangerous non-config content present: {needle}")

# Generic secret scanning (sk- patterns)
import re
raw = open(path, "r", encoding="utf-8").read()
if re.search(r'sk-[a-zA-Z0-9_-]{20,}', raw):
    errors.append("potential hardcoded API key (sk-...) detected in config")
if re.search(r'w7FyvZTSBB8nT5EUSbxB4GiG56J-7n58XjA5M5Z3nec', raw):
    errors.append("potential hardcoded device token detected in config")

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
