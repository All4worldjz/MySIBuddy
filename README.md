# MySiBuddy

`MySiBuddy` is a local project scaffold for setting up and extending Openclaw.

## Branch Strategy

- `main`: stable baseline for setup and verified changes
- `dev`: active development branch

## Project Structure

- `config/openclaw/`: Openclaw config templates
- `docs/`: setup and operating notes
- `skills/`: reusable Codex skills for MySiBuddy operations
- `scripts/`: bootstrap and validation scripts
- `src/`: application code for future MySiBuddy features

## Quick Start

1. Copy `.env.example` to `.env`.
2. Review `config/openclaw/openclaw.example.json`.
3. Run `./scripts/bootstrap_openclaw.sh`.
4. Start implementing project code in `src/`.

## Git

This repository is initialized with `main` and `dev` branches.

## Operational Docs

- [`docs/setup-openclaw.md`](docs/setup-openclaw.md): base setup notes
- [`docs/openclaw-incident-2026-03-30-telegram-feishu.md`](docs/openclaw-incident-2026-03-30-telegram-feishu.md): postmortem for the Telegram outage caused by plugin allowlist narrowing after `openclaw-lark` rollout
