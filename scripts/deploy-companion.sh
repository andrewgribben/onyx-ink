#!/usr/bin/env bash
# Build and install the companion APK on the Boox over adb. Needs JDK 17 (JAVA_HOME) and the Android SDK (ANDROID_HOME).
set -euo pipefail
cd "$(dirname "$0")/../companion"
./gradlew installDebug
