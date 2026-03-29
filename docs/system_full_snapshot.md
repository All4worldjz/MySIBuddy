# MySiBuddy System Full Snapshot

## Purpose

This document is the fullest current snapshot of the `MySiBuddy` system state after the first production rebuild, hardening pass, runtime verification, GitHub backup, and final health review.

It is intended to serve four purposes:

1. Provide an operations-grade snapshot of the current production shape
2. Preserve the reasoning behind key implementation choices and deviations
3. Point to the exact files needed for rebuild, audit, and recovery
4. Record the current known-good state and the current known limitations

This file is meant to complement, not replace:

- [README.md](/Users/whoami2028/Workshop/GITREPO/MySiBuddy/README.md)
- [communication_manual.md](/Users/whoami2028/Workshop/GITREPO/MySiBuddy/docs/communication_manual.md)
- [execution_report.md](/Users/whoami2028/Workshop/GITREPO/MySiBuddy/docs/openclaw_execution_dump/execution_report.md)

## Snapshot Scope

- Local repo: `/Users/whoami2028/Workshop/GITREPO/MySiBuddy`
- Remote host: `47.82.234.46`
- Remote user: `admin`
- Remote product: OpenClaw
- Current remote version: `2026.3.28`
- Snapshot date: `2026-03-29`
- Timezone used in this repo session: `Asia/Shanghai`

## Executive Summary

The system is currently in a stable and usable first-phase state.

What is working:

- Gateway is running
- Telegram `chief` channel is working
- Telegram `personal` channel is working
- Feishu `work` channel is working
- Multi-agent routing is working
- Google auth profile order is correct
- MiniMax auth profile order is correct
- MiniMax has been verified as a real execution provider, not just a stored credential
- Security audit is down to `0 critical`
- Rebuild materials, sanitized configuration snapshots, and operator documentation are stored in this repo and have been pushed to GitHub

What is not fully complete:

- Feishu calendar is not yet exposed as a usable agent skill
- Feishu native reminders / tasks are not yet exposed as usable agent skills
- Runtime sandbox remains `off` on the live host because the host does not have Docker
- There are still `3 warn` and `1 info` findings in `openclaw security audit`

## Current Production Architecture

### Agents

The live system uses exactly 5 agents:

1. `chief-of-staff`
2. `work-hub`
3. `venture-hub`
4. `life-hub`
5. `product-studio`

Role summary:

- `chief-of-staff`: cross-domain control, triage, and orchestration
- `work-hub`: formal work operations
- `venture-hub`: startup exploration and experiment design
- `life-hub`: personal life, finance, learning, and daily operations
- `product-studio`: backend specialist for product design and structured product thinking

### Front Channels

The live system exposes exactly 3 front-door IM entry points:

1. Telegram `chief`
2. Telegram `personal`
3. Feishu `work`

### Routing

The intended and verified routing logic is:

- Telegram `chief` -> `chief-of-staff`
- Telegram `personal` venture group -> `venture-hub`
- Telegram `personal` life group -> `life-hub`
- Telegram `personal` DM and all other matched personal contexts -> `life-hub`
- Feishu `work` -> `work-hub`

### Default Agent

`chief-of-staff` is the default agent.

This remains the system’s default orchestration and fallback control role.

## Current Runtime State

The most recent remote health snapshot confirmed the following:

- Gateway service is running
- Active agents reported by status: `5`
- Active sessions reported by status: `11`
- Current gateway service PID observed during latest snapshot: `53933`

### Channel Probe Status

Latest probe result:

- Telegram `chief`: `works`
- Telegram `personal`: `works`
- Feishu `work`: `works`

This means the transport layer and account-level bindings are alive at snapshot time.

### Observed Session Footprint

The latest runtime session dump showed the following important active session patterns:

- `agent:chief-of-staff:main`
- `agent:chief-of-staff:telegram:direct:<peer>`
- `agent:work-hub:feishu:direct:<peer>`
- `agent:venture-hub:telegram:group:<venture-group-id>`
- `agent:life-hub:telegram:group:<life-group-id>`
- `agent:life-hub:telegram:direct:<peer>`
- `agent:work-hub:cron:<job-id>`
- `agent:work-hub:cron:<job-id>:run:<run-id>`

Operational meaning:

- Telegram direct and group sessions are active under the expected agents
- Feishu sessions are being created under `work-hub`
- Cron-triggered runs are creating real agent sessions under `work-hub`

This confirms that the routing layer is not just statically configured; it has been exercised at runtime.

## Model and Auth State

### Live Model Assignment

The intended live model plan is:

- `chief-of-staff`
  - primary: `google/gemini-3.1-flash-lite-preview`
  - fallback: `minimax/MiniMax-M2.7`

- `work-hub`
  - primary: `google/gemini-3.1-flash-lite-preview`
  - fallbacks:
    - `google/gemini-3.1-pro-preview`
    - `minimax/MiniMax-M2.7`

