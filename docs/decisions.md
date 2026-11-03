# Decisions

## 2026-11-03: Inline block design details (M5)
**Decision:** Blocks are `![[Name.ink]]` embeds of `.ink.md` files marked `ink-block: true`. They have a small control row, ignore touch so the note scrolls, grow 300 page units at a time, and save about 1 s after a change. The region protocol gains an optional `rects` list. Details are in SPEC 4.10.
**Why:** An embed keeps notes readable in upstream Ink Notebook, which shows a preview. A frontmatter flag stops ordinary embedded pages becoming writable by accident. A list of rects lets several blocks on screen get instant ink. Made while the owner was away, at their request to keep working. Each piece is a separate commit, so it's easy to change.
**Alternatives:** A new `ink-block` code block (rejected: upstream would show raw text). Every embedded ink page writable (rejected: accidental edits). The full toolbar in each block (rejected: too heavy for a block in a note).

## 2026-11-03: Start M3 with some M2 device checks outstanding
**Decision:** Move on to M3 while these M2 checks wait for the owner: the 200-stroke count, palm rejection, lasso and OCR, and the slow input after double-tap zoom. They stay open in `docs/progress.md`, and M2 isn't marked done until they pass.
**Why:** The owner asked for work to carry on without waiting on device checks, with a commit at each stage so anything can be rolled back. The core of M2 is confirmed on the device: instant ink, matching, fallback, position within 1 px, no duplicates in normal use.
**Alternatives:** Wait for the checks (rejected by the owner: it stalls work while they're away).

## 2026-11-03: Inline ink blocks as milestone M5
**Decision:** Add inline handwriting blocks inside notes (SPEC 4.10, M5), after M3. Blocks are page width and grow downwards. Each block is its own `.ink.md` file and can be expanded to a full page.
**Why:** The owner wants to write directly in notes like the Ink plugin, without losing full pages. Blocks need M2 replay and M3 regions, so building them earlier would mean doing that work twice. Own files keep the format upstream-compatible.
**Alternatives:** Use the Ink plugin (rejected: its own tldraw renderer redraws strokes, two engines). Infinite canvas blocks (rejected: more work, further from the page model). Build M5 before M2/M3 (rejected: rework).

## 2026-11-03: Fork replaces upstream, named Singularity Notebook
**Decision:** The plugin is "Singularity Notebook" (id stays `ink-notebook-onyx`). It replaces upstream Ink Notebook rather than running alongside it.
**Why:** The owner doesn't use upstream. Running both can't work without bigger upstream edits: both register view type `ink-notebook` and the `ink-notebook` / `ink-figure` code blocks (part of the file format), and both claim the same `.ink.md` files. A separate id still matters so Obsidian's updater never installs upstream over the fork.
**Alternatives:** Reuse id `ink-notebook` (rejected: upstream updates would overwrite the fork). Own view type plus skipped duplicate registrations so both can run (rejected: work for a case nobody needs).

## 2026-11-03: Replay Onyx strokes through `ToolSession`, not swap-after
**Decision:** In bridge mode, Ink Notebook doesn't draw pen or marker ink live. It buffers pointer points, then replays the matching Onyx stroke (or the buffered pointer points as a fallback) through `createSession().move().up()`.
**Why:** Upstream `ink-onyx-bridge` lets Excalidraw draw a laggy stroke and then swaps it out. That means two renders and extra e-ink refreshes, and the late-sweep heuristics can delete the wrong strokes. Ink Notebook has a clean `ToolSession` API, so replaying gives exactly one committed stroke, through the normal path (undo, autosave, OCR).
**Alternatives:** Swap-after, as upstream does (simpler, but doubles the work and is fragile). Creating sessions straight from WebSocket input without pointer events (rejected: no fallback if the companion dies).

## 2026-11-03: Single repo with git subtrees
**Decision:** `plugin/` and `companion/` are imported with `git subtree --squash`.
**Why:** One place for the spec and agents. Upstream changes can still be pulled. Simpler for agents than submodules.
