#!/usr/bin/env bash
# Installs the bot as a launchd user service so it starts at login and
# restarts if it crashes. Safe to re-run: it replaces the existing service.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LABEL="com.crypto-arb-bot"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
NODE="$(command -v node || true)"

if [ -z "$NODE" ]; then
  echo "node not found. Install it first: brew install node   (or https://nodejs.org)" >&2
  exit 1
fi

mkdir -p "$HOME/Library/LaunchAgents" "$ROOT/data"
sed -e "s|__NODE__|$NODE|g" -e "s|__ROOT__|$ROOT|g" "$ROOT/scripts/$LABEL.plist" > "$PLIST"

launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
launchctl kickstart -k "gui/$(id -u)/$LABEL"

sleep 2
if curl -fs "http://localhost:$(node -p "require('$ROOT/config.json').port")/api/state" >/dev/null; then
  echo "Service running. Dashboard: http://$(scutil --get LocalHostName).local:$(node -p "require('$ROOT/config.json').port")"
else
  echo "Service installed but not answering yet. Check: tail -50 $ROOT/data/server.log" >&2
fi
