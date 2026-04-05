# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MySiBuddy is a **control plane repository** for deploying, hardening, and operating an OpenClaw-based personal agent system hosted on a remote Linux server. It is **not** an application source repository.

The production system runs OpenClaw `2026.4.2` on host `admin@47.82.234.46`.

## Architecture

**7-Agent Cluster:**
- `chief-of-staff`: Orchestrator with global session visibility, admin privileges, search delegation
- `work-hub`, `venture-hub`, `life-hub`, `product-studio`, `zh-scribe`, `tech-mentor`: Domain-specific sandboxed workers

**Tiered Security:**
- `chief-of-staff`: `sandbox.mode = off`, full tool access
- Hub agents: `sandbox.mode = all`, `tools.fs.workspaceOnly = true`

**Channels:**
- Telegram accounts: `chief`, `personal`, `mentor`
- Feishu accounts: `work`, `scribe` (via `openclaw-lark` plugin)
- Weixin: one account

**Model Routing:**
- Primary provider: Google Gemini (multi-key failover via `google:primary`, `google:secondary`, `google:tertiary`)
- Fallback: MiniMax
- `zh-scribe` primary is `minimax/MiniMax-M2.7`

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

The guardrails enforce:
- Exact 7-agent topology
- `plugins.allow = ["openclaw-lark", "telegram", "duckduckgo", "openclaw-weixin", "minimax", "unified-search"]`
- `plugins.deny = ["feishu"]`
- No top-level `channels.feishu.appId/appSecret`
- No `channels.feishu.accounts.default`
- 7 bindings

## Remote Execution Pattern

Most operational commands run via SSH:
```bash
ssh -o BatchMode=yes admin@47.82.234.46 'openclaw status --deep'
```

## Safety Rules

1. **Always back up before edits** - use timestamped backups
2. **Never trust config reads alone** - validate with real inbound messages
3. **Do not run `openclaw doctor --fix` automatically**
4. **Rollback-first on clobber signals**: if you see `Unknown channel`, `Outbound not configured`, empty `channels`/`bindings`, or `plugins.allow = null`, restore from backup before debugging
5. **Bindings in config, not prompts** - account-to-agent routing must live in top-level `bindings`

## Key Documentation Files

- `codex_handsoff.md`: Authoritative deployment handoff for rebuilding the system
- `AGENTS.md`: Repository-level operating rules for AI agents
- `skills/openclaw-plugin-channel-recovery/SKILL.md`: Full deployment and recovery runbook
- `GEMINI.md`: Gemini model configuration and multi-key auth design

## Subproject: gemini-proxy

OpenAI-compatible proxy for Google Gemini via OAuth authentication. Runs on port `8787`.

Key commands:
```bash
cd gemini-proxy && npm install      # Install dependencies
npm start                           # Start proxy
curl http://127.0.0.1:8787/health   # Health check
```

## Definition of Done

A task is complete only when:
1. `openclaw status --deep` healthy
2. Target channels/accounts are `ON/OK`
3. Direct agent invocation succeeds with intended model/provider
4. Real inbound messages route to intended session keys
5. Documentation reflects verified behavior