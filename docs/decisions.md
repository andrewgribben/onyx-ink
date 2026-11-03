# Decisions

## 2026-11-03: Replay Onyx strokes through `ToolSession`, not swap-after
**Decision:** In bridge mode, Ink Notebook doesn't draw pen or marker ink live. It buffers pointer points, then replays the matching Onyx stroke (or the buffered pointer points as a fallback) through `createSession().move().up()`.
**Why:** Upstream `ink-onyx-bridge` lets Excalidraw draw a laggy stroke and then swaps it out. That means two renders and extra e-ink refreshes, and the late-sweep heuristics can delete the wrong strokes. Ink Notebook has a clean `ToolSession` API, so replaying gives exactly one committed stroke, through the normal path (undo, autosave, OCR).
**Alternatives:** Swap-after, as upstream does (simpler, but doubles the work and is fragile). Creating sessions straight from WebSocket input without pointer events (rejected: no fallback if the companion dies).

## 2026-11-03: Single repo with git subtrees
**Decision:** `plugin/` and `companion/` are imported with `git subtree --squash`.
**Why:** One place for the spec and agents. Upstream changes can still be pulled. Simpler for agents than submodules.
