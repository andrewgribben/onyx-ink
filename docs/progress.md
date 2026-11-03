# Progress

Tick acceptance criteria from SPEC section 7 as they pass. Add a date and short notes.

## M0: Bootstrap
- [x] Upstreams imported as subtrees (plugin @ 40f8c7a, companion @ 22a7d83) (2026-11-03)
- [x] `plugin`: `npm ci && npm run check` passes (2026-11-03: Node 24.22, 18 files / 257 tests, production build OK)
- [x] `companion`: `./gradlew assembleDebug` passes (2026-11-03: JDK 17.0.17 Homebrew, `ANDROID_HOME=/opt/homebrew/share/android-commandlinetools`, repo.boox.com reachable; neither is set by default on this Mac, export both first)
- [~] `scripts/deploy-plugin.sh` and `scripts/deploy-companion.sh` exist (2026-11-03). Syntax checked, missing `BOOX_VAULT` fails cleanly. Not run against a device: none attached. See "Needs device check".
- [x] Identity renames (2026-11-03): plugin manifest id `ink-notebook-onyx`, name "Singularity Notebook", fork note in description and README; e2e scripts updated to the new id. Companion `applicationId = com.grib.onyxink`, label "Onyx Ink Companion" (checked with `aapt dump badging`), copyright line added to LICENSE.
- [~] Fork replaces upstream (SPEC changed 2026-11-03, owner decision; see decisions.md). Running both at once is no longer a goal. `npm run check` passes after the rename. Loading in Obsidian not checked yet: see "Needs device check".

## M1: Protocol and connection
- [ ] —

## M2: Replay
- [ ] —

## M3: Region, pause and style
- [ ] —

## M4: Polish and release
- [ ] —

## Needs device check
- `BOOX_VAULT=/sdcard/<vault> scripts/deploy-plugin.sh` pushes the plugin and "Singularity Notebook" loads in Obsidian on the Boox with upstream Ink Notebook uninstalled, and existing `.ink.md` pages open.
- `scripts/deploy-companion.sh` installs `com.grib.onyxink` next to the upstream companion (note: only one companion can run at a time, both bind port 8765).
