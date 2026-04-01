---
name: openclaw-plugin-channel-recovery
description: Use when deploying, re-deploying, hardening, tuning, or troubleshooting an OpenClaw system that uses multiple channels, plugin allowlists, multi-agent routing, custom agent roles, or new bot accounts. Covers one-pass production baselining, plugin and channel policy, bindings, new-agent auth files, service runtime shape, multi-agent permissions, and post-change verification.
---

# OpenClaw Deploy And Recovery

Use this skill for either of these situations:

- a fresh host must be brought to the current MySiBuddy production shape in one pass
- an existing host has drifted, and channels, bots, routing, or agent execution need to be repaired

This skill is not just for plugin outages. It is the full OpenClaw deployment, hardening, routing, and recovery runbook for this repo.

## Mandatory Config Guardrails

For any production config edit, use the repository scripts instead of raw file replacement or UI-driven `config.apply`:

```bash
scripts/safe_openclaw_validate.sh /tmp/openclaw.candidate.json
scripts/safe_openclaw_apply.sh /tmp/openclaw.candidate.json
```

Support paths:

```bash
scripts/safe_openclaw_smoke.sh
scripts/safe_openclaw_rollback.sh /home/admin/.openclaw/openclaw.json.pre-apply-YYYYmmdd-HHMMSS
```

What they enforce:

1. exact 7-agent topology
2. exact Telegram accounts `chief/personal/mentor`
3. exact Feishu accounts `work/scribe`
4. `plugins.allow = ["openclaw-lark", "telegram"]`
5. `plugins.deny = ["feishu"]`
6. no top-level `channels.feishu.appId/appSecret`
7. no `channels.feishu.accounts.default`
8. no empty `channels` or `bindings`
9. no patch/Markdown residue in the candidate config

## Config Clobber Failure Mode

This exact production failure has already happened.

Failure chain:

1. `config.patch raw must be an object`
2. `invalid config: agents.list.7: Unrecognized key: "***"`
3. `invalid config: ... Unrecognized key: "description"`
4. later `config.apply` succeeds anyway and overwrites `openclaw.json`
5. `channels` disappear, `bindings` disappear, `plugins.allow` becomes empty, and an unexpected agent can appear
6. runtime then degrades to:
   - `Unknown channel: telegram`
   - `Outbound not configured for channel: telegram`
   - all bots appear dead while the gateway process remains `active`

Required response:

1. stop further config mutation
2. back up the broken config
3. restore the latest known-good `openclaw.json.pre-*`
4. restart gateway
5. run `safe_openclaw_validate.sh` and `safe_openclaw_smoke.sh`

Do not debug on top of a clobbered config unless rollback is impossible.

## Core Rule

Do not treat OpenClaw setup as done because the gateway starts.

A deployment is incomplete until all of these are verified:

1. plugin topology
2. channel topology
3. account-to-agent bindings
4. agent model layout
5. multi-agent permissions
6. new-agent auth artifacts
7. real inbound message routing

## Working Topology

The target MySiBuddy layout is:

- `chief-of-staff`
- `work-hub`
- `venture-hub`
- `life-hub`
- `product-studio`
- `zh-scribe`
- `tech-mentor`

Channel and role intent:

- `chief` Telegram account -> `chief-of-staff`
- `personal` Telegram account -> `life-hub`, with group-specific overrides
- `mentor` Telegram account -> `tech-mentor`
- `work` Feishu account -> `work-hub`
- `scribe` Feishu account -> `zh-scribe`

Model intent:

- `zh-scribe` primary must be `minimax/MiniMax-M2.7`
- `tech-mentor` primary must be `google/gemini-3.1-flash-lite-preview`

## One-Pass Production Baseline

Start from this shape, not from piecemeal tuning:

```json
{
  "plugins": {
    "allow": ["openclaw-lark", "telegram"],
    "deny": ["feishu"]
  },
  "tools": {
    "profile": "full",
    "sessions": { "visibility": "all" },
    "agentToAgent": {
      "enabled": true,
      "allow": [
        "chief-of-staff",
        "work-hub",
        "life-hub",
        "venture-hub",
        "product-studio",
        "zh-scribe",
        "tech-mentor"
      ]
    }
  },
  "session": {
    "dmScope": "per-channel-peer",
    "threadBindings": {
      "enabled": true,
      "idleHours": 24,
      "maxAgeHours": 0
    },
    "agentToAgent": {
      "maxPingPongTurns": 1
    }
  },
  "agents": {
    "defaults": {
      "maxConcurrent": 2,
      "subagents": {
        "maxConcurrent": 4,
        "maxSpawnDepth": 1,
        "maxChildrenPerAgent": 4,
        "archiveAfterMinutes": 120,
        "thinking": "low",
        "runTimeoutSeconds": 300,
        "announceTimeoutMs": 120000
      }
    }
  }
}
```

