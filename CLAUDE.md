# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MySiBuddy is a **control plane repository** for deploying, hardening, and operating an OpenClaw-based personal agent system hosted on a remote Linux server. It is **not** an application source repository.

The production system runs OpenClaw `2026.4.8` on host `admin@47.82.234.46`.

## Architecture

**8-Agent Cluster:**
| Agent | Alias | Role | Channel | Exec |
|-------|-------|------|---------|------|
| `neo` | Neo (Matrix) | Orchestrator + Guardian | Telegram `chief` | ✅ |
| `link` | Link (Matrix) | IT Ops + Engineer | Telegram/Feishu `sysop` | ✅ |
| `trinity` | Trinity (Matrix) | Daily Ops | Feishu `work` | ❌ |
| `morpheus` | Morpheus (Matrix) | Capital Architect | Telegram `personal` | ❌ |
| `oracle` | Oracle (Matrix) | Learning + R&D + Wisdom | Telegram `mentor` | ❌ |
| `smith` | Smith (blended) | Challenger | Internal only | ❌ |
| `architect` | Architect (Matrix) | Strategist | Internal only | ❌ |
| `theodore` | Theodore Twombly (Her) | Keeper | Feishu `scribe` | ❌ |

**Legacy → New Agent Mapping:**
- `chief-of-staff` → `neo`
- `coder-hub` + `sysop` → `link`
- `work-hub` → `trinity`
- `venture-hub` → `morpheus`
- `tech-mentor` + `life-hub` → `oracle`
- `product-studio` → `architect`
- `zh-scribe` → `theodore`
- *(new)* → `smith`

**Security Model (2026-04-07):**
- All agents: `sandbox.mode = "off"` (removed container sandbox)
- Tool permission control: Only `neo` and `link` have `exec` permission
- Other 6 agents: `tools.deny = ["exec", "process"]`
- Reason: OpenClaw prevents sandboxed agents from spawning unsandboxed subagents

**Channels:**
- Telegram accounts: `chief`, `personal`, `mentor`
- Feishu accounts: `work`, `scribe` (via `openclaw-lark` plugin)
- Weixin: one account

**Model Routing:**
- Primary provider: MiniMax (`minimax/MiniMax-M2.7`)
- Fallback: Alibaba Cloud ModelStudio (`modelstudio/qwen3.5-plus`, `modelstudio/kimi-k2.5`)
- **Note**: Google Gemini is NOT configured

## Production Commands

All production config changes **must** use the guardrail scripts. Never use raw file replacement or UI-driven `config.apply`.

**On the remote host:**
```bash
# Validate a candidate config (enforces topology, plugin policy, bindings)
scripts/safe_openclaw_validate.sh /tmp/openclaw.candidate.json

# Apply config with backup, restart, smoke test, and auto-rollback
scripts/safe_openclaw_apply.sh /tmp/openclaw.candidate.json

# Quick health check for channels and fatal log signals
scripts/safe_openclaw_smoke.sh

# Restore from backup
scripts/safe_openclaw_rollback.sh /home/admin/.openclaw/openclaw.json.pre-apply-YYYYmmdd-HHMMSS

# Check system status
openclaw status --deep
```

**Configuration backup:**
```bash
# Backup all (config + memory + system files) to local docs/
./scripts/backup_openclaw_config.sh --all

# Preview mode
./scripts/backup_openclaw_config.sh --dry-run --all
```

**Feishu Drive operations:**
```bash
# Create folder (with duplicate detection, audit logging)
scripts/feishu_create_folder.sh "Folder Name" "<parent_token>"

# Delete folder (soft delete to recycle bin, --dry-run available)
scripts/feishu_delete_folder.sh --token <folder_token> --dry-run

# Move folder (with duplicate detection, protected folder checks)
scripts/feishu_move_folder.sh --token <folder_token> --dest <dest_token> --dry-run
```

The guardrails enforce:
- Exact 8-agent topology
- `plugins.allow = ["openclaw-lark", "telegram", "duckduckgo", "openclaw-weixin", "minimax", "openai", "qwen"]`
- `plugins.deny = ["feishu"]`
- No top-level `channels.feishu.appId/appSecret`
- No `channels.feishu.accounts.default`
- 7 bindings