- `venture-hub`
  - primary: `google/gemini-3.1-flash-lite-preview`
  - fallbacks:
    - `google/gemini-3.1-pro-preview`
    - `minimax/MiniMax-M2.7`

- `life-hub`
  - primary: `google/gemini-3.1-flash-lite-preview`
  - fallback: `minimax/MiniMax-M2.7`

- `product-studio`
  - primary: `google/gemini-3.1-pro-preview`
  - fallbacks:
    - `google/gemini-3.1-flash-lite-preview`
    - `minimax/MiniMax-M2.7`

### Auth Order

Verified provider-level auth order:

- `google`
  - `google:primary`
  - `google:secondary`
  - `google:tertiary`

- `minimax`
  - `minimax:primary`

### MiniMax Validation

MiniMax was not left at “credential exists” status only. It was tested as a real execution provider.

Important nuance:

- Early tests appeared to keep using Google even after temporarily switching `chief-of-staff` to MiniMax
- Root cause was session-level model stickiness on `agent:chief-of-staff:main`
- After temporarily clearing that sticky main session and re-running the test, logs showed:
  - provider: `minimax`
  - model: `MiniMax-M2.7`
  - response text marker: `MINIMAX_OK_4`

Conclusion:

- MiniMax auth is working
- MiniMax provider integration is working
- MiniMax real inference path is working

## Security State

### Current Security Audit Result

Latest remote security audit:

- `0 critical`
- `3 warn`
- `1 info`

### Current Warnings

1. `gateway.trusted_proxies_missing`

Meaning:
- `gateway.bind` is loopback
- `gateway.trustedProxies` is empty
- If a reverse proxy is later used to expose the Control UI, proxy trust settings must be configured to avoid spoofable local-client assumptions

2. `channels.feishu.doc_owner_open_id`

Meaning:
- Feishu document create flows can grant requester permissions
- This is a capability warning, not a current outage

3. `security.trust_model.multi_user_heuristic`

Meaning:
- The system is still fundamentally a personal-assistant trust model
- Telegram groups plus elevated tools plus `sandbox=off` create a broader attack surface than a strict isolated multi-tenant architecture

### Current Info Finding

- `summary.attack_surface`

Operationally relevant parts:

- group exposure is `allowlist`, not open
- elevated tools are enabled
- browser control is enabled
- internal hooks are enabled

### Why Sandbox Is Currently Off

The original preferred design was to keep `sandbox.mode = non-main`.

That was not viable on this host because:

- the server does not have Docker
- OpenClaw execution failed at runtime with sandbox errors
- IM messages could arrive but fail before agent completion

To restore system usability, live configuration was changed to:

- `agents.defaults.sandbox.mode = off`

This was a deliberate production availability tradeoff, not a documentation drift or accidental regression.

## Feishu State

### What Is Working

Feishu message ingress and egress are working.

Observed runtime evidence during debugging:

- Feishu messages were received
- They were routed to `work-hub`
- Successful dispatches logged `queuedFinal=true` and `replies=1`

### What Capabilities Are Exposed

The currently visible Feishu-related capability surface is limited to:

- document operations
- wiki
- drive
- bitable
- chat-related handling

### What Is Not Yet Exposed

Not currently available as first-class, usable tools in this deployment:

- Feishu calendar
- Feishu native reminder/tasks workflows

### Why Feishu Felt Broken

The channel was not actually broken.

The main issue was:

- unsupported requests around calendar / reminders triggered poor agent behavior
- in at least one case the agent ended with `replies=0`
- this presented as “Feishu not responding”

### What Was Fixed

`work-hub` was updated so unsupported Feishu capability requests no longer fail silently.

Remote files adjusted for this:

- `/home/admin/.openclaw/workspace-work/AGENTS.md`
- `/home/admin/.openclaw/workspace-work/TOOLS.md`

The result is:

- when calendar or reminder capability is not connected, `work-hub` should explain the boundary
- it should propose alternatives instead of returning nothing
- `cron` should be used as the default scheduling substitute when appropriate

## Cron State

### What Was Verified

The built-in `openclaw cron` subsystem is present and operational.

Verified points:

- cron subcommands are available
- jobs can be created
- jobs can be enqueued
- cron-triggered sessions appear under `work-hub`

### Important Delivery Constraint

In a multi-channel environment, `channel=last` is not precise enough for reliable notification delivery.

Observed behavior:

- a self-test with announcement delivery failed because the target channel was ambiguous
- a self-test with `--no-deliver` succeeded

Operational conclusion:

- scheduler execution path works
- agent invocation path from cron works
- delivery must explicitly target a channel/account context in multi-channel production

## Version-Specific Adaptations

This deployment does not exactly match a clean reference environment from documentation.

Important real-world differences:

1. `openclaw` was not on the default non-login SSH path
2. OpenClaw was installed under Node via:
   - `~/.nvm/versions/node/v24.14.1/bin/openclaw`
