#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="$ROOT_DIR/logs"
mkdir -p "$LOG_DIR"
cd "$ROOT_DIR"

if [[ ! -d node_modules ]]; then
  npm install
fi

if ! pgrep -f "[n]ode server.js" >/dev/null; then
  nohup npm start > "$LOG_DIR/bridge.log" 2>&1 &
fi

echo "Mini computer dashboard started on port 3000."
