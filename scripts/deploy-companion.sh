#!/usr/bin/env bash
# Build and install the companion APK on the Boox over adb. Needs JDK 17 (JAVA_HOME) and the Android SDK (ANDROID_HOME).
# Set ANDROID_SERIAL=<serial> if adb lists the Boox more than once (USB plus wireless).
set -euo pipefail
# Machine-specific JAVA_HOME, ANDROID_HOME, BOOX_VAULT, ANDROID_SERIAL; see scripts/local.env.example.
[ -f "$(dirname "$0")/local.env" ] && . "$(dirname "$0")/local.env"
cd "$(dirname "$0")/../companion"
./gradlew installDebug
