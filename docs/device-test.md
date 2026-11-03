# On-device test checklist

Run on a Boox Note Air 5C with the plugin and companion deployed (`scripts/deploy-plugin.sh`, `scripts/deploy-companion.sh`). Record the date, firmware, plugin version and companion version for each run.

Before each run: fully close and reopen Obsidian, start Singularity Notebook Companion, open an ink page.

## M2: Replay

| # | Check | How | Pass when |
|---|---|---|---|
| 1 | Instant ink | Write 10 short words | Every stroke shows ink under the nib with no lag |
| 2 | Becomes a real stroke | Write, wait 1 s, undo, redo | The stroke undoes and redoes like a normal Ink Notebook stroke |
| 3 | Position at zoom 1 | Write over a ruled line, then diagnostics | Stroke sits where you wrote; diagnostics offset within 2 CSS px |
| 4 | Position zoomed and panned | Double-tap to zoom 2x, pan, write | Same as 3 |
| 5 | Fallback | Stop the companion (notification > Stop), write 5 strokes | All 5 strokes appear within about half a second |
| 6 | Eraser end | Flip the pen and erase | Erases as upstream (no Onyx ink) |
| 7 | Side button | Hold the side button and write | Erases or lassos as set in settings |
| 8 | Lasso, shapes, text | Use each tool | Behave as upstream |
| 9 | Autosave and OCR | Write, close the page, reopen; flip to Text | Strokes kept; transcription works if Azure is set up |
| 10 | No duplicates | Write 200 quick strokes (a paragraph), open diagnostics | matched + fallbacks = pen strokes; no doubled strokes on the page |
| 11 | Palm rejection | Rest your palm while writing | Palm doesn't pan, zoom or draw |

## Runs

(none yet)
