# Progress

Tick acceptance criteria from SPEC section 7 as they pass. Add a date and short notes.

## M0: Bootstrap
- [x] Upstreams imported as subtrees (plugin @ 40f8c7a, companion @ 22a7d83) (2026-11-03)
- [x] `plugin`: `npm ci && npm run check` passes (2026-11-03: Node 24.22, 18 files / 257 tests, production build OK)
- [x] `companion`: `./gradlew assembleDebug` passes (2026-11-03: JDK 17.0.17 Homebrew, `ANDROID_HOME=/opt/homebrew/share/android-commandlinetools`, repo.boox.com reachable; neither is set by default on this Mac, export both first)
- [x] `scripts/deploy-plugin.sh` and `scripts/deploy-companion.sh` work on the device (2026-11-03): Note Air 5C, Android 15, firmware `2026-08-03_16-13_4.2.1-rel_0803_eaa32b54f`, over USB with `ANDROID_SERIAL=cc94e0d2` (the Boox also shows up on wireless adb, so plain `adb` sees two devices). Vault `/sdcard/Notes/Notes`; plugin files pushed to `.obsidian/plugins/ink-notebook-onyx`; `com.grib.onyxink` installed.
- [x] Identity renames (2026-11-03): plugin manifest id `ink-notebook-onyx`, name "Singularity Notebook", fork note in description and README; e2e scripts updated to the new id. Companion `applicationId = com.grib.onyxink`, label "Singularity Notebook Companion" (checked with `aapt dump badging`), copyright line added to LICENSE.
- [x] Fork replaces upstream (SPEC changed 2026-11-03, owner decision; see decisions.md). Owner confirmed on the Boox (2026-11-03): "Singularity Notebook" enabled in vault `/sdcard/Notes/Notes`, an ink page was written, saved and reopened. Pen lag is unchanged from upstream, as expected before M2.

## M1: Protocol and connection
- [ ] —

## M2: Replay
- [ ] —

## M3: Region, pause and style
- [ ] —

## M4: Polish and release
- [ ] —

## Needs device check
- (none open)
