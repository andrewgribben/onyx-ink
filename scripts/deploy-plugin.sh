#!/usr/bin/env bash
# Build the plugin and push it to the Obsidian vault on the Boox over adb.
# Usage: BOOX_VAULT=/sdcard/<path-to-vault> scripts/deploy-plugin.sh
# Set ANDROID_SERIAL=<serial> if adb lists the Boox more than once (USB plus wireless).
set -euo pipefail
# Machine-specific JAVA_HOME, ANDROID_HOME, BOOX_VAULT, ANDROID_SERIAL; see scripts/local.env.example.
VAULT_ARG="${BOOX_VAULT:-}" # a vault given on the command line wins over local.env
[ -f "$(dirname "$0")/local.env" ] && . "$(dirname "$0")/local.env"
BOOX_VAULT="${VAULT_ARG:-${BOOX_VAULT:-}}"
: "${BOOX_VAULT:?set BOOX_VAULT=/sdcard/<path-to-vault>}"
DEST="$BOOX_VAULT/.obsidian/plugins/ink-notebook-onyx"
cd "$(dirname "$0")/../plugin"
npm run build
adb shell mkdir -p "'$DEST'"
adb push main.js manifest.json styles.css "$DEST/"
echo "Deployed to $DEST. Reload the plugin in Obsidian (Settings > Community plugins) or restart Obsidian."
