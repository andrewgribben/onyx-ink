# Progress

Tick acceptance criteria from SPEC section 7 as they pass. Add a date and short notes.

## M0: Bootstrap
- [x] Upstreams imported as subtrees (plugin @ 40f8c7a, companion @ 22a7d83) (2026-11-03)
- [x] `plugin`: `npm ci && npm run check` passes (2026-11-03: Node 24.22, 18 files / 257 tests, production build OK)
- [x] `companion`: `./gradlew assembleDebug` passes (2026-11-03: JDK 17.0.17 Homebrew, `ANDROID_HOME=/opt/homebrew/share/android-commandlinetools`, repo.boox.com reachable; neither is set by default on this Mac, export both first)
- [~] `scripts/deploy-plugin.sh` and `scripts/deploy-companion.sh` exist (2026-11-03). Syntax checked, missing `BOOX_VAULT` fails cleanly. Not run against a device: none attached. See "Needs device check".
- [x] Identity renames (2026-11-03): plugin manifest id `ink-notebook-onyx`, name "Ink Notebook (Onyx)", fork note in description and README; e2e scripts updated to the new id. Companion `applicationId = com.grib.onyxink`, label "Onyx Ink Companion" (checked with `aapt dump badging`), copyright line added to LICENSE.
- [ ] Fork and upstream plugin both enabled with no clash. **Blocked on owner decision.** The plugin id is unique, so both can be installed side by side, but enabling both at once still clashes: both register view type `ink-notebook` and code block processors `ink-notebook` / `ink-figure` (Obsidian refuses duplicates, so the second plugin fails to load), and both patch `WorkspaceLeaf.setViewState` to claim the same `.ink.md` files. The code block languages are part of the file format and can't be renamed. Options: (a) change SPEC to "installed side by side, enable one at a time"; (b) give the fork its own view type and skip duplicate registrations, with the open question of which plugin claims a file. Not checked in Obsidian (e2e needs Linux/Xvfb).

## M1: Protocol and connection
- [ ] —

## M2: Replay
- [ ] —

## M3: Region, pause and style
- [ ] —

## M4: Polish and release
- [ ] —

## Needs device check
- `BOOX_VAULT=/sdcard/<vault> scripts/deploy-plugin.sh` pushes the plugin and it loads in Obsidian on the Boox.
- `scripts/deploy-companion.sh` installs `com.grib.onyxink` next to the upstream companion (note: only one companion can run at a time, both bind port 8765).
