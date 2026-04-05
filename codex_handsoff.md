# Codex Handoff: Deploy, Recover, Migrate

This is the authoritative runbook for rebuilding and migrating the MySiBuddy OpenClaw system.

## 1. Production Reality (Verified 2026-04-03)

Verified from remote host `admin@47.82.234.46`:

- OpenClaw `2026.4.2`, system Node `24.13.0`
- Agents: `chief-of-staff` (Admin/Search), 6 Hub Agents (Sandboxed)
- Channels: Telegram `3/3`, Feishu `2/2`, Weixin `1/1`
- Security Architecture:
  - `chief-of-staff`: `sandbox.mode = off`
  - `hubs`: `sandbox.mode = all`, `tools.fs.workspaceOnly = true`
- Plugin policy:
  - `plugins.allow = ["openclaw-lark", "telegram", "duckduckgo", "openclaw-weixin", "minimax", "unified-search"]`
- Performance: `idleHours = 8`, `archiveAfterMinutes = 60`
- Unified Search: Microservice on port `18790`, bridged via `curl`.

Do not drift from this shape unless explicitly requested.

Noise Cleanup:
- Stale `plugins.entries.feishu` removed.
- Redundant `default` accounts removed.

## 2. Non-Negotiable Rules

1. Always back up before edits.
2. Never trust config reads alone; validate with real inbound messages.
3. Keep account-to-agent routing in top-level `bindings`, not prompt text.
4. New agent directories must include `auth-profiles.json` and `models.json`.
5. Do not run `openclaw doctor --fix` blindly.
6. Do not publish production config by hand; use the guardrail scripts in `scripts/`.

## 2.1 Guardrail Script Flow

These scripts are the only approved production config path:

```bash
scripts/safe_openclaw_validate.sh /tmp/openclaw.candidate.json
scripts/safe_openclaw_apply.sh /tmp/openclaw.candidate.json
```

Supporting commands:

```bash
scripts/safe_openclaw_smoke.sh
scripts/safe_openclaw_rollback.sh /home/admin/.openclaw/openclaw.json.pre-apply-YYYYmmdd-HHMMSS
```

Execution contract:

1. `safe_openclaw_validate.sh` checks JSON syntax plus current production topology.
2. `safe_openclaw_apply.sh` creates a timestamped backup, copies the candidate into place, restarts `openclaw-gateway`, runs smoke checks, and auto-rolls back on failure.
3. `safe_openclaw_smoke.sh` verifies `Telegram ON/OK`, `Feishu ON/OK`, `Agents = 7`, and absence of fatal drift signals in recent logs.
4. `safe_openclaw_rollback.sh` restores an explicit or latest backup and re-runs smoke validation.

Do not bypass this flow with UI-driven `config.apply`, ad hoc JSON edits, or `openclaw doctor --fix`.

## 2.2 2026-04-01 Config Clobber Incident

This failure has already happened in production and must be treated as a known trap.

Observed sequence:

1. `gateway-client` attempted `config.patch` with a non-object payload.
2. Another attempt injected invalid keys into `agents.list.7`, including `***` and `description`.
3. A later `config.apply` succeeded, but it overwrote `openclaw.json` with an incomplete object.
4. Production drifted to:
   - `channels = []`
   - `bindings = 0`
   - `plugins.allow = null`
   - `plugins.deny = null`
   - unexpected extra agent `slideforge`
5. Runtime symptoms became:
   - `Unknown channel: telegram`
   - `Outbound not configured for channel: telegram`
   - all bots stopped replying even though the gateway process was still running

Verified recovery path:

```bash
cp /home/admin/.openclaw/openclaw.json.pre-balanced-rotation-20260401-013832 /home/admin/.openclaw/openclaw.json
systemctl --user restart openclaw-gateway
openclaw status --deep
```

Operational rule:

- If this signal chain appears again, stop all further mutation attempts and roll back first.
- Do not keep debugging on top of a clobbered config.

## 3. LLM API Setup (Critical)

### 3.1 Model intent

Verified current mapping:

- `chief-of-staff`: primary `google/gemini-3.1-flash-lite-preview`, fallback `minimax/MiniMax-M2.7`
- `work-hub`: primary `google/gemini-3.1-flash-lite-preview`, fallbacks `google/gemini-3.1-pro-preview`, `minimax/MiniMax-M2.7`
- `venture-hub`: primary `google/gemini-3.1-flash-lite-preview`, fallbacks `google/gemini-3.1-pro-preview`, `minimax/MiniMax-M2.7`
- `life-hub`: primary `google/gemini-3.1-flash-lite-preview`, fallback `minimax/MiniMax-M2.7`
- `product-studio`: primary `google/gemini-3.1-pro-preview`, fallbacks `google/gemini-3.1-flash-lite-preview`, `minimax/MiniMax-M2.7`
- `zh-scribe`: primary `minimax/MiniMax-M2.7`, fallbacks `google/gemini-3.1-pro-preview`, `google/gemini-3.1-flash-lite-preview`
- `tech-mentor`: primary `google/gemini-3.1-flash-lite-preview`, fallbacks `google/gemini-3.1-pro-preview`, `minimax/MiniMax-M2.7`

### 3.2 Provider auth design

Use provider profiles, not raw keys in `openclaw.json`.

Recommended profile IDs:

- `google:primary`
- `google:secondary`
- `google:tertiary`
- `minimax:primary`

Recommended auth order:

```json
{
  "auth": {
    "order": {
      "google": ["google:primary", "google:secondary", "google:tertiary"],
      "minimax": ["minimax:primary"]
    }
  }
}
```

### 3.3 Human operator steps (copy-paste)

Ask the human to do only this:

1. Provide Google key 1, key 2, key 3, and MiniMax key.
2. Do not edit server files manually.

Codex executes:

```bash
openclaw models auth paste-token --provider google --profile-id "google:primary"
openclaw models auth paste-token --provider google --profile-id "google:secondary"
openclaw models auth paste-token --provider google --profile-id "google:tertiary"
openclaw models auth paste-token --provider minimax --profile-id "minimax:primary"
openclaw models auth order set --provider google google:primary google:secondary google:tertiary
openclaw models auth order set --provider minimax minimax:primary
```

Then verify provider auth state:

```bash
openclaw models auth list
openclaw models auth order show --provider google
openclaw models auth order show --provider minimax
```

### 3.4 Agent model mapping checklist

Before restart, confirm in `openclaw.json`:

1. `zh-scribe.primary == minimax/MiniMax-M2.7`
2. `tech-mentor.primary == google/gemini-3.1-flash-lite-preview`
3. both agents include fallback chains
4. no accidental model-name aliases pointing to removed providers

### 3.5 Frequent failures

- `No API key found for provider ...`:
  - missing or drifted `agentDir/auth-profiles.json`
  - missing or drifted `agentDir/models.json`
- New agent works in config but all models fail:
  - auth files were not copied/initialized for that `agentDir`

## 4. Feishu Plugin Installation and Stock Suppression

### 4.1 Install `openclaw-lark`

Use official package install flow, then verify install metadata.

Reference flow:

```bash
openclaw plugin install @larksuite/openclaw-lark
openclaw status --deep
```

If private/internal archive is used:

```bash
openclaw plugin install /path/to/larksuite-openclaw-lark-<version>.tgz
```

Post-install checks:

1. `openclaw status --deep` shows Feishu channel present.
2. `openclaw.json` contains `plugins.installs.openclaw-lark`.
3. `plugins.allow` contains `openclaw-lark`.

### 4.2 Verified bindings (production)

Current production bindings are:

1. `telegram/chief -> chief-of-staff`
2. `telegram/personal + group -1003839165807 -> venture-hub`
3. `telegram/personal + group -1003872666315 -> life-hub`
4. `telegram/personal (default) -> life-hub`
5. `feishu/work -> work-hub`
6. `feishu/scribe -> zh-scribe`
7. `telegram/mentor -> tech-mentor`

Reproduce these exactly before tuning prompts.

### 4.3 Suppress stock `feishu` safely

Required policy:

```json
{
  "plugins": {
    "allow": ["openclaw-lark", "telegram"],
    "deny": ["feishu"]
  }
}
```