## Plugin Policy

Treat `plugins.allow` as a global gate.

Rules:

- once `plugins.allow` is set, every required stock plugin must be listed explicitly
- if Feishu is handled by `openclaw-lark`, stock `feishu` must be denylisted
- do not assume extensions only affect extensions

Known working pattern:

```json
{
  "plugins": {
    "allow": ["openclaw-lark", "telegram"],
    "deny": ["feishu"]
  }
}
```

If a channel is configured, credentials are valid, but the channel is missing from `openclaw status --deep`, check plugin policy before chasing token or transport issues.
If `channels` or `bindings` are empty, treat it as config clobber first, not as a token problem.

## Bindings

Use top-level `bindings` for account-to-agent routing.

Do not rely on implicit account naming.

Working pattern:

```json
{
  "bindings": [
    {
      "type": "route",
      "agentId": "work-hub",
      "match": { "channel": "feishu", "accountId": "work" }
    },
    {
      "type": "route",
      "agentId": "zh-scribe",
      "match": { "channel": "feishu", "accountId": "scribe" }
    },
    {
      "type": "route",
      "agentId": "chief-of-staff",
      "match": { "channel": "telegram", "accountId": "chief" }
    },
    {
      "type": "route",
      "agentId": "tech-mentor",
      "match": { "channel": "telegram", "accountId": "mentor" }
    }
  ]
}
```

For Telegram group overrides, use `peer.kind = "group"` and the exact group id.

## Multi-Agent Best Practices

The orchestrator will not actually collaborate unless all of these align:

1. `chief-of-staff.subagents.allowAgents`
2. `tools.sessions.visibility = "all"`
3. `tools.agentToAgent.enabled = true`
4. `tools.agentToAgent.allow` includes both requester and target agents

Implementation detail for `2026.3.28`:

- `tools.agentToAgent.allow` is checked against both sides
- listing only targets is insufficient

Recommended orchestrator behavior:

1. classify domain first
2. call `agents_list`
3. call `sessions_spawn`
4. use `sessions_yield` only after child acceptance
5. do not treat child acceptance as child completion

## New-Agent Trap

When creating a new agent with a new `agentDir`, do not stop at:

- `agents.list[]`
- workspace files
- `agentDir` directory

You must also ensure the new `agentDir` has:

- `auth-profiles.json`
- `models.json`

Without them, the new agent can fail with:

- `All models failed`
- `No API key found for provider "google"`
- `No API key found for provider "minimax"`

In this system, copying the working files from an existing agent fixed the problem:

```bash
cp /home/admin/.openclaw/agents/chief-of-staff/agent/auth-profiles.json /home/admin/.openclaw/agents/<new-agent>/agent/auth-profiles.json
cp /home/admin/.openclaw/agents/chief-of-staff/agent/models.json /home/admin/.openclaw/agents/<new-agent>/agent/models.json
```

Do not assume new agents inherit model credentials automatically.

## Gemini Multi-Key Rule

Treat Gemini multi-key as a provider-auth design, not as a model-name trick.

Core facts:

- Gemini validates one API key per request
- multiple Gemini keys are implemented on the client side as multiple `google` auth profiles
- provider-level auth failover should happen before model fallback
- `auth.order.google` gives ordered failover, not steady-state load balancing

Recommended profile ids:

- `google:primary`
- `google:secondary`
- `google:tertiary`

Recommended config shape:

```json
{
  "auth": {
    "order": {
      "google": [
        "google:primary",
        "google:secondary",
        "google:tertiary"
      ],
      "minimax": ["minimax:primary"]
    }
  }
}
```

Recommended injection flow:

```bash
openclaw models auth paste-token --provider google --profile-id "google:primary"
openclaw models auth paste-token --provider google --profile-id "google:secondary"
openclaw models auth paste-token --provider google --profile-id "google:tertiary"
openclaw models auth paste-token --provider minimax --profile-id "minimax:primary"
openclaw models auth order set --provider google google:primary google:secondary google:tertiary
openclaw models auth order set --provider minimax minimax:primary
```

Version note:

- if the exact CLI subcommand names differ on the host, adapt to the local `openclaw models auth --help`
- do not change the design principle: secrets live in auth profiles, order lives in config

Operational meaning:

1. `google:primary` handles normal traffic
2. `google:secondary` is first hot standby
3. `google:tertiary` is last-resort standby / diagnostics
4. only after all Google profiles fail should the agent fall back to another provider such as MiniMax