3. Gateway runs as a user-level systemd service
4. `openclaw plugins status` does not exist in this version
5. Equivalent operational check used:
   - `openclaw plugins doctor`
6. `openclaw models status --probe` needed explicit agent targeting for meaningful inspection
7. `openclaw status` embedded security summary and standalone `openclaw security audit` were not always perfectly aligned; standalone audit was treated as source of truth

## Files of Record in This Repo

### Primary Operator Docs

- [README.md](/Users/whoami2028/Workshop/GITREPO/MySiBuddy/README.md)
- [communication_manual.md](/Users/whoami2028/Workshop/GITREPO/MySiBuddy/docs/communication_manual.md)
- [codex_handoff.md](/Users/whoami2028/Workshop/GITREPO/MySiBuddy/docs/codex_handoff.md)
- [CODEX_PROMPT.md](/Users/whoami2028/Workshop/GITREPO/MySiBuddy/docs/CODEX_PROMPT.md)
- [USER.md](/Users/whoami2028/Workshop/GITREPO/MySiBuddy/docs/USER.md)

### Rebuild and Config Assets

- [bootstrap_openclaw_rebuild.sh](/Users/whoami2028/Workshop/GITREPO/MySiBuddy/scripts/bootstrap_openclaw_rebuild.sh)
- [openclaw.json.template](/Users/whoami2028/Workshop/GITREPO/MySiBuddy/docs/openclaw.json.template)
- [setup-openclaw.md](/Users/whoami2028/Workshop/GITREPO/MySiBuddy/docs/setup-openclaw.md)

### Execution Archive

- [execution_report.md](/Users/whoami2028/Workshop/GITREPO/MySiBuddy/docs/openclaw_execution_dump/execution_report.md)
- [openclaw.final.sanitized.json](/Users/whoami2028/Workshop/GITREPO/MySiBuddy/docs/openclaw_execution_dump/openclaw.final.sanitized.json)
- [bootstrap_openclaw_rebuild.remote.sh](/Users/whoami2028/Workshop/GITREPO/MySiBuddy/docs/openclaw_execution_dump/bootstrap_openclaw_rebuild.remote.sh)
- [manual-auth-commands.remote.sh](/Users/whoami2028/Workshop/GITREPO/MySiBuddy/docs/openclaw_execution_dump/manual-auth-commands.remote.sh)
- [precursor_temp_archive.tgz](/Users/whoami2028/Workshop/GITREPO/MySiBuddy/docs/openclaw_execution_dump/precursor_temp_archive.tgz)

### Seed File Archive

The repo archive also contains copies of the workspace seed files for:

- `workspace-chief`
- `workspace-work`
- `workspace-venture`
- `workspace-life`
- `workspace-product`

under:

- [openclaw_execution_dump](/Users/whoami2028/Workshop/GITREPO/MySiBuddy/docs/openclaw_execution_dump)

## Recovery and Rebuild Guidance

If a rebuild is needed later, the safest high-level order is:

1. Read the handoff and operator docs
2. Review the sanitized final config snapshot
3. Review the execution report for version-specific deviations
4. Use the rebuild script as the baseline structure generator
5. Re-inject secrets manually
6. Re-run health checks and security audit

### Minimum Human-Only Items

These remain intentionally human-controlled:

- OpenClaw installation
- secret preparation
- model auth token pasting
- bot/app secret injection
- final smoke test

## Current Collaboration Guidance

The most stable way to collaborate with the live system remains:

1. Use `chief-of-staff` to classify or triage cross-domain requests
2. Send formal work requests to Feishu `work`
3. Send personal life requests to Telegram personal DM or life context
4. Send startup exploration requests to the venture Telegram group
5. Let `product-studio` remain a backend specialist rather than a front-door bot

The standalone operator communication guide is here:

- [communication_manual.md](/Users/whoami2028/Workshop/GITREPO/MySiBuddy/docs/communication_manual.md)

## Current Known Gaps

The following are still open, by design or by environment constraint:

1. Feishu calendar integration is not complete
2. Feishu native reminder/task integration is not complete
3. ClawHub marketplace access hit `429` during plugin inspection
4. Sandbox is off because the host lacks Docker
5. Some elevated tools remain available in contexts broader than an ideal hardened deployment

## Recommended Next Steps

If work continues later, the most pragmatic order is:

1. Connect or build Feishu calendar support
2. Turn `cron` into a production-ready reminder workflow with explicit delivery targets
3. Revisit sandboxing and tool surface reduction on a Docker-capable host
4. Reduce attack surface for shared or group-facing contexts if the trust boundary broadens

## Status Conclusion

This system should currently be understood as:

- operational
- documented
- recoverable
- partially hardened
- suitable for continued iterative improvement

It should not yet be described as:

- fully hardened
- fully isolated
- fully feature-complete on the Feishu secretary side

For the first-phase target, the system is in a strong, usable, and recoverable state.
