#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

required_paths=(
  "$ROOT_DIR/.env.example"
  "$ROOT_DIR/config/openclaw/openclaw.example.json"
  "$ROOT_DIR/docs/setup-openclaw.md"
  "$ROOT_DIR/src"
)

echo "Validating MySiBuddy Openclaw scaffold..."

for path in "${required_paths[@]}"; do
  if [[ ! -e "$path" ]]; then
    echo "Missing required path: $path" >&2
    exit 1
  fi
done

echo "Scaffold looks good."
echo "Next:"
echo "  1. cp .env.example .env"
echo "  2. Fill provider API keys"
echo "  3. Wire the real Openclaw runtime into scripts/ or src/"

