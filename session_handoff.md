# Session Handoff

Last updated: 2026-04-01

## Current repo state

- Branch: `dev`
- Latest commit: `55ffe13`
- This commit contains:
  - OpenClaw config guardrail scripts under `scripts/`
  - doc updates for config clobber recovery and safe publish flow

## Current production state

Verified on remote host `admin@47.82.234.46` after rollback and guardrail deployment:

- `openclaw-gateway` running
- `Telegram` is `ON / OK`
- `Feishu` is `ON / OK`
- Agents are back to the expected 7:
  - `chief-of-staff`
  - `work-hub`
  - `venture-hub`
  - `life-hub`
  - `product-studio`
  - `zh-scribe`
  - `tech-mentor`
- Known accepted warning remains:
  - `plugins.entries.feishu: plugin disabled (blocked by denylist) but config is present`

## What happened in this session

1. A production outage was diagnosed.
2. Root cause was a bad `config.apply` / config overwrite via `gateway-client`.
3. Broken runtime symptoms included:
   - `channels = []`
   - `bindings = 0`
   - `plugins.allow = null`
   - unexpected extra agent `slideforge`
   - `Unknown channel: telegram`
   - `Outbound not configured for channel: telegram`
4. Production was restored by rolling back `openclaw.json` to:
   - `/home/admin/.openclaw/openclaw.json.pre-balanced-rotation-20260401-013832`
5. System-wide agent guardrail text was appended to all 7 workspaces' `AGENTS.md` and `SOUL.md`.
6. New guardrail scripts were created locally and deployed remotely to:
   - `/home/admin/.openclaw/scripts/`

## Guardrail scripts now available

Repo:

- `scripts/safe_openclaw_validate.sh`
- `scripts/safe_openclaw_apply.sh`
- `scripts/safe_openclaw_smoke.sh`
- `scripts/safe_openclaw_rollback.sh`
- `scripts/lib_openclaw_guardrails.sh`

Remote:

- `/home/admin/.openclaw/scripts/safe_openclaw_validate.sh`
- `/home/admin/.openclaw/scripts/safe_openclaw_apply.sh`
- `/home/admin/.openclaw/scripts/safe_openclaw_smoke.sh`
- `/home/admin/.openclaw/scripts/safe_openclaw_rollback.sh`

Remote backup created before script deployment:

- `/home/admin/.openclaw/scripts.pre-guardrail-20260401-211757.tgz`

## Current safe commands

Quick remote health:

```bash
ssh -o BatchMode=yes admin@47.82.234.46 'openclaw status --deep'
```

Guardrail validation + smoke:

```bash
ssh -o BatchMode=yes admin@47.82.234.46 '/home/admin/.openclaw/scripts/safe_openclaw_validate.sh /home/admin/.openclaw/openclaw.json && /home/admin/.openclaw/scripts/safe_openclaw_smoke.sh'
```

## Read this first next time

1. `AGENTS.md`
2. `codex_handsoff.md`
3. `skills/openclaw-plugin-channel-recovery/SKILL.md`
4. `session_handoff.md`

## Likely next useful tasks

- Add a single wrapper command such as `safe_openclaw_release.sh`
- Decide whether to commit another session update after future operational changes
- Keep documenting any future OpenClaw failure mode before memory fades
