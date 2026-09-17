#!/usr/bin/env bash
# Stops and removes the launchd service. Data in data/ is kept.
set -euo pipefail
LABEL="com.crypto-arb-bot"
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
rm -f "$HOME/Library/LaunchAgents/$LABEL.plist"
echo "Service removed."
