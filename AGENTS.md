# Repository Guidelines

## Project Structure & Module Organization

This repository is an operations and deployment guide for an OpenClaw-based agent system, not a traditional app codebase.

- [`codex_handsoff.md`](/Users/whoami2028/Workshop/GITREPO/MySiBuddy/codex_handsoff.md): authoritative rebuild guide for a fresh host
- [`skills/openclaw-plugin-channel-recovery/SKILL.md`](/Users/whoami2028/Workshop/GITREPO/MySiBuddy/skills/openclaw-plugin-channel-recovery/SKILL.md): troubleshooting and recovery runbook
- [`config/openclaw/openclaw.example.json`](/Users/whoami2028/Workshop/GITREPO/MySiBuddy/config/openclaw/openclaw.example.json): template config only, not production truth
- [`scripts/bootstrap_openclaw.sh`](/Users/whoami2028/Workshop/GITREPO/MySiBuddy/scripts/bootstrap_openclaw.sh): scaffold validation helper

Keep new operational docs at repo root only if they are primary entry points; otherwise place them under `skills/`, `config/`, or `scripts/`.

## Build, Test, and Development Commands

- `bash scripts/bootstrap_openclaw.sh`: validates the local scaffold and expected files
- `git diff --stat`: quick review before committing doc or config updates
- `rg "<pattern>" codex_handsoff.md skills/ README.md`: verify wording and avoid duplicated guidance

There is no application build pipeline in this repo. Changes are mainly documentation, templates, and shell automation.

## Coding Style & Naming Conventions

- Use Markdown for operational docs and keep sections short, explicit, and action-oriented.
- Use 2-space indentation in JSON examples and shell snippets that appear in docs.
- Prefer lowercase, hyphenated filenames for new docs and skills.
- Keep examples production-specific: use real paths such as `/home/admin/.openclaw/...` when documenting the deployed system.

## Testing Guidelines

- Run `bash scripts/bootstrap_openclaw.sh` after structural changes.
- For documentation updates, verify commands and paths against current files.
- Do not add speculative steps; every recovery step should be traceable to a real incident or confirmed workflow.

## Commit & Pull Request Guidelines

Recent history favors short imperative commits, for example:

- `Document Feishu duplicate-account recovery`
- `Consolidate OpenClaw handoff and recovery docs`
- `chore: bootstrap MySiBuddy scaffold`

PRs should include:

- what changed
- why the change is needed
- which file is now authoritative
- any operational risk or migration impact

## Security & Configuration Tips

- Never commit real tokens, secrets, or private runtime dumps.
- Treat `openclaw.example.json` as a schema hint only.
- When documenting fixes, capture both the failure signature and the minimal proven repair.
