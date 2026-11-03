# Onyx Ink

Low-latency Boox pen input for the [Ink Notebook](https://github.com/stefanmayer06/Obsidian-writing-for-eink) Obsidian plugin. A companion Android app captures strokes with the Onyx Pen SDK and draws them instantly on the e-ink panel. It also streams them over a local WebSocket to a fork of Ink Notebook, which saves them as normal ink.

- `plugin/`: Ink Notebook fork (Obsidian plugin `ink-notebook-onyx`). **AGPL-3.0-or-later**, © Stefan Mayer and Onyx Ink contributors.
- `companion/`: fork of [boox-rapid-draw-ink](https://github.com/rainyluna/boox-rapid-draw-ink). **MIT**, © Sergey Lappo, rainyluna and Onyx Ink contributors.

Each directory keeps its own licence.

Status: in development. See `SPEC.md` for the design and milestones, `AGENTS.md` for how to work on the repo, and `docs/progress.md` for status.
