// AGPL-3.0-or-later. Part of the Onyx Ink fork (Singularity Notebook) of Ink Notebook, modified by Andrew Gribben, 2026.

import { serializeInkFile, withInkFrontmatter } from "../core/ink/codec";
import { strokeBounds } from "../core/ink/geom";
import { emptyPage, EMPTY_META, type Page } from "../core/ink/model";

export function inkBlockNeedsGrowth(page: Page): boolean {
  return page.strokes.some((stroke) => {
    const bounds = strokeBounds(stroke);
    return bounds.y + bounds.h >= page.h - 200;
  }) || page.texts.some((text) => text.y + text.h >= page.h - 200);
}

export function createInkBlockText(): string {
  const paper = { kind: "paper" as const, paper: { style: "blank" as const, spacing: "normal" as const,
    color: "white" as const, orientation: "portrait" as const } };
  const page = emptyPage(paper, 1000, 600);
  const frontmatter = withInkFrontmatter("", { "ink-block": "true" });
  return serializeInkFile(frontmatter, { doc: { pages: [page] }, meta: EMPTY_META });
}

