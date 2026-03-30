# OpenClaw Incident Review: Telegram Channel Disabled After Feishu Plugin Rollout

## Summary

On 2026-03-30, Telegram stopped responding on the production OpenClaw host after the `openclaw-lark` Feishu plugin was installed and enabled. The immediate symptom was that both Telegram bots had valid tokens and pending Telegram updates, but the `Telegram` channel no longer appeared in `openclaw status --deep`.

The root cause was not token loss and not a direct runtime conflict between Telegram and `openclaw-lark`. The real failure was a global plugin allowlist change:

- `plugins.allow` was narrowed to `["openclaw-lark"]`
- OpenClaw treats `plugins.allow` as a global plugin allowlist
- stock plugins not present in that allowlist are not eligible to load
- the stock `telegram` plugin was therefore disabled

Telegram recovered immediately after `telegram` was added back to `plugins.allow`.

## Impact

- `@xiaochun4cc_bot` stopped consuming updates
- `@AIboxBD_Bot` stopped consuming updates
- Telegram channel disappeared from `openclaw status --deep`
- Feishu stayed available, which initially obscured the real cause
- `openclaw configure --section channels` became misleading because Telegram looked configured but was effectively plugin-disabled

## Environment

- Host: `47.82.234.46`
- User: `admin`
- OpenClaw version: `2026.3.28`
- Node: `24.14.1`
- Config: `/home/admin/.openclaw/openclaw.json`
- Runtime secrets: `/home/admin/.openclaw/runtime-secrets.json`
- Main log: `/tmp/openclaw/openclaw-2026-03-30.log`

## Symptoms

Observed during the incident:

- Telegram tokens were present in runtime secrets
- direct `getMe` calls to Telegram succeeded for both bots
- Telegram `getWebhookInfo` showed no webhook conflict
- Telegram servers reported pending updates
- `openclaw status --deep` did not show Telegram under `Channels`
- startup logs stopped showing:
  - `[chief] starting provider (@xiaochun4cc_bot)`
  - `[personal] starting provider (@AIboxBD_Bot)`
- Feishu continued to start normally

## Timeline

All times are Asia/Shanghai on 2026-03-30.

1. `07:41:12`
   `openclaw-lark` installation begins.

2. `07:43:05`
   Logs warn that `plugins.allow` is empty and recommend pinning trusted plugin IDs.

3. `07:43:11`
   `Installed plugin: openclaw-lark`

4. `07:43:33`
   Logs show a config change involving `plugins.allow`:
   `config change detected; evaluating reload (..., plugins.allow)`

5. `08:03:10`
   Earliest preserved backup already shows:
   `plugins.allow = ["openclaw-lark"]`

6. After that change
   Telegram channel disappears from `openclaw status --deep`, while Telegram session history remains in the store.

7. Multiple false leads were ruled out
   - Telegram tokens missing: false
   - Telegram tokens invalid: false
   - webhook conflict: false
   - `openclaw-lark` runtime conflict with Telegram: unsupported by A/B test
   - malformed Telegram channel config: not the primary cause

8. `09:10`
   `telegram` added back to `plugins.allow`

9. Immediate recovery
   - `Telegram | ON | OK` returns in `openclaw status --deep`
   - startup logs again show both providers starting
   - health check reports both bots healthy

## Investigation Notes

### False lead 1: Missing tokens

An early check incorrectly reported missing Telegram secrets because the script looked up slash-prefixed keys directly in the JSON secret file instead of following OpenClaw runtime secret resolution rules. This was corrected after direct inspection and Telegram API validation.

Lesson: do not infer runtime secret availability from a naive JSON key lookup.

### False lead 2: Feishu plugin directly broke Telegram

This was plausible but incorrect. Disabling `openclaw-lark` did not restore Telegram. The better explanation was that Telegram never loaded because the stock plugin was excluded from `plugins.allow`.

Lesson: separate channel/plugin load eligibility from plugin-to-plugin runtime conflict.

### Key clue: `openclaw configure`

During interactive configuration, OpenClaw showed:

- `Telegram: configured (plugin disabled)`

That message was the clearest UI hint that the failure was at plugin loading level, not channel token level.

## Root Cause

`plugins.allow` was changed from empty or broader state to:

```json
["openclaw-lark"]
```

OpenClaw interprets this as a global allowlist for plugin loading. Once the allowlist is set, only listed plugins are eligible to load. Because the stock `telegram` plugin was not listed, Telegram was silently filtered out even though:

- `channels.telegram.enabled = true`
- Telegram tokens were valid
- Telegram account config remained present

## Final Fix

The first functional recovery was:

```json
"plugins": {
  "allow": ["openclaw-lark", "telegram"]
}
```

After Telegram recovered, plugin policy was hardened to:

```json
"plugins": {
  "allow": ["openclaw-lark", "telegram"],
  "deny": ["feishu"],
  "entries": {
    "openclaw-lark": { "enabled": true, "config": {} },
    "feishu": { "enabled": false, "config": {} }
  }
}
```

This keeps the system stable by:

- allowing the extension plugin actually in use
- allowing the stock Telegram plugin explicitly
- blocking the legacy stock `feishu` plugin from auto-reappearing

## Verification

Post-fix validation succeeded:

- `openclaw status --deep` shows both `Telegram` and `Feishu` as `ON / OK`
- Telegram health reports:
  - `@xiaochun4cc_bot: chief: OK`
  - `@AIboxBD_Bot: personal: OK`
- logs again show:
  - `[chief] starting provider (@xiaochun4cc_bot)`
  - `[personal] starting provider (@AIboxBD_Bot)`

## Guardrails

1. Treat `plugins.allow` as a global plugin gate, not an extension-only setting.
2. When enabling a new stock channel, add its plugin ID to `plugins.allow` if an allowlist is already present.
3. For known-conflict stock plugins, use `plugins.deny` in addition to `entries.<id>.enabled=false`.
4. Before changing plugin policy, always back up:
   - `/home/admin/.openclaw/openclaw.json`
   - `/home/admin/.openclaw/runtime-secrets.json`
5. After any plugin install or allowlist change, immediately verify:
   - `openclaw status --deep`
   - channel startup logs
   - live message ingress

## Recommended Follow-Up

- Keep `plugins.allow` explicit and minimal
- Keep `plugins.deny = ["feishu"]` while `openclaw-lark` owns the Feishu channel
- Add a reusable runbook for future plugin/channel outages
- Re-check plugin policy any time a new stock channel is enabled

