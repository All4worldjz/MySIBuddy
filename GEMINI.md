# GEMINI.md - Historical Reference Document

> **⚠️ Status Notice (2026-04-06)**
>
> This document is preserved as **historical reference**. The current production system does NOT use Google Gemini as a model provider.
>
> **Current Provider Configuration:**
> - Primary: MiniMax (`minimax/MiniMax-M2.7`)
> - Fallbacks: Alibaba Cloud ModelStudio (`modelstudio/qwen3.5-plus`, `modelstudio/kimi-k2.5`, etc.)
>
> The `gemini-proxy/` subproject remains in the repository as reference code for future Gemini integration if needed.

---

## Original Context (Pre-2026-04-06)

This repository, `MySiBuddy`, is a specialized operational environment for deploying, hardening, and maintaining an **OpenClaw-based** personal agent system. It is not an application source repo but a "Control Plane" for a production agent topology.

## 🎯 Project Overview (Historical)

The project manages a 7-agent OpenClaw cluster (including `chief-of-staff`, `work-hub`, etc.) hosted on a remote Linux server. It emphasizes **Configuration Guardrails**, **Multi-Model Routing**, and **Secure Channel Integration** (Telegram & Feishu).

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
- **Plugin Policy**: Strictly enforces `plugins.deny = ["feishu"]`.
- **Routing**: Account-to-agent routing must live in top-level `bindings`, not in agent prompt text.
- **Session Management**: `idleHours` is set to `8` to prevent excessive token consumption in long-running threads.

### 2. Provider Design (Historical Reference)
- **Original Design**: Uses provider-level auth profiles (e.g., `google:primary`, `google:secondary`).
- **Failover**: Gemini was planned as primary; MiniMax as fallback.
- **Current Reality**: MiniMax + ModelStudio only.

### 3. Safety & Sandbox Rules
- Never use `openclaw doctor --fix` automatically in production.

### 4. Administrative Privilege (Least Privilege)
- **Restricted Access**: System health checks are reserved for the **`chief-of-staff`** agent.

### 5. Intelligence Delegation Protocol (Historical Reference)
- **Search Control**: The original design centralized search in `chief-of-staff`.
- **Current Note**: unified-search microservice is NOT deployed.

### 6. Mandatory Documentation
- **`codex_handsoff.md`**: The authoritative source of truth for rebuilding the system (updated 2026-04-06).
- **`AGENTS.md`**: Strict operating rules for AI agents working in this repo.
- **`session_handoff.md`**: Chronological log of production changes and current status.

## 📂 Key Files Summary

- `scripts/lib_openclaw_guardrails.sh`: Central logic for the guardrail system.
- `gemini-proxy/`: Reference code for Gemini API proxy (NOT deployed in production).

## 🤖 AI Agent Instructions

When acting as an agent in this repository:
1. **Always Read First**: Consult `codex_handsoff.md` for current production reality.
2. **Backup Before Edits**: Never modify remote configs without a timestamped local backup.
3. **Use Guardrails**: Do not manually replace `openclaw.json`. Use `safe_openclaw_apply.sh`.
4. **Validation is Final**: A task is only "Done" when smoke tests pass on the remote host.