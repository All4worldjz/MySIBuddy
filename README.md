# MySiBuddy

`MySiBuddy` is a local repo for deploying, hardening, and operating the current OpenClaw-based personal agent system.

## Branch Strategy

- `main`: stable baseline for setup and verified changes
- `dev`: active development branch

## Project Structure

- `codex_handsoff.md`: single handoff document for rebuilding the current production system in a new environment
- `skills/`: reusable Codex skills for deployment, tuning, and recovery
- `AGENTS.md`: repository-level operating rules for Codex execution and human collaboration
- `scripts/`: production guardrail scripts for validating, applying, smoke-checking, and rolling back `openclaw.json`

## Recommended Entry Points

- Start with [`codex_handsoff.md`](codex_handsoff.md) when asking Codex to rebuild or migrate the current system onto a fresh host.
- Read [`AGENTS.md`](AGENTS.md) when you want Codex to follow the repo-specific operating rules for deployment, migration, backup, and human-assisted troubleshooting.
- Use [`skills/openclaw-plugin-channel-recovery/SKILL.md`](skills/openclaw-plugin-channel-recovery/SKILL.md) when asking Codex to deploy, harden, tune, or troubleshoot OpenClaw.
- Do not use legacy scaffold placeholders as production source of truth; rely on handoff + skill + remote runtime verification.
- Both the handoff and the skill now include the Feishu multi-account duplicate-app pitfall: do not keep the same old Feishu app both at top-level `channels.feishu.*` and under `channels.feishu.accounts.work`, and do not keep `channels.feishu.accounts.default` in multi-account mode unless it is a real separate app.
- Both the handoff and the skill now also document the Gemini multi-key auth design: multiple Gemini API keys are implemented as ordered `google` auth profiles such as `google:primary`, `google:secondary`, and `google:tertiary`, with provider-level failover before model fallback.
- Both the handoff and the skill now document the 2026-04-01 config clobber incident: do not use raw UI/agent `config.apply` as a production publish path; use the guardrail scripts and roll back first if `channels`/`bindings` disappear.

## Git

This repository is initialized with `main` and `dev` branches.

## Operational Docs

- [`codex_handsoff.md`](codex_handsoff.md): authoritative deployment handoff for reproducing the full current OpenClaw topology, routing, auth artifacts, bot bindings, and validation flow on a new environment
  Includes the Gemini multi-key design, `auth.order.google` pattern, secret injection flow, and verification rules.
- [`AGENTS.md`](AGENTS.md): repository-level operating rules for Codex, including change order, backup discipline, human handoff style, and completion criteria.
- [`scripts/safe_openclaw_validate.sh`](scripts/safe_openclaw_validate.sh): reject malformed or topology-breaking candidate configs before they touch production.
- [`scripts/safe_openclaw_apply.sh`](scripts/safe_openclaw_apply.sh): only supported publish path; backs up, validates, restarts, smoke-checks, and auto-rolls back on failure.
- [`scripts/safe_openclaw_smoke.sh`](scripts/safe_openclaw_smoke.sh): fast health probe for channel state and recent fatal log signals.
- [`scripts/safe_openclaw_rollback.sh`](scripts/safe_openclaw_rollback.sh): restore a known-good `openclaw.json` backup and re-run smoke validation.

## Reusable Skills

- [`skills/openclaw-plugin-channel-recovery/SKILL.md`](skills/openclaw-plugin-channel-recovery/SKILL.md): unified Codex runbook for OpenClaw deployment, plugin and channel policy, multi-agent routing, new-agent auth fixes, Feishu duplicate-account recovery, and production troubleshooting
  Includes the Gemini multi-key provider-auth rule, operational meaning, and fast triage guidance.
