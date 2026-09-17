#!/usr/bin/env bash
# One-line installer for a fresh Mac:
#   curl -fsSL https://raw.githubusercontent.com/loveandabove/crypto-arb-bot/main/scripts/bootstrap.sh | bash
# Downloads the latest code into ~/Projects/crypto-arb-bot and installs the
# launchd service. Re-running updates the code and restarts the service.
set -euo pipefail

if ! command -v node >/dev/null; then
  echo "Node is not installed. Open https://nodejs.org, click the green LTS button, install it, then run this command again." >&2
  exit 1
fi

mkdir -p ~/Projects
cd ~/Projects
curl -fsSL -o arb.zip https://github.com/loveandabove/crypto-arb-bot/archive/refs/heads/main.zip
unzip -qo arb.zip
# Keep data/ (balance + trade history) across updates.
if [ -d crypto-arb-bot/data ]; then mv crypto-arb-bot/data crypto-arb-bot-main/data; fi
rm -rf crypto-arb-bot
mv crypto-arb-bot-main crypto-arb-bot
rm arb.zip
bash crypto-arb-bot/scripts/install-service.sh
