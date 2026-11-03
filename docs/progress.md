# Progress

Tick acceptance criteria from SPEC section 7 as they pass. Add a date and short notes.

## M0: Bootstrap
- [x] Upstreams imported as subtrees (plugin @ 40f8c7a, companion @ 22a7d83) (2026-11-03)
- [x] `plugin`: `npm ci && npm run check` passes (2026-11-03: Node 24.22, 18 files / 257 tests, production build OK)
- [x] `companion`: `./gradlew assembleDebug` passes (2026-11-03: JDK 17.0.17 Homebrew, `ANDROID_HOME=/opt/homebrew/share/android-commandlinetools`, repo.boox.com reachable; neither is set by default on this Mac, export both first)
- [x] `scripts/deploy-plugin.sh` and `scripts/deploy-companion.sh` work on the device (2026-11-03): Note Air 5C, Android 15, firmware `2026-08-03_16-13_4.2.1-rel_0803_eaa32b54f`, over USB with `ANDROID_SERIAL=cc94e0d2` (the Boox also shows up on wireless adb, so plain `adb` sees two devices). Vault `/sdcard/Notes/Notes`; plugin files pushed to `.obsidian/plugins/ink-notebook-onyx`; `com.grib.onyxink` installed.
- [x] Identity renames (2026-11-03): plugin manifest id `ink-notebook-onyx`, name "Singularity Notebook", fork note in description and README; e2e scripts updated to the new id. Companion `applicationId = com.grib.onyxink`, label "Singularity Notebook Companion" (checked with `aapt dump badging`), copyright line added to LICENSE.
- [x] Fork replaces upstream (SPEC changed 2026-11-03, owner decision; see decisions.md). Owner confirmed on the Boox (2026-11-03): "Singularity Notebook" enabled in vault `/sdcard/Notes/Notes`, an ink page was written, saved and reopened. Pen lag is unchanged from upstream, as expected before M2.

Local setup (2026-11-03): deploy scripts read `scripts/local.env` (gitignored; template `scripts/local.env.example`), and `companion/local.properties` (gitignored) sets `sdk.dir`. Both scripts checked with an empty environment.

## M1: Protocol and connection
- [x] `protocol.ts`, `coords.ts`, `matcher.ts` unit tests in `plugin/tests/onyx*.test.ts` (2026-11-03): v1 and v2 parsing, coordinate round trip at dpr 1/2/2.5, keyboard-gap rule, pressure, timestamps, every matcher outcome plus a `late` outcome (Onyx stroke after its pointer stroke fell back, dropped so it can't duplicate). Bridge tests with a fake socket. `npm run check`: 22 files, 278 tests.
- [x] Bridge connects and diagnostics show received strokes (2026-11-03, Note Air 5C, landscape): state `connected`, hello `onyx-ink-companion 0.2.0, 2480 x 1860, pressureMax 4096`, 10 v2 strokes listed. Tested against our v2 companion; owner accepted unit tests for v1 (unmodified upstream APK) parsing instead of a device run. Raw log saved and kept as fixture `plugin/tests/fixtures/onyx/noteair5c-v2-landscape-12-strokes.json` (hello, state, 12 strokes; `oy` 62, so the overlay starts below the status bar).
- [x] Companion sends v2 `hello`, `state` and `stroke` (2026-11-03): seen on device in diagnostics. Timestamps kept as doubles (floats lose ms precision). `pressureMax` is a fixed 4096 (no SDK call found yet, SPEC 10.4).
- [x] No change to how ink is drawn: `src/ink/` untouched; owner reports writing feels the same and smooth.
- Harness and e2e: owner decision 2026-11-03, run only for milestones that change drawing or input code (SPEC 8), so not run for M1. One earlier harness run showed 1 failing check; compare with upstream before M2.
- Observation (2026-11-03): owner found the second session felt slower than the first. Not diagnosed. Likely the open question in SPEC 10.1 (upstream turns overlay rendering off in `onPenUpRefresh`, so instant ink can stop until the watchdog re-claims). Check first thing in M2.

**M1 done 2026-11-03.**

## M2: Replay
- [~] Instant Onyx ink, then a normal stroke in the right place (2026-11-03, Note Air 5C): owner confirms every stroke instant, stays put, at zoom 1 and when zoomed. Diagnostics: every stroke `matched`. Diagnostics read over adb: matched + fallbacks = 57 of 57 pen strokes (52 matched, 5 fallback while the companion was stopped), mean offset Onyx minus pointer -1.0 x, -0.9 y CSS px over 52 strokes (within 2 px). 13 orphans: Onyx ink drawn with the eraser tool, correctly dropped. **Open: input is slow after double-tap zoom.** Measured over adb: `renderAll` takes about 0.6 ms fit and 0.5 ms at 2x, and pointer latency and frame gaps are the same at both, so the page itself is not slower when zoomed. Cause not found yet; needs the owner to say whether the ink appears late or the page lags.
- [x] Fallback (2026-11-03): companion stopped, strokes still appeared promptly and saved; after restart, strokes matched again.
- [~] Eraser, lasso, undo/redo, autosave: undo/redo and autosave confirmed. The owner's stylus has no eraser end or side button, so those can't be tested on this device (unit-tested only). Toolbar eraser works but the overlay first draws its path as black ink; expected until M3 sends tool state to the companion. Lasso and OCR not yet checked.
- [~] No duplicates: owner reports clean writing with no doubles, strokes where written. The formal 200-stroke count from diagnostics is still to do.
- [ ] Palm rejection.
- Harness 2026-11-03: 48 pass, 1 fail (text tool typing), which also fails on upstream `f4b4ec4`, so not ours.

## M3: Region, pause and style
- [ ] —

## M4: Polish and release
- [ ] —

## M5: Inline ink blocks
- [ ] —

## Needs device check
- (none open)
