# Onyx Ink — Spec

Low-latency Boox pen input for the **Ink Notebook** Obsidian plugin, using a companion Android app that streams Onyx Pen SDK strokes to the plugin.

Status: draft v1 (2026-11-03). Owner: Andrew Gribben.

---

## 1. Goal

Writing on an Ink Notebook page in Obsidian on a Boox Note Air 5C should feel like the Boox Notes app. Ink appears under the nib immediately, with no e-ink lag. Ink Notebook's file format, toolbar, OCR, Text side, embeds and everything else keep working unchanged.

### Non-goals (v1)

- Writing directly over Markdown text in the normal editor. Handwriting goes on ink pages or in inline ink blocks between paragraphs (section 4.10, milestone M5), never on top of typed text.
- Excalidraw support. Upstream `ink-onyx-bridge` already does that.
- iOS, desktop, or non-Onyx Android. The plugin must still work there, with the bridge inactive.
- Any change to the `.ink.md` file format. Files must stay readable by upstream Ink Notebook.

---

## 2. Prior art (vendored in this repo)

| Dir | Upstream | Licence | Pinned commit |
|---|---|---|---|
| `plugin/` | [stefanmayer06/Obsidian-writing-for-eink](https://github.com/stefanmayer06/Obsidian-writing-for-eink) (Ink Notebook 2.3.2) | AGPL-3.0-or-later | `40f8c7a` |
| `companion/` | [rainyluna/boox-rapid-draw-ink](https://github.com/rainyluna/boox-rapid-draw-ink) v0.2.0 (a fork of sergeylappo/boox-rapid-draw) | MIT | `22a7d83` |

Both directories were added with `git subtree --squash`. Section 9 covers pulling upstream changes.

### How the companion works today (`companion/app/src/main/kotlin/com/sergeylappo/booxrapiddraw/`)

- `OverlayShowingService` adds a full-screen, transparent, **non-touchable** `TYPE_APPLICATION_OVERLAY` `SurfaceView`. It attaches an Onyx `TouchHelper` (`openRawDrawing`, `setLimitRect(fullScreen, [])`, `STROKE_STYLE_PENCIL`, black, width 3) to that view. The EPD controller draws ink instantly, and the pen's `PointerEvent`s still reach the app underneath.
- `RawInputCallback` collects each stroke's points as `[x, y, pressure, 0]`, so the timestamp is always 0. After `onEndRawDrawing` it waits 80 ms for the SDK's full `TouchPointList`, then calls `StrokeWebSocketServer.broadcastStroke`.
- `StrokeWebSocketServer` listens on `ws://127.0.0.1:8765` and sends
  `{"type":"stroke","w","h","ox","oy","pts":[[x,y,p,t],...]}`. Points are in physical pixels relative to the overlay; `ox`/`oy` are the overlay's on-screen origin. It accepts `{"type":"pause"|"resume"}`.
- A watchdog re-claims raw input every 3 s, because the Onyx keyboard and Notes can steal it.
- Raw erasing callbacks are ignored.
- Pressure is roughly 0–4096. The upstream plugin divides by 4096.

### How Ink Notebook takes input today (`plugin/src/ink/`)

- `input.ts` → `InputRouter` listens for `pointerdown/move/rawupdate/up/cancel` on the surface. `toolFor(e)` maps the pen's eraser end (`buttons & 32`) and side button (`buttons & 2`) to tools, and touch gives palm rejection and gestures.
- `tools.ts` → `createSession(surface, tool, firstPt, {isPen, ctrl})` returns a `ToolSession` with `move(InputPt[])`, `up(InputPt|null)` and `cancel()`. `InputPt = {x, y, p, t, cx, cy}`: page coordinates, pressure 0–1, time in ms, and client CSS px.
- `surface.ts` → `InkSurface.toPage(clientX, clientY, rect)` converts client coordinates to page coordinates. While a session is active, live ink is drawn to the `wet` canvas.
- The `lowLatency` setting (`auto|on|off`) controls a `desynchronized` canvas. Section 4.6 covers how it interacts with the bridge.

**This means `ToolSession` is the clean place to inject strokes.** Onyx points can be turned into `InputPt`s and replayed through `createSession(...).move(...).up(...)`. That gives the same stroke model, undo, autosave and OCR as native input.

---

## 3. Architecture

```
┌─────────────── Boox (Android) ───────────────────────────────────────┐
│                                                                      │
│  companion/ (Singularity Notebook Companion APK)                     │
│   Overlay SurfaceView + TouchHelper ──► EPD draws ink instantly      │
│   RawInputCallback ──► stroke msg ──► WS server 127.0.0.1:8765        │
│        ▲  region / style / pause / resume / refresh                  │
│        │                                         │ hello/stroke/state │
│  ──────┼─────────────────────────────────────────┼─────────────────  │
│        │                                         ▼                   │
│  Obsidian (WebView)                                                  │
│   plugin/ (Singularity Notebook, fork of Ink Notebook)               │
│     src/onyx/bridge.ts   WS client, handshake, reconnect             │
│     src/onyx/coords.ts   screen px ⇄ client CSS px (pure)            │
│     src/onyx/matcher.ts  pair pointer stroke ⇄ Onyx stroke (pure)    │
│     src/onyx/region.ts   surface rect − UI rects → limit rects       │
│     InputRouter (bridge mode) ──► createSession().move().up()        │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 4. Plugin changes (`plugin/`)

### 4.1 Identity

- `manifest.json`: `id: "ink-notebook-onyx"`, `name: "Singularity Notebook"`. Keep `author` and add a fork note to `description`. The fork **replaces** upstream Ink Notebook: uninstall upstream first; running both at once is not supported (they share view type, code block processors and file handling). The own id stops Obsidian's updater installing upstream releases over the fork.
- Keep `LICENSE` (AGPL) and the upstream copyright. Add a "Modified by" notice to the README and to the header of every new file.
- `.ink.md` reading and writing must stay byte-compatible with upstream.

### 4.2 `src/onyx/protocol.ts`: message types and parsing (pure, unit-tested)

TypeScript types for the protocol in section 6. `parseMessage(raw: string)` returns a typed message or `null` and never throws. It must accept **v1** stroke messages (no `v`, `t = 0`) from the unmodified upstream APK.

### 4.3 `src/onyx/bridge.ts`: connection

- Connect to `ws://127.0.0.1:<port>` (default 8765). Reconnect with exponential backoff from 1 s up to 15 s.
- Only try to connect when `Platform.isAndroidApp` is true and the bridge setting isn't `off`.
- Expose `state`: `disconnected | connected | active | paused`. It is `active` only when connected, the companion reports raw drawing enabled, and the plugin has sent a region.
- Emit `stroke` events with parsed points. Provide `send(msg)`.
- Keep stats (`rx`, `matched`, `fallbacks`, `orphans`, `errors`, last 20 events) for a debug command.
- If 20 errors or a handler taking more than 250 ms occurs, disable the bridge for the session and show a `Notice`. This follows upstream's "safe" approach.

### 4.4 `src/onyx/coords.ts`: coordinate mapping (pure, unit-tested)

```
clientX = (px + ox) / dpr - webviewLeft
clientY = (py + oy) / dpr - webviewTop
```

- `dpr = window.devicePixelRatio`.
- `webviewTop`/`webviewLeft`: the WebView's position on the physical screen in CSS px. Upstream found that on the Note Air 5C, Obsidian is edge-to-edge, so this is 0. They estimate it from `screen.height - innerHeight` and only trust gaps under 120 px, because larger gaps mean the keyboard is open. Use the same estimate, and add a calibration offset (x, y) in settings.
- Page coordinates come from the existing `surface.toPage(clientX, clientY, rect)`.
- Pressure: `p / pressureMax`, clamped to [0.05, 1]. `pressureMax` comes from `hello`, default 4096. If `settings.pressure` is false, use 0.5, as `InputRouter.point` does.
- Time: use the `t` values from `hello`/`stroke` (v2). For v1 (t = 0), make up evenly spaced times across the pointer stroke's duration, or 8 ms apart if there's no pointer stroke.

### 4.5 `src/onyx/matcher.ts`: pairing strokes (pure, unit-tested)

The pen still produces `PointerEvent`s while the Onyx overlay is active. Every physical stroke therefore arrives twice: as pointer events, which come first but are laggy, and as an Onyx stroke, which arrives about 80–150 ms after pen-up.

- A pointer stroke and an Onyx stroke **match** when the Onyx stroke arrives within `matchWindowMs` (default 600) of pointer-up **and** their client-space bounding boxes overlap after a 24 CSS px pad. If several qualify, pick the earliest unmatched one.
- Return one of: `matched(pointerId, onyxStroke)`, `fallback(pointerStroke)` (the timeout passed with no Onyx stroke), or `orphan(onyxStroke)` (an Onyx stroke with no pointer stroke).

### 4.6 `InputRouter` bridge mode (`src/ink/input.ts`)

Bridge mode applies when **all** of these are true: `bridge.state === "active"`, `e.pointerType === "pen"`, and `toolFor(e)` is `pen` or `marker` (not eraser, lasso, shape, text, fill or stamp, and no button flags).

In bridge mode:

1. **pointerdown**: don't call `createSession`. Start a `PendingPenStroke` that buffers `InputPt`s, and keep the existing link-chip check. Don't draw to the `wet` canvas, because the EPD overlay is already showing the ink.
2. **pointermove / rawupdate**: buffer the points. Update `lastPenTime` so palm rejection still works.
3. **pointerup**: hand the pending stroke to the matcher.
   - **matched**: turn the Onyx points into `InputPt`s, then call `createSession(s, tool, first, {isPen:true, ctrl:false})`, then `.move(rest)`, then `.up(last)`.
   - **fallback** (no Onyx stroke within `fallbackMs`, default 350): replay the **buffered pointer points** the same way. **Ink must never be lost.**
4. **orphan** Onyx strokes (for example, pointer events swallowed by a palm cancel): replay them only if the pen was active within 1 s and the stroke's start point is inside the surface rect.
5. **pointercancel**: treat it as pointerup. Upstream already keeps pen ink on cancel.
6. After a replayed stroke is committed, send `{"type":"refresh","rect":…}` so the companion clears that area of the overlay without a full-screen flash. If the SDK makes that impractical, fall back to `setPenUpRefreshTimeMs`; see section 10.

Not in bridge mode (eraser end, side button, lasso, shapes, text, touch, mouse, bridge inactive): **existing code path, unchanged.**

Known trade-off: Ink Notebook's **hold-to-snap shapes** (`HOLD_MS` in `PenSession`) rely on live input. In bridge mode, run snap detection after the fact during replay if that's practical; otherwise document it as unsupported in bridge mode. It must never break.

`lowLatency` interaction: while the bridge is `active`, the `wet` canvas isn't used for pen or marker, so leave the setting as it is. Don't change the canvas options at runtime.

### 4.7 `src/onyx/region.ts`: limit the overlay to the page

The overlay must only draw over the writing area, never over the toolbar, menus, modals, other panes or the Text side.

- **Region** = the active `InkSurface.el`'s bounding rect.
- **Exclude** = bounding rects of visible `.ink-ui` elements inside it, plus any `.modal-container`, `.menu` or `.suggestion-container` on screen.
- Convert to physical screen px using the inverse of section 4.4, and send `{"type":"region",...}`.
- **Re-send** (debounced to 100 ms) on: surface resize, active leaf change, ink view open/close, flip to and from the Text side, toolbar show/hide, page turn, and workspace layout change.
- **Pause** (send `pause` or region `null`) when: no ink surface is visible, a modal, menu or IME is open (reuse upstream's keyboard detection from `ink-onyx-bridge/main.js`), or the current tool isn't pen or marker. **Resume** when those conditions clear.

### 4.8 Style sync

On tool, pen, colour or width change, send `{"type":"style"}` with the on-screen width in physical px (`width × view.scale × dpr`), colour `#rrggbb`, and `kind: pen|marker`. The companion picks the closest Onyx stroke style. This only affects how the instant overlay ink looks; the committed stroke always uses Ink Notebook's own pen rendering.

### 4.9 Settings (in the existing Ink Notebook settings tab, new "Onyx pen" section)

| Setting | Default | Notes |
|---|---|---|
| Onyx pen bridge | `auto` (`auto/on/off`) | `auto` = Android only |
| Port | 8765 | |
| Fallback timeout (ms) | 350 | |
| Match window (ms) | 600 | |
| Calibration offset x/y (CSS px) | 0/0 | |
| Status line | — | Read-only: state, companion version, stats |

Commands: **Toggle Onyx pen bridge**, **Show Onyx bridge diagnostics** (a modal with stats and the last 20 events), **Calibrate Onyx pen** (optional, in M4).

Persist the settings through the existing `src/settings.ts` normaliser, with `oneOf` and `bool` validation for each new key.

---

### 4.10 Inline ink blocks (M5)

Owner decision (2026-11-03): handwriting should also be possible straight inside a note, between paragraphs, like the Ink plugin (Dale de Silva), while still being expandable to a full ink page.

- A command and editor menu item **Insert handwriting block** creates a new ink file (same `.ink.md` format, in the usual ink folder) and inserts a block referencing it at the cursor.
- The block is a live writing surface using the same pen engine (`InkSurface`, `InputRouter`, `ToolSession`), so undo, autosave, OCR and bridge replay work as on a full page.
- Shape: page width, grows downwards as you write (no infinite canvas). Touch scrolls the note; the pen writes.
- **Expand** opens the same file as a full ink page; edits show in both places.
- Works in Live Preview and Reading view. In Source mode the block shows as its reference text.
- Bridge: the block's rect is a region (section 4.7), so Onyx ink only appears inside it.
- Reuse the existing `ink-figure`/embed rendering where possible; new code goes in new files.

Design (2026-11-03, chosen while the owner was away; see `docs/decisions.md`):
- **Reference**: a normal embed `![[Name.ink]]` of a block ink file, so upstream Ink Notebook still shows the page as a preview. A block ink file is an ordinary `.ink.md` file with one extra frontmatter key `ink-block: true` (upstream ignores unknown keys). Only those files render as live blocks; embeds of normal ink pages stay previews.
- **File**: created in the usual ink attachments folder, named `<note name> handwriting <n>.ink.md`. One page 1000 wide, 600 high, on the default paper for new pages (300 was too small to write in; owner 2026-11-03).
- **Height**: the page fits the ink plus 250 page units of room (at least 600, in steps of 50). It grows as soon as ink comes within 150 of the bottom, and shrinks back 4 s after writing stops (it used to grow in big steps and left too much empty space; owner 2026-11-03). Neither is an undo step.
- **Controls**: a small row inside the block (`.ink-ui`): pen, eraser, undo, redo, Expand. The pen uses the plugin's remembered pen settings.
- **Touch**: fingers scroll the note; the block scrolls it itself and keeps `touch-action: none`, because `pan-y` also let the pen scroll the note mid-stroke. The pen and mouse write. A faint dashed line marks the bottom of the block while writing.
- **Full page**: a block file opened in the ink view fits its width (fit page made a grown block a narrow strip) and grows as you write there too.
- **Saving**: the block writes its file about 1 s after a change (`serializeInkFile`) and reloads when the file changes elsewhere, unless it has unsaved strokes. Expand saves first, then opens the ink view.
- **Bridge**: `region` gains an optional `rects` list (every visible block, plus the ink page when one is active); `rect` stays as their bounding box for older companions.

## 5. Companion changes (`companion/`)

1. **Identity**: `applicationId = "com.grib.onyxink"`, app name **Singularity Notebook Companion** (matches the plugin name). Keep the MIT `LICENSE` and add a copyright line. The Kotlin package name can stay for now.
2. **Region support**: handle `region`. Call `touchHelper.setLimitRect(rect, excludeRects)`, with every rect converted from physical screen px to overlay-local px by subtracting the overlay origin. With **no region, raw drawing is disabled by default**. Add an app toggle, "Global mode", that restores upstream's full-screen behaviour for other apps.
3. **Style**: handle `style`. Map it to `setStrokeWidth`, `setStrokeColor` and `setStrokeStyle`: marker → `STROKE_STYLE_MARKER` if available, otherwise pencil, and on colour panels use the closest supported colour.
4. **Refresh**: handle `refresh`. Clear the overlay rect after commit. Investigate `EpdController` partial refresh versus toggling `setRawDrawingRenderEnabled`; see section 10.
5. **Protocol v2 output**: send `hello` on connect and `state` when raw drawing is enabled, paused or stolen (including by the watchdog). Add `id` (a monotonic integer), `v: 2`, real timestamps (`TouchPoint.timestamp`) and the actual eraser state to `stroke`.
6. **Eraser**: don't broadcast raw erasing. The plugin handles eraser input through pointer events.
7. **Security**: keep binding to `127.0.0.1` only. Ignore messages over 64 KB.
8. **Keep**: the watchdog, the foreground notification with a Stop action, and the quick-settings tile.

The changes must stay backward-compatible: v1 clients (upstream `ink-onyx-bridge` for Excalidraw) must keep working when Global mode is on.

---

## 6. Protocol v2

JSON text frames over `ws://127.0.0.1:8765`. Unknown `type`s and fields are ignored on both sides. All screen coordinates are **physical px**.

### Companion → plugin

```jsonc
{"type":"hello","v":2,"app":"onyx-ink-companion","version":"0.1.0",
 "screen":{"w":1860,"h":2480},"pressureMax":4096}

{"type":"state","v":2,"raw":"enabled"|"paused"|"stolen"|"disabled"}
// "enabled" = the pen reader is ready; ink only appears inside the last region (or anywhere in Global mode).
// "paused" = an explicit pause command. A null region is not a pause.

{"type":"stroke","v":2,"id":42,"w":1860,"h":2480,"ox":0,"oy":0,
 "pts":[[x,y,pressure,timestampMs], ...]}
// v1 (upstream) = same minus v/id, timestamps 0
```

### Plugin → companion

```jsonc
{"type":"hello","v":2,"app":"ink-notebook-onyx","version":"x.y.z"}
{"type":"region","rect":[l,t,r,b],"exclude":[[l,t,r,b], ...]}   // rect:null = disable
// optional "rects":[[l,t,r,b], ...] = several writing areas (M5 inline blocks); rect is then their bounding box
{"type":"style","kind":"pen"|"marker","widthPx":3.2,"color":"#000000"}
{"type":"refresh","rect":[l,t,r,b]}
{"type":"pause"} / {"type":"resume"}                             // v1-compatible
```

---

## 7. Milestones and acceptance criteria

Each milestone is a separate branch or PR-sized chunk with its own commits. Don't start the next milestone until the current one's acceptance criteria pass. Order: M0, M1, M2, M3, M5, M4 (M5 was added later; M4 is polish and release, so it goes last).

### M0: Bootstrap
- `cd plugin && npm ci && npm run check` passes (typecheck, vitest, production build).
- `cd companion && ./gradlew assembleDebug` succeeds (JDK 17; AGP 8.7.2 / Gradle 8.9; Onyx Maven repo reachable).
- `scripts/deploy-plugin.sh` (adb push to the vault on the Boox, using `BOOX_VAULT`) and `scripts/deploy-companion.sh` (`installDebug`) exist and work.
- Identity renames done (sections 4.1 and 5.1). The fork installs and loads in place of upstream Ink Notebook (upstream uninstalled).

### M1: Protocol and connection (no behaviour change)
- `protocol.ts`, `coords.ts` and `matcher.ts` have unit tests in `plugin/tests/onyx*.test.ts`, covering v1 and v2 parsing, the round trip and edge cases of coordinate mapping, and every matcher outcome.
- The bridge connects to the **unmodified upstream APK**, and diagnostics show received strokes.
- The companion sends v2 `hello`, `state` and `stroke` messages.
- No change to how ink is drawn.

### M2: Replay (the core feature)
- In bridge mode, a pen stroke on an ink page shows instant Onyx ink, then becomes a normal Ink Notebook stroke in the right place: within 2 CSS px at zoom 1, 2× and when panned.
- Fallback: with the companion stopped mid-session, strokes still commit within about 350 ms, using pointer points.
- Eraser end, side-button eraser and lasso, undo/redo, autosave and OCR all behave as upstream.
- No duplicate strokes after 200 quick strokes (a handwriting test), checked with diagnostics: `matched + fallbacks == pen strokes`.
- Palm rejection still works.

### M3: Region, pause and style
- Writing on the toolbar, menus, modals, the Text side, other panes or with the keyboard open produces **no** Onyx ink.
- Opening and closing an ink page, flipping sides, turning pages and split panes all update the region correctly.
- The overlay stroke width and colour roughly match the selected pen and marker.
- With Global mode on, upstream `ink-onyx-bridge` and Excalidraw still work.

### M4: Polish and release
- Overlay ink is cleared or replaced after commit with no full-screen flash; record the method chosen in `docs/decisions.md`.
- Settings UI, diagnostics modal, optional calibration command.
- `README.md` covers install, setup on the Boox, permissions and troubleshooting.
- A GitHub release with the APK and a plugin zip (`main.js`, `manifest.json`, `styles.css`), installable through BRAT.

---

### M5: Inline ink blocks (section 4.10)
- Insert a handwriting block in a note and write in it with the pen; strokes save to its own `.ink.md` file, readable by upstream Ink Notebook.
- The block grows downwards as you write; finger scrolling of the note still works.
- Expand opens the full page; changes made there show in the block, and the other way round.
- With the bridge active, Onyx ink appears only inside the block and replays as in M2.
- Live Preview and Reading view both work; nothing in the note's Markdown text changes except the inserted reference.

## 8. Testing

- **Unit (vitest)**: all pure `src/onyx/*` modules. Use fixtures recorded from the real device and stored in `plugin/tests/fixtures/onyx/`. Add a hidden debug command that records them.
- **Existing suites**: `npm run check` must stay green. Run `npm run harness` (needs Playwright: `npm i --no-save playwright`) and the e2e suite (Linux/Xvfb) before closing any milestone that changes drawing or input code (M2 onwards). They are upstream developer tests and are not needed to use the plugin. Bridge mode must be off in those environments, since there's no WebSocket.
- **On-device checklist** (`docs/device-test.md`, created in M2 and extended later): the scenarios from the M2 and M3 criteria, run on a Note Air 5C. Record the firmware version and both app versions.
- The Onyx SDK only works on real hardware, so the emulator is useless for pen tests.

---

## 9. Upstream sync

```bash
git subtree pull --prefix plugin    https://github.com/stefanmayer06/Obsidian-writing-for-eink.git main --squash
git subtree pull --prefix companion https://github.com/rainyluna/boox-rapid-draw-ink.git     main --squash
```

To make upstream merges easy, keep fork changes to upstream files **small and well-marked** (`// onyx-ink:` comments). Put new logic in new files (`src/onyx/*`, new Kotlin classes).

---

## 10. Open questions and risks

1. **Clearing the overlay.** Upstream uses `setPenUpRefreshTimeMs(1000)` and disables rendering in `onPenUpRefresh`. Does the Onyx ink disappear cleanly once Ink Notebook has drawn the committed stroke, or does it ghost or flash? Test this on the device in M2, before building M4.
2. **Do pointer events always reach the WebView** while raw drawing is enabled? Upstream's design relies on this (Excalidraw still draws its own stroke). Confirm in M1 with diagnostics.
3. **The colour panel (Kaleido)**: what colours and stroke styles does `TouchHelper` actually render on the 5C?
4. **Pressure range**: confirm 4096 on the Note Air 5C, or read it from the SDK (`EpdController`/`Device`) in `hello`.
5. **The WebView offset** in split screen, floating window or landscape. v1 targets full-screen portrait and landscape only.
6. **Firmware updates** may change SDK behaviour. Record known-good firmware in the README.
7. **Licensing**: the combined repo has two licences. `plugin/` is AGPL-3.0-or-later and `companion/` is MIT. The root README must say so. Don't copy code from `plugin/` into `companion/` or the other way round.