Do not assume this gives traffic spreading.

If `google:primary` is healthy, most requests will stay on it.

If you need true multi-key throughput spreading, add one of these on top:

- split high-QPS agents across dedicated Google profiles
- or add an upstream proxy that performs key-aware routing

Fast triage:

- `No API key found for provider "google"` usually means missing `agentDir/auth-profiles.json`, not a model-name problem
- one agent failing while others succeed usually means that agent's auth files drifted
- frequent fallback from Gemini to MiniMax is not success; it usually means the Google auth pool is degraded

## Feishu-Specific Lessons

When introducing a second Feishu app:

- avoid keeping an old global top-level `channels.feishu.allowFrom`
- different Feishu apps can resolve the same person to different ids
- a global allowlist can block the new app unintentionally
- do not keep the old app both at top-level `channels.feishu.appId/appSecret` and again under `channels.feishu.accounts.work`
- in multi-account Feishu mode, do not keep `channels.feishu.accounts.default` unless it is a real distinct account you intentionally route

Safer pattern:

- move allowlists down to the specific account that needs them
- keep new app pairing and allowlist independent
- keep only real Feishu app accounts such as `work` and `scribe`

### Feishu Duplicate Account Failure Mode

This was observed in production.

Symptom:

- the old Feishu bot is online but replies only intermittently
- a new Feishu bot works normally at the same time

What happens:

- the same old Feishu app is loaded twice as `feishu[work]` and `feishu[default]`
- both connections resolve to the same bot `open_id`
- inbound events can land on either connection
- the `default` account often has no correct DM allowlist or pairing state
- the message is then dropped even though the bot appears healthy

Log signature:

- `feishu[work]: bot open_id resolved: ...`
- `feishu[default]: bot open_id resolved: ...`
- `feishu[default]: sender ... not in DM allowlist`

Corrective action:

1. remove top-level `channels.feishu.appId`
2. remove top-level `channels.feishu.appSecret`
3. remove `channels.feishu.accounts.default`
4. keep the old bot only under the explicit real account, for example `work`
5. restart and confirm `openclaw status --deep` reports only the intended Feishu accounts

## Telegram-Specific Lessons

For Telegram:

- private bots are cleaner than 2-person groups for daily use
- if `plugins.allow` exists, `telegram` must be listed
- new Telegram accounts still need explicit `bindings`
- `groupPolicy = "disabled"` is better than relying on implicit behavior for bots that should only handle private chat

## Service Best Practices

On Linux hosts:

1. prefer system Node 24
2. prefer `/usr/bin/openclaw` as the long-running service entrypoint
3. keep systemd `PATH` minimal
4. set:
   - `NODE_COMPILE_CACHE=/var/tmp/openclaw-compile-cache`
   - `OPENCLAW_NO_RESPAWN=1`

Do not leave production pinned to an NVM-managed runtime if you want stable service behavior.

## Deployment Sequence

Use this order:

1. back up config and secrets
2. install system Node and system `openclaw`
3. write plugin topology
4. write channel accounts
5. write `agents.list`
6. write `bindings`
7. write session and multi-agent policy
8. create workspace prompt files
9. create new `agentDir` directories
10. copy or initialize `auth-profiles.json`
11. copy or initialize `models.json`
12. restart gateway
13. verify direct agent calls
14. verify real inbound messages

## Fast Triage Rules

### Symptom: Channel configured but absent from status

Check:

- `openclaw status --deep`
- `plugins.allow`
- `plugins.deny`

### Symptom: New bot starts but does not answer

Check in this order:

1. `bindings`
2. pairing / `allowFrom`
3. new-agent auth files
4. model direct invocation

### Symptom: Orchestrator claims delegation but work stayed local

Check:

- `subagents.allowAgents`
- `tools.sessions.visibility`
- `tools.agentToAgent`

### Symptom: New agent exists but every model says auth missing

Check:

- `agentDir/auth-profiles.json`
- `agentDir/models.json`

## Verification Standard

A change is not done until these pass:

1. `openclaw status --deep`
2. gateway running
3. expected providers started
4. direct invocation of new agents works
5. real channel message lands in expected agent session
6. no new blocking auth failures in logs

## Things To Avoid

- Do not assume valid tokens mean the plugin loaded
- Do not assume a new agent inherits auth from the main agent automatically
- Do not put account-to-agent intent only in prompt text; use `bindings`
- Do not treat all doctor warnings as equally important
- Do not change plugin policy without backing up both config and secrets
- Do not verify only with config reads; always include one real inbound message
