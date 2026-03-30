---
name: openclaw-plugin-channel-recovery
description: Use when OpenClaw channels disappear or stop loading after plugin installation or plugin policy changes, especially when status shows a channel configured but disabled, or when Telegram/Feishu/other channels have valid credentials but do not mount. Covers plugin allowlist and denylist diagnosis, stock-vs-extension plugin interactions, safe rollback, and verification on OpenClaw hosts.
---

# OpenClaw Plugin Channel Recovery

Use this skill when a configured OpenClaw channel stops loading after plugin installation, plugin configuration, or `plugins.allow` / `plugins.deny` changes.

## Focus

Prioritize plugin loading eligibility before chasing token, webhook, or channel-specific logic.

Typical trigger pattern:

- channel config exists
- secrets look valid
- API credentials work in direct probes
- but the channel is absent from `openclaw status --deep`
- or `openclaw configure` says `configured (plugin disabled)`

## Workflow

1. Capture current state before editing anything.
   - Back up `~/.openclaw/openclaw.json`
   - Back up `~/.openclaw/runtime-secrets.json`
   - Record `openclaw status --deep`
   - Record recent gateway logs

2. Check whether the channel is missing at plugin-load level.
   - Run `openclaw status --deep`
   - Run `openclaw config get plugins`
   - Run `openclaw config get channels.<channel>`
   - If the channel is configured but absent from `Channels`, suspect plugin policy first

3. Inspect plugin policy.
   - `plugins.allow` is global
   - once set, only listed plugins are eligible to load
   - this applies to stock plugins too, not just extensions
   - if a stock channel plugin is not in `plugins.allow`, the channel can disappear silently

4. Check for extension and stock plugin conflicts.
   - If an extension replaces a stock channel, keep the extension in `plugins.allow`
   - explicitly deny the old stock plugin with `plugins.deny`
   - do not rely only on `entries.<id>.enabled=false` if auto-enable behavior exists

5. Apply the smallest safe fix.
   - Add the missing stock plugin ID back into `plugins.allow`
   - Add conflicting stock plugin IDs into `plugins.deny` when needed
   - Restart the gateway

6. Verify recovery.
   - `openclaw status --deep`
   - channel-specific startup lines in logs
   - live health check in `status --deep`
   - real inbound message or pending-update consumption

## Known Working Pattern

For a system using `openclaw-lark` for Feishu and stock Telegram:

```json
{
  "plugins": {
    "allow": ["openclaw-lark", "telegram"],
    "deny": ["feishu"],
    "entries": {
      "openclaw-lark": { "enabled": true, "config": {} },
      "feishu": { "enabled": false, "config": {} }
    }
  }
}
```

This pattern:

- preserves Telegram
- keeps the Feishu extension active
- blocks legacy stock `feishu` from auto-reappearing

## Things To Avoid

- Do not assume valid tokens mean the channel plugin loaded
- Do not assume an extension plugin directly broke another channel without checking allowlists
- Do not delete config without a backup
- Do not clear `plugins.allow` or `plugins.deny` casually on a running production host

## Fast Triage Commands

```bash
openclaw status --deep
openclaw config get plugins
openclaw config get channels.telegram
openclaw config get channels.feishu
grep -n "starting provider (@\|plugins.allow\|plugin disabled\|auto-enabled plugins" /tmp/openclaw/openclaw-$(date +%F).log | tail -n 80
```

## Decision Rule

If a channel is configured, credentials are valid, but the channel is absent from `openclaw status --deep`, check `plugins.allow` and `plugins.deny` before investigating channel-specific auth or transport issues.

