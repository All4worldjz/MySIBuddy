# MySiBuddy

`MySiBuddy` is a local repo for deploying, hardening, and operating the current OpenClaw-based personal agent system.

## Branch Strategy

- `main`: stable baseline for setup and verified changes
- `dev`: active development branch

## Project Structure

- `codex_handsoff.md`: single handoff document for rebuilding the current production system in a new environment
- `config/openclaw/`: OpenClaw config templates
- `skills/`: reusable Codex skills for deployment, tuning, and recovery
- `scripts/`: bootstrap and validation scripts

## Recommended Entry Points

- Start with [`codex_handsoff.md`](codex_handsoff.md) when asking Codex to rebuild or migrate the current system onto a fresh host.
- Use [`skills/openclaw-plugin-channel-recovery/SKILL.md`](skills/openclaw-plugin-channel-recovery/SKILL.md) when asking Codex to deploy, harden, tune, or troubleshoot OpenClaw.
- Use [`config/openclaw/openclaw.example.json`](config/openclaw/openclaw.example.json) only as a template artifact, not as the full production truth.
- Both the handoff and the skill now include the Feishu multi-account duplicate-app pitfall: do not keep the same old Feishu app both at top-level `channels.feishu.*` and under `channels.feishu.accounts.work`, and do not keep `channels.feishu.accounts.default` in multi-account mode unless it is a real separate app.
- Both the handoff and the skill now also document the Gemini multi-key auth design: multiple Gemini API keys are implemented as ordered `google` auth profiles such as `google:primary`, `google:secondary`, and `google:tertiary`, with provider-level failover before model fallback.

## Git

This repository is initialized with `main` and `dev` branches.

## Operational Docs

- [`codex_handsoff.md`](codex_handsoff.md): authoritative deployment handoff for reproducing the full current OpenClaw topology, routing, auth artifacts, bot bindings, and validation flow on a new environment
  Includes the Gemini multi-key design, `auth.order.google` pattern, secret injection flow, and verification rules.

## Reusable Skills

- [`skills/openclaw-plugin-channel-recovery/SKILL.md`](skills/openclaw-plugin-channel-recovery/SKILL.md): unified Codex runbook for OpenClaw deployment, plugin and channel policy, multi-agent routing, new-agent auth fixes, Feishu duplicate-account recovery, and production troubleshooting
  Includes the Gemini multi-key provider-auth rule, operational meaning, and fast triage guidance.
