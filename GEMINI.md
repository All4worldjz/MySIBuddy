# GEMINI.md - Project Context & Instructions

This repository, `MySiBuddy`, is a specialized operational environment for deploying, hardening, and maintaining an **OpenClaw-based** personal agent system. It is not an application source repo but a "Control Plane" for a production agent topology.

## 🎯 Project Overview

The project manages a 7-agent OpenClaw cluster (including `chief-of-staff`, `work-hub`, etc.) hosted on a remote Linux server. It emphasizes **Configuration Guardrails**, **Multi-Model Routing** (Gemini & MiniMax), and **Secure Channel Integration** (Telegram & Feishu).

### Core Architecture
- **Orchestrator**: `chief-of-staff` acts as the central hub with global session visibility.
- **Specialized Hubs**: Domain-specific agents (`work`, `life`, `venture`, `product`, `tech`, `scribe`) handle targeted tasks.
- **Channels**: Multi-account support for Telegram bots and Feishu (via `openclaw-lark`).
- **Safety**: A custom bash-based guardrail system ensures configuration integrity.

## 🛠 Building and Running (Operational Lifecycle)

There is no "build" step. Instead, the project follows a strict **Research -> Strategy -> Execution** lifecycle using specific guardrail scripts.

### Key Commands (Production Only)
All production changes **MUST** use these scripts found in `scripts/`:

- **Validate Config**: `scripts/safe_openclaw_validate.sh <path_to_json>`
  - Checks JSON syntax and enforces the mandatory 7-agent topology and plugin allowlist.
- **Apply Config**: `scripts/safe_openclaw_apply.sh <path_to_json>`
  - Performs: Backup -> Validate -> Restart Service -> Smoke Test -> Auto-rollback on failure.
- **Smoke Test**: `scripts/safe_openclaw_smoke.sh`
  - Verifies channel connectivity (Telegram/Feishu) and scans logs for "Forbidden Signals" (e.g., `Unknown channel`).
- **Rollback**: `scripts/safe_openclaw_rollback.sh <backup_file>`
  - Restores a known-good configuration and re-verifies system health.

### Remote Execution Pattern
Most commands are executed via SSH on the production host `admin@47.82.234.46`.
```bash
ssh -o BatchMode=yes admin@47.82.234.46 'openclaw status --deep'
```

## 📜 Development & Operational Conventions

### 1. The "Golden" Configuration (`openclaw.json`)
- **Plugin Policy**: Strictly enforces `plugins.allow = ["openclaw-lark", "telegram", "duckduckgo"]` and `plugins.deny = ["feishu"]`.
- **Routing**: Account-to-agent routing must live in top-level `bindings`, not in agent prompt text.
- **Session Management**: `idleHours` is set to `8` to prevent excessive token consumption in long-running threads.

### 2. Multi-Key & Provider Design
- Uses provider-level auth profiles (e.g., `google:primary`, `google:secondary`).
- Failover order is defined in `auth.order`. Gemini is the primary provider; MiniMax is the fallback.

### 3. Safety & Sandbox Rules
- High-risk agents (e.g., `venture-hub` performing `web_fetch`) **MUST** run with `sandbox.mode: "all"`.
- Never use `openclaw doctor --fix` automatically in production.

### 4. Administrative Privilege (Least Privilege)
- **Restricted Access**: System health checks (`sys_status`), log audits (`sys_recent_logs`), and smoke tests (`sys_smoke_test`) are strictly reserved for the **`chief-of-staff`** agent.
- **Implementation**: These tools are encapsulated in the `system-admin` skill and must NOT be authorized for any other agent.
- **Goal**: Minimize the attack surface by ensuring that domain-specific agents (Hubs) cannot access system-wide metadata.

### 5. Mandatory Documentation
- **`codex_handsoff.md`**: The authoritative source of truth for rebuilding the system.
- **`AGENTS.md`**: Strict operating rules for AI agents (Codex/Gemini) working in this repo.
- **`session_handoff.md`**: Chronological log of production changes and current status.

## 📂 Key Files Summary

- `scripts/lib_openclaw_guardrails.sh`: Central logic for the guardrail system (shared by all `safe_*` scripts).
- `skills/openclaw-plugin-channel-recovery/SKILL.md`: Comprehensive runbook for troubleshooting and deployment.
- `.github/commands/gemini-invoke.toml`: Configuration for Gemini CLI integration within GitHub Actions.

## 🤖 AI Agent Instructions

When acting as an agent in this repository:
1. **Always Read First**: Consult `session_handoff.md` and `codex_handsoff.md` before any action.
2. **Backup Before Edits**: Never modify remote configs without a timestamped local backup.
3. **Use Guardrails**: Do not manually replace `openclaw.json`. Use `safe_openclaw_apply.sh`.
4. **Validation is Final**: A task is only "Done" when `safe_openclaw_smoke.sh` passes on the remote host.
