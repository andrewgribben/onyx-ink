// AGPL-3.0-or-later. Part of the Onyx Ink fork (Singularity Notebook) of Ink Notebook, modified by Andrew Gribben, 2026.

import { describe, expect, it } from "vitest";
import { parseInkFile } from "../src/core/ink/codec";
import { emptyPage, makeStroke } from "../src/core/ink/model";
import { createInkBlockText, inkBlockNeedsGrowth } from "../src/onyx/inkBlock";

describe("inline ink blocks", () => {
  it("creates a round-trippable blank 1000 by 600 page with block frontmatter", () => {
    const parsed = parseInkFile(createInkBlockText());
    expect(parsed.doc.pages).toHaveLength(1);
    expect(parsed.doc.pages[0]).toMatchObject({
      w: 1000,
      h: 600,
      bg: { kind: "paper", paper: { style: "blank" } },
    });
    expect(parsed.frontmatter).toMatch(/^---\n[\s\S]*^ink-notebook: 1$/m);
    expect(parsed.frontmatter).toMatch(/^ink-block: true$/m);
  });

  it("grows when a stroke or text box reaches the bottom margin", () => {
    const paper = { kind: "paper" as const, paper: { style: "blank" as const, spacing: "normal" as const,
      color: "white" as const, orientation: "portrait" as const } };
    const base = emptyPage(paper, 1000, 600);
    const text = { id: "t", x: 0, y: 370, w: 100, h: 20, text: "x", size: 20, color: "#000000" };
    expect(inkBlockNeedsGrowth({ ...base, texts: [text] })).toBe(false);
    expect(inkBlockNeedsGrowth({ ...base, texts: [{ ...text, y: 390 }] })).toBe(true);
    const stroke = makeStroke({ pen: "fountain", color: "#000000", width: 2, pts: new Float32Array([10, 410, 0.5]) });
    expect(inkBlockNeedsGrowth({ ...base, strokes: [stroke] })).toBe(true);
  });
});
