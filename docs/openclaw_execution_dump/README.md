# OpenClaw Execution Dump

This directory archives the full execution review for the remote OpenClaw rebuild on `47.82.234.46`.

Contents:
- `execution_report.md`: end-to-end process review, commands, decisions, version adaptations, validation results, and remaining issues
- `openclaw.final.sanitized.json`: sanitized snapshot of the final live remote config
- `bootstrap_openclaw_rebuild.remote.sh`: remote rebuild bootstrap script snapshot
- `manual-auth-commands.remote.sh`: remote manual auth helper snapshot
- `workspace-*/*`: local copies of the final remote seed files

Sensitive values intentionally redacted or omitted:
- gateway auth token
- runtime secret values
- model API keys
- Telegram bot tokens
- Feishu app secret