**Protected Feishu Drive folders:**
- `CC 文件柜` (`RfSrf8oMYlMyQTdbW0ZcGSE1nNb`) - CC 个人文件柜 (protected)
- `小春文件柜` (`Xl7tfFnwQl9n6vd8Hl5c8Vy2nBd`) - 共享工作目录 (protected)
- `回收站` (`XcTHfLy7clpx51dBomLcvA7XnTf`) - soft delete target (30-day auto-cleanup)
- `📁测试归档` (`TZa9f0KaQldDPXdDnX6cF3K7nme`) - test archive folder

## Remote Execution Pattern

Most operational commands run via SSH:
```bash
ssh -o BatchMode=yes admin@47.82.234.46 'openclaw status --deep'
```

## Known Pitfalls

**Config clobber (2026-04-01):**
- `config.apply` once overwrote `openclaw.json` with incomplete object
- Result: `channels = []`, `bindings = 0`, all bots stopped responding
- Recovery: Restore from `openclaw.json.pre-*` backup, restart gateway

**Feishu duplicate accounts:**
- Same Feishu app in both top-level `channels.feishu.*` and `accounts.work` causes intermittent message loss
- Fix: Remove top-level `appId/appSecret`, keep only explicit real accounts

**Sandbox spawn limitation (2026-04-07):**
- Hard constraint: sandboxed agent cannot spawn unsandboxed subagent
- Error: `Sandboxed sessions cannot spawn unsandboxed subagents`
- Solution: All agents `sandbox.mode = "off"`, control via `tools.deny`

**SecretRef format:**
- `id` must be absolute JSON pointer with leading `/`
- Wrong: `"id": "API_KEY"` → Right: `"id": "/API_KEY"`

**Missing auth files:**
- New agent without `auth-profiles.json` and `models.json` causes all models to fail auth
- Fix: Copy from existing agent (e.g., `neo` or another established agent)

## Safety Rules

1. **Always back up before edits** - use timestamped backups
2. **Never trust config reads alone** - validate with real inbound messages
3. **Do not run `openclaw doctor --fix` automatically**
4. **Rollback-first on clobber signals**: if you see `Unknown channel`, `Outbound not configured`, empty `channels`/`bindings`, or `plugins.allow = null`, restore from backup before debugging
5. **Bindings in config, not prompts** - account-to-agent routing must live in top-level `bindings`
6. **Default: do not push to `origin`** - unless user explicitly asks
7. **New agent directories must include** `auth-profiles.json` and `models.json`

## Secret Management

**Two-layer architecture:**
- `gateway.env`: Startup-time environment variables (required for systemd)
- `runtime-secrets.json`: Runtime SecretRef resolution

**Commands:**
```bash
# Audit secret configuration
ssh admin@47.82.234.46 'openclaw secrets audit'

# Reload secrets
ssh admin@47.82.234.46 'openclaw secrets reload'

# Check for plaintext key leaks
ssh admin@47.82.234.46 'grep -r "sk-cp-\|sk-sp-\|AAG\|AIza" /home/admin/.openclaw/ --include="*.json" --exclude-dir=backup'

# Gateway service management
ssh admin@47.82.234.46 'systemctl --user restart openclaw-gateway'
ssh admin@47.82.234.46 'journalctl --user -u openclaw-gateway -n 30 --no-pager'
```

**Critical:** SecretRef `id` fields must use absolute JSON pointer format with leading `/`:
- Wrong: `"id": "OPENCLAW_GATEWAY_TOKEN"`
- Correct: `"id": "/OPENCLAW_GATEWAY_TOKEN"`

## Key Documentation Files

- `codex_handsoff.md`: Authoritative deployment handoff for rebuilding the system
- `AGENTS.md`: Repository-level operating rules for AI agents
- `QWEN.md`: Project overview, architecture, and operational constraints (Chinese)
- `session_handoff.md`: Production changelog and current state
- `founding-docs/execution-log.md`: Migration execution log (2026-04-11)
- `founding-docs/design-docs/`: Agent system design documents
- `skills/openclaw-plugin-channel-recovery/SKILL.md`: Full deployment and recovery runbook
- `skills/backup-openclaw/SKILL.md`: Configuration backup skill
- `docs/troubleshooting_sandbox_spawn.md`: Sandbox spawn limitation and workaround
- `docs/troubleshooting-feishu-drive-api.md`: Feishu Drive API endpoint differences

## Definition of Done

A task is complete only when:
1. `openclaw status --deep` healthy
2. Target channels/accounts are `ON/OK`
3. Direct agent invocation succeeds with intended model/provider
4. Real inbound messages route to intended session keys
5. Documentation reflects verified behavior