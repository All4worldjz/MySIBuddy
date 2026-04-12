# Repository Agent Rules

This file defines how Codex must operate in this repository.

## 1. Scope

This repository is for OpenClaw deployment, troubleshooting, and system migration.
It is not an application source repository.

Primary docs:

1. `README.md`
2. `codex_handsoff.md`
3. `skills/openclaw-plugin-channel-recovery/SKILL.md`

## 2. Execution Order (Mandatory)

For any operational task:

1. Read current docs.
2. Inspect real remote runtime (`openclaw status --deep`, key config fields).
3. Do read-only diagnosis first.
4. Propose minimal change.
5. Back up before edits.
6. Apply changes.
7. Restart/reload if needed.
8. Validate with real inbound message flow.
9. Write back lessons to docs.

Do not skip steps 2, 5, or 8.

## 3. Safety Rules

- Default: **do not push to `origin`** unless user explicitly asks.
- Before destructive cleanup, create a local `tar` backup.
- Never rely only on config presence; verify runtime behavior.
- Do not run `openclaw doctor --fix` automatically.
- Do not keep stale templates or scaffold files that can mislead operators.
- Do not use UI-driven or agent-driven full `config.apply` as a production publish path.
- For production config changes, use `scripts/safe_openclaw_validate.sh` and `scripts/safe_openclaw_apply.sh`.
- Treat `Config overwrite`, `Config write anomaly`, `Config observe anomaly`, `Unknown channel`, `Outbound not configured`, and `openclaw.json.clobbered.*` as rollback-first signals.

## 4. Human Collaboration Rules

Assume human partners may be non-technical.

- Ask for one action at a time.
- Provide copy-paste commands only.
- State expected success output.
- Ask only for required artifacts (`appId`, `appSecret`, `botToken`, specific command output).
- Do not ask humans to hand-edit complex JSON unless unavoidable.

## 5. OpenClaw-Specific Hard Rules

- Keep routing in top-level `bindings`, not prompt text.
- New agent directories must contain:
  - `auth-profiles.json`
  - `models.json`
- In multi-account Feishu mode:
  - do not keep top-level `channels.feishu.appId` / `appSecret`
  - do not keep `channels.feishu.accounts.default` unless truly needed
- Plugin policy must explicitly preserve required stock plugins.
- Never overwrite production `openclaw.json` with an incomplete object; candidate configs must preserve the full current topology unless the user explicitly wants topology change.

## 6. Alias Mapping (2026-04-11 Updated)

When interacting within this repository or across agents, use these aliases:

| Agent ID | 角色 | 备注 |
| :--- | :--- | :--- |
| `neo` | Guardian | 原 chief-of-staff |
| `link` | Operator | 原 coder-hub + sysop |
| `trinity` | Worker | 原 work-hub |
| `morpheus` | Strategist | 原 venture-hub |
| `oracle` | Mentor | 原 tech-mentor + life-hub |
| `smith` | Challenger | 新建 |
| `architect` | Designer | 原 product-studio |
| `theodore` | Scribe | 原 zh-scribe |

## 7. Definition of Done

A task is complete only when all are true:

1. `openclaw status --deep` healthy.
2. Target channels/accounts are `ON/OK`.
3. Direct agent invocation succeeds with intended model/provider.
4. Real inbound messages route to intended session keys.
5. Documentation reflects the new verified behavior.
