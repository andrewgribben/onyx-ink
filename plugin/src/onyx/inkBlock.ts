// AGPL-3.0-or-later. Part of the Onyx Ink fork (Singularity Notebook) of Ink Notebook, modified by Andrew Gribben, 2026.

import { serializeInkFile, withInkFrontmatter } from "../core/ink/codec";
import { strokeBounds } from "../core/ink/geom";
import { emptyPage, EMPTY_META, type Page } from "../core/ink/model";
import { DEFAULT_PAPER, type PaperSpec } from "../core/paper";

const MIN_HEIGHT = 600;
/** Free space kept below the lowest ink, page units (a couple of lines of handwriting). */
const SPACE_BELOW = 250;
/** Grow once ink comes this close to the bottom. */
const GROW_AT = 150;

/** Height a block should have: the lowest ink plus some room, never below 600, in steps of 50. */
export function inkBlockHeight(page: Page): number {
  let lowest = 0;
  for (const stroke of page.strokes) {
    const bounds = strokeBounds(stroke);
    lowest = Math.max(lowest, bounds.y + bounds.h);
  }
  for (const text of page.texts) lowest = Math.max(lowest, text.y + text.h);
  return Math.max(MIN_HEIGHT, Math.ceil((lowest + SPACE_BELOW) / 50) * 50);
}

/** New height while writing: grow when ink nears the bottom, otherwise keep the page as it is (no jumps under the pen). */
export function inkBlockGrowTo(page: Page): number {
  const target = inkBlockHeight(page);
  return target - SPACE_BELOW + GROW_AT > page.h ? Math.max(page.h, target) : page.h;
}

/** A new block file: one 1000 x 600 page on the given paper (the plugin's default paper for new pages). */
export function createInkBlockText(paper: PaperSpec = DEFAULT_PAPER): string {
  const page = emptyPage({ kind: "paper", paper: { ...paper, orientation: "portrait" } }, 1000, 600);
  const frontmatter = withInkFrontmatter("", { "ink-block": "true" });
  return serializeInkFile(frontmatter, { doc: { pages: [page] }, meta: EMPTY_META });
}

