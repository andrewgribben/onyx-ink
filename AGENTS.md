# AGENTS.md

Instructions for coding agents (Hermes, Claude Code, Codex, …) working in this repo.

## What this is

**Onyx Ink**: low-latency Boox (Onyx Pen SDK) handwriting for the **Ink Notebook** Obsidian plugin. Two parts live in one repo:

| Dir | What | Lang / build | Licence |
|---|---|---|---|
| `plugin/` | Fork of Ink Notebook (Obsidian plugin, id `ink-notebook-onyx`) | TypeScript, esbuild, vitest | AGPL-3.0-or-later |
| `companion/` | Fork of boox-rapid-draw-ink (Android overlay + WebSocket server) | Kotlin, Gradle (AGP 8.7.2, Gradle 8.9, JDK 17) | MIT |

**`SPEC.md` is the source of truth.** Read it before you start any task. If the spec and the code disagree, or the spec is wrong, stop and update the spec, with the reason in the commit, before writing code that diverges from it.

## How to work

1. **Commit first.** Before changing any code, commit all uncommitted work so the tree is clean. Do this every time.
2. **One milestone at a time** (SPEC section 7: M0 → M4). Don't start a milestone until the previous one's acceptance criteria pass. Track progress in `docs/progress.md`: tick each acceptance criterion, and add notes and the date.
3. **Small commits** with clear messages, prefixed with the area: `plugin:`, `companion:`, `spec:`, `docs:`, `scripts:`.
4. **Commit after every completed task** unless told not to.
5. **Record decisions** that aren't in the spec in `docs/decisions.md` (date, decision, why, alternatives).
6. When something can only be checked on the device and no device is attached, say so in `docs/progress.md` under "Needs device check". **Don't mark it done.**

## Upstream-friendly changes (important)

Both directories are `git subtree --squash` imports, and we want to keep pulling upstream (SPEC section 9).

- Put new logic in **new files**: `plugin/src/onyx/*.ts` and new Kotlin classes in `companion/`.
- Keep edits to upstream files minimal, and mark each one with a `// onyx-ink:` comment.
- Don't reformat, rename or reorganise upstream code.
- Never change the `.ink.md` file format. Files must stay readable by upstream Ink Notebook.
- Never copy code between `plugin/` (AGPL) and `companion/` (MIT).
- New files in `plugin/` start with an AGPL header noting they're part of the Onyx Ink fork.

## Commands

### Plugin
```bash
cd plugin
npm ci
npm run check        # typecheck + vitest + production build. Must pass before every commit that touches plugin/
npm test             # vitest only
npm run harness      # pen engine in a browser via Playwright (`npm i --no-save playwright` first; run before closing a milestone that changes drawing/input code)
npm run build        # outputs main.js (+ manifest.json, styles.css)
```
e2e (`plugin/e2e/`) needs Linux + Xvfb. Run it before closing a milestone if the environment allows, otherwise note it in progress.md.

### Companion
```bash
cd companion
./gradlew assembleDebug
./gradlew installDebug   # needs Boox over adb
```
Needs JDK 17 (`JAVA_HOME`) and network access to `https://repo.boox.com/repository/maven-public/`.

### Device (Boox Note Air 5C)
- USB debugging: Settings → Apps → App Management → USB Debug Mode (or Build Number ×7 → Developer options).
- `adb devices` must list the device.
- Deploy scripts (created in M0): `scripts/deploy-plugin.sh` (needs `BOOX_VAULT=/sdcard/<path-to-vault>`) and `scripts/deploy-companion.sh`.
- After deploying the plugin, reload it in Obsidian (Settings → Community plugins) or restart Obsidian.
- Logs: `adb logcat -s StrokeWebSocketServer OverlayShowingService` for the companion. For the plugin, Obsidian's WebView is debuggable over adb: `scripts/boox-eval.mjs '<js>'` evaluates JS in it (e.g. read `app.workspace.activeLeaf.view.surface`, open the diagnostics command). Don't write into the owner's notes; test in a scratch `.ink.md` file and delete it. Injected `adb shell input stylus` strokes end in `pointercancel` and never reach the Onyx overlay, so they can't test the pen path.
- Companion permissions: "Display over other apps", background activity allowed / not frozen (App Optimisation; if the icon shows a snowflake, long-press → Unfreeze).

## Code map (where to look)

Plugin:
- `src/ink/input.ts`: `InputRouter`, pointer routing, `toolFor()`, palm rejection. **Bridge mode hooks in here** (SPEC 4.6).
- `src/ink/tools.ts`: `createSession()`, `ToolSession`, `InputPt`. **Onyx strokes are replayed through this.**
- `src/ink/surface.ts`: `InkSurface`, `toPage()`, the wet/base canvases, `lowLatency`.
- `src/settings.ts`: settings normaliser. New keys need validation here.
- `src/obsidian/settingsTab.ts`: settings UI.
- `src/obsidian/inkView.ts`, `src/main.ts`: view lifecycle and plugin entry (where the bridge is created and destroyed, and region updates are hooked).
- `src/core/`: pure logic with unit tests in `tests/`.

Companion:
- `OverlayShowingService.kt`: overlay `SurfaceView`, `TouchHelper`, `RawInputCallback`, watchdog.
- `StrokeWebSocketServer.kt`: WS server, protocol.
- Upstream Obsidian bridge for reference: `companion/obsidian-plugin/main.js`. It contains the coordinate maths, keyboard detection and palm-guard ideas.

## Guardrails

- **Never lose ink.** Every path in bridge mode must end in a committed stroke (Onyx replay or pointer fallback) or an explicit cancel by the user.
- The bridge must be fully inert on desktop, iOS, non-Onyx Android, in tests and in the harness.
- Don't add network calls other than `ws://127.0.0.1`.
- Don't bump dependency major versions without a decision record.
- Don't publish releases or push to remotes unless asked.
