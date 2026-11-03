// AGPL-3.0-or-later. Part of the Onyx Ink fork (Singularity Notebook) of Ink Notebook, modified by Andrew Gribben, 2026.

import { serializeInkFile, withInkFrontmatter } from "../core/ink/codec";
import { strokeBounds } from "../core/ink/geom";
import { emptyPage, EMPTY_META, type Page } from "../core/ink/model";
import { DEFAULT_PAPER, type PaperSpec } from "../core/paper";

export function inkBlockNeedsGrowth(page: Page): boolean {
  return page.strokes.some((stroke) => {
    const bounds = strokeBounds(stroke);
    return bounds.y + bounds.h >= page.h - 200;
  }) || page.texts.some((text) => text.y + text.h >= page.h - 200);
}

/** A new block file: one 1000 x 600 page on the given paper (the plugin's default paper for new pages). */
export function createInkBlockText(paper: PaperSpec = DEFAULT_PAPER): string {
  const page = emptyPage({ kind: "paper", paper: { ...paper, orientation: "portrait" } }, 1000, 600);
  const frontmatter = withInkFrontmatter("", { "ink-block": "true" });
  return serializeInkFile(frontmatter, { doc: { pages: [page] }, meta: EMPTY_META });
}

