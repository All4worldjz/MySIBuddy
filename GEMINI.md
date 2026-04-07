# GEMINI.md - Project Context & Instructions

This file provides foundational mandates and operational context for Gemini CLI when working in the `MySiBuddy` repository.

## Project Overview

`MySiBuddy` is a **control plane repository** for deploying, hardening, and operating a production OpenClaw-based personal agent system. This is **not** an application source repository, but a management hub for configurations, backups, and guardrail-protected deployments.

- **Primary System:** OpenClaw `2026.4.5`
- **Remote Host:** `admin@47.82.234.46`
- **Operating Environment:** Remote Linux server (managed via SSH/Rsync from this local repo), Docker Engine `v28.2.2` installed.
- **Core Technology:** OpenClaw, Node.js (`24.13.0`), Shell Scripts, Python, Docker (for sandboxing).

## Architecture: The 8-Agent Cluster

The system operates as a coordinated cluster of 8 agents:

| Agent | Role | Input Channels |
|-------|------|----------------|
| `chief-of-staff` | Orchestrator / Global Visibility | Telegram (chief) |
| `work-hub` | Professional / Work Tasks | Feishu (work) |
| `venture-hub` | Entrepreneurship / Projects | Telegram (personal group) |
| `life-hub` | Personal / Daily Life | Telegram (personal) |
| `product-studio` | Product Design / Strategy | Internal Only |
| `zh-scribe` | Chinese Content Writing | Feishu (scribe) |
| `tech-mentor` | AI & Technical Guidance | Telegram (mentor) |
| `coder-hub` | Programming & CLI Assistant | Local (Gemini/Qwen CLI) |

### Security Model (2026-04-07 Milestone)
- **Containerized Sandboxing:** 6 Hub Agents (`work`, `venture`, `life`, `product`, `zh-scribe`, `tech-mentor`) run with `sandbox.mode = "all"` using Docker containers to prevent host penetration.
- **System Privileges:** `chief-of-staff` and `coder-hub` operate with `sandbox.mode = "off"` to maintain system-level management and development capabilities.
- **Tool Isolation:** Strict tool-level containment; non-Feishu agents are denied Feishu API access.

## Operational Mandates (High Priority)

### 1. Guardrail-First Deployment
**NEVER** modify the remote `openclaw.json` directly. All configuration changes MUST flow through the guardrail scripts in `scripts/`:

1.  **Validate:** `scripts/safe_openclaw_validate.sh <candidate_json>`
2.  **Apply:** `scripts/safe_openclaw_apply.sh <candidate_json>` (Handles backup -> validation -> restart -> smoke test -> auto-rollback).
3.  **Smoke Test:** `scripts/safe_openclaw_smoke.sh`
4.  **Rollback:** `scripts/safe_openclaw_rollback.sh <backup_path>`

### 2. Execution Workflow
For any operational task (Directives):
1.  **Diagnosis:** Perform read-only checks on the remote runtime (`openclaw status --deep`).
2.  **Backup:** Ensure a local/remote backup exists before proposing changes.
3.  **Validation:** Run the local validation script against any proposed JSON.
4.  **Verification:** Confirm success via real inbound message routing if possible.

### 3. SSH Execution Pattern
Most commands are executed on the remote server via SSH:
```bash
ssh admin@47.82.234.46 'openclaw status --deep'
```

## Key Commands & Scripts

| Command | Purpose |
|---------|---------|
| `./scripts/backup_openclaw_config.sh --all` | Backup remote configs, memories, and system files to `docs/`. |
| `openclaw status --deep` | (Remote) Full health check of agents, channels, and bindings. |
| `openclaw restart` | (Remote) Restart the gateway to apply changes. |

## Development Conventions

- **Branching:** `main` (stable), `dev` (active development).
- **Documentation:** Maintain `AGENTS.md` and `session_handoff.md` with every major change.
- **JSON Safety:** The `lib_openclaw_guardrails.sh` script contains strict topology checks (enforcing exactly 7 agents, specific plugins, and no top-level Feishu credentials).
- **Secrets:** Never store credentials in the repository. Use `lark.secrets.json` or environment variables on the remote host.

## Essential Reference Files

- `README.md`: High-level overview and environment details.
- `AGENTS.md`: Repository-level operating rules for AI agents.
- `docs/troubleshooting_docker_sandbox.md`: Resolution guide for Docker socket permission issues.
- `CLAUDE.md` / `QWEN.md`: Context for other AI assistants.
- `codex_handsoff.md`: The authoritative guide for system reconstruction.
- `skills/`: Specialized runbooks for channel recovery and backups.
