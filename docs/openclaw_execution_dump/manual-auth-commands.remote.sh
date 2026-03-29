#!/usr/bin/env bash
set -euo pipefail
export OPENCLAW_AGENT_DIR="$HOME/.openclaw/agents/chief-of-staff/agent"
PATH="$HOME/.nvm/versions/node/v24.14.1/bin:$PATH"
openclaw models auth paste-token --provider google --profile-id "google:primary"
openclaw models auth paste-token --provider google --profile-id "google:secondary"
openclaw models auth paste-token --provider google --profile-id "google:tertiary"
openclaw models auth paste-token --provider minimax --profile-id "minimax:primary"
openclaw models auth order set --provider google google:primary google:secondary google:tertiary
openclaw models auth order set --provider minimax minimax:primary
