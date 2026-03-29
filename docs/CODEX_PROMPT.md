# OpenClaw Production Rebuild Task

You are operating on my production OpenClaw server over SSH.

Your mission is to safely rebuild my OpenClaw system into a minimal, production-ready, multi-agent personal operating system.

## Core requirements

Do not over-design.

Do not add:
- mem0
- LCM
- WhatsApp
- extra agents beyond the required first-phase design
- extra front-door bots

Keep the system:
- stable
- secure
- auditable
- easy to maintain
- deterministic in routing
- clean in memory boundaries

## Required architecture

### Agents
Create or reconcile exactly these 5 agents:

1. chief-of-staff
2. work-hub
3. venture-hub
4. life-hub
5. product-studio

### Front-door channels / bot accounts
Use exactly these 3 front-door IM identities:

1. Feishu account "work" -> work-hub
2. Telegram account "chief" -> chief-of-staff
3. Telegram account "personal" -> split by group:
   - venture group -> venture-hub
   - life group -> life-hub
   - all remaining traffic on this account -> life-hub

### Routing
Use deterministic bindings.
Do not rely on vague or emergent behavior.
Use exact peer-based routing where appropriate.

### Default agent
chief-of-staff must be the default agent / final fallback route.

## Session and plugin requirements

- session.dmScope must be per-channel-peer
- plugins.slots.memory must be memory-core
- plugins.slots.contextEngine must be legacy

## Memory requirements

- workspace Markdown memory is the source of truth
- do not use mem0
- do not use LCM
- keep MEMORY.md minimal and durable
- do not overpopulate memory with generated noise

## Model design

### Main models
- chief-of-staff primary: google/gemini-3.1-flash-lite-preview
- work-hub primary: google/gemini-3.1-flash-lite-preview
- venture-hub primary: google/gemini-3.1-flash-lite-preview
- life-hub primary: google/gemini-3.1-flash-lite-preview
- product-studio primary: google/gemini-3.1-pro-preview

### Fallbacks
- chief-of-staff fallback: minimax/MiniMax-M2.7
- work-hub fallbacks: google/gemini-3.1-pro-preview -> minimax/MiniMax-M2.7
- venture-hub fallbacks: google/gemini-3.1-pro-preview -> minimax/MiniMax-M2.7
- life-hub fallback: minimax/MiniMax-M2.7
- product-studio fallbacks: google/gemini-3.1-flash-lite-preview -> minimax/MiniMax-M2.7

## Auth / key handling requirements

Real secrets must NEVER be written into openclaw.json.

Model credentials must be handled through OpenClaw auth profiles or another secure runtime mechanism compatible with the installed OpenClaw version.

Use the following auth profile design:
- google:primary
- google:secondary
- google:tertiary
- minimax:primary

Auth order must be:
- google: primary -> secondary -> tertiary
- minimax: primary

Provider-internal auth failover must happen before model fallback.

Human will manually input secrets.
You may prepare commands, placeholders, and secure config structure, but you must not store plaintext secrets in tracked config files.

## Required work sequence

1. Inspect installed OpenClaw version and active config path
2. Inspect actual CLI behavior and command availability
3. Back up current ~/.openclaw before changes
4. Inspect current agents, channels, bindings, plugins, models
5. Reconcile local version differences with target design
6. Create/update:
   - openclaw.json
   - agent workspaces
   - minimal SOUL.md / AGENTS.md / MEMORY.md
   - helper scripts
7. Configure or prepare model auth ordering
8. Restart gateway safely
9. Run validations
10. Produce final report

## Validation commands to run

- openclaw --version
- openclaw status
- openclaw agents list --bindings
- openclaw channels status --probe
- openclaw models status --probe
- openclaw plugins status
- openclaw security audit

## Behavior rules

- Never guess silently
- Inspect first, then act
- If the installed version differs from current docs, adapt to the installed version and explain the delta
- Always back up before modification
- Keep prompts and markdown files concise
- Do not create more bots or more agents than specified
- Do not add optional plugins
- Do not expose secrets in config files
- Do not remove existing components blindly if they are required for startup; explain before changing

## Human-provided values

The human operator will manually provide or manually inject:

- GOOGLE_API_KEY_PRIMARY
- GOOGLE_API_KEY_SECONDARY
- GOOGLE_API_KEY_TERTIARY
- MINIMAX_API_KEY
- TELEGRAM_BOT_TOKEN_CHIEF
- TELEGRAM_BOT_TOKEN_PERSONAL
- FEISHU_APP_ID
- FEISHU_APP_SECRET
- TELEGRAM_VENTURE_GROUP_ID
- TELEGRAM_LIFE_GROUP_ID

## Deliverables

Provide:
1. concise progress notes while working
2. final concise implementation report
3. files changed
4. exact or summarized diffs
5. commands executed
6. manual post-run checklist
7. any uncertainty caused by version mismatch