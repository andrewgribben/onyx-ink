#!/usr/bin/env bash
# Build the plugin and push it to the Obsidian vault on the Boox over adb.
# Usage: BOOX_VAULT=/sdcard/<path-to-vault> scripts/deploy-plugin.sh
set -euo pipefail
: "${BOOX_VAULT:?set BOOX_VAULT=/sdcard/<path-to-vault>}"
DEST="$BOOX_VAULT/.obsidian/plugins/ink-notebook-onyx"
cd "$(dirname "$0")/../plugin"
npm run build
adb shell mkdir -p "'$DEST'"
adb push main.js manifest.json styles.css "$DEST/"
echo "Deployed to $DEST. Reload the plugin in Obsidian (Settings > Community plugins) or restart Obsidian."