### 4.4 Critical anti-conflict rules

- Do not keep top-level `channels.feishu.appId` and `channels.feishu.appSecret` in multi-account mode.
- Do not keep `channels.feishu.accounts.default` unless it is a real separate Feishu app.
- Keep only explicit real accounts (`work`, `scribe`).

Known failure signature:

- `feishu[work]` and `feishu[default]` resolve same `open_id`
- intermittent no-reply
- `feishu[default]: sender ... not in DM allowlist`

## 5. Memory and Agent Migration

### 5.1 What must be migrated

- `/home/admin/.openclaw/openclaw.json`
- `/home/admin/.openclaw/runtime-secrets.json`
- `/home/admin/.openclaw/agents/`
- `/home/admin/.openclaw/workspace-*`
- `/home/admin/.openclaw/memory/`
- `/home/admin/.config/systemd/user/openclaw-gateway.service`

### 5.2 Snapshot backup

```bash
tar -czf /home/admin/openclaw-snapshot-YYYYmmdd-HHMM.tgz \
  -C /home/admin \
  .openclaw \
  .config/systemd/user/openclaw-gateway.service
sha256sum /home/admin/openclaw-snapshot-YYYYmmdd-HHMM.tgz
```

### 5.3 Restore

```bash
tar -xzf /home/admin/openclaw-snapshot-YYYYmmdd-HHMM.tgz -C /home/admin
systemctl --user restart openclaw-gateway
openclaw status --deep
```

### 5.4 Current memory shape (verified)

- DBs present: `chief-of-staff.sqlite`, `work-hub.sqlite`
- Workspace memory dirs present for all 7 workspaces
- Memory engine healthy (`vector ready`, `fts ready`)

### 5.5 Agent-by-agent copy path

If full snapshot restore is not possible, copy these per agent:

1. `/home/admin/.openclaw/agents/<agent-id>/agent/` (includes auth + model artifacts)
2. `/home/admin/.openclaw/workspace-<domain>/SOUL.md`
3. `/home/admin/.openclaw/workspace-<domain>/AGENTS.md`
4. `/home/admin/.openclaw/workspace-<domain>/MEMORY.md`
5. `/home/admin/.openclaw/workspace-<domain>/memory/`

And always keep global files synchronized:

- `/home/admin/.openclaw/openclaw.json`
- `/home/admin/.openclaw/runtime-secrets.json`

Guardrail scripts should also be migrated:

- `/home/admin/.openclaw/scripts/lib_openclaw_guardrails.sh`
- `/home/admin/.openclaw/scripts/safe_openclaw_validate.sh`
- `/home/admin/.openclaw/scripts/safe_openclaw_apply.sh`
- `/home/admin/.openclaw/scripts/safe_openclaw_smoke.sh`
- `/home/admin/.openclaw/scripts/safe_openclaw_rollback.sh`

If agent IDs or account IDs change, update `bindings` immediately.

## 6. Human Collaboration Protocol

Treat human operators as execution partners with minimal OpenClaw context.

Use this interaction style:

1. One action per message.
2. Provide exact copy-paste commands.
3. State expected success signal.
4. Ask for only required outputs (`appId`, `appSecret`, `botToken`, command result lines).

Good example:

1. Create a new Feishu app in console.
2. Send me only `appId` and `appSecret`.
3. Do not edit server config; I will wire and verify routing.

Hard rule for human-guided operations:

1. Human creates third-party app/bot only.
2. Codex performs all server-side config writes.
3. Human validates by sending a real message.
4. Codex validates logs + session keys.

## 7. Final Validation Checklist

1. `openclaw status --deep` shows Telegram `ON/OK` and Feishu `ON/OK`.
2. `openclaw status --deep` shows 7 agents.
3. Direct call to `zh-scribe` uses `MiniMax-M2.7`.
4. Direct call to `tech-mentor` uses `gemini-3.1-flash-lite-preview`.
5. Real Feishu `scribe` message lands in `agent:zh-scribe:feishu:...`.
6. Real Telegram `mentor` message lands in `agent:tech-mentor:telegram:...`.
7. Chief can spawn and read back sub-agent results.
