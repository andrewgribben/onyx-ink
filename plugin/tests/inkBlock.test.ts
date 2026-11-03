// AGPL-3.0-or-later. Part of the Onyx Ink fork (Singularity Notebook) of Ink Notebook, modified by Andrew Gribben, 2026.

import { describe, expect, it } from "vitest";
import { parseInkFile } from "../src/core/ink/codec";
import { emptyPage, makeStroke } from "../src/core/ink/model";
import { createInkBlockText, inkBlockGrowTo, inkBlockHeight } from "../src/onyx/inkBlock";

describe("inline ink blocks", () => {
  it("creates a round-trippable 1000 by 600 page on the default paper with block frontmatter", () => {
    const parsed = parseInkFile(createInkBlockText());
    expect(parsed.doc.pages).toHaveLength(1);
    expect(parsed.doc.pages[0]).toMatchObject({
      w: 1000,
      h: 600,
      bg: { kind: "paper", paper: { style: "lined" } },
    });
    expect(parsed.frontmatter).toMatch(/^---\n[\s\S]*^ink-notebook: 1$/m);
    expect(parsed.frontmatter).toMatch(/^ink-block: true$/m);
  });

  it("grows near the bottom and sizes to the ink plus room", () => {
    const paper = { kind: "paper" as const, paper: { style: "blank" as const, spacing: "normal" as const,
      color: "white" as const, orientation: "portrait" as const } };
    const base = emptyPage(paper, 1000, 600);
    const at = (y: number) => makeStroke({ pen: "fountain", color: "#000000", width: 2, pts: new Float32Array([10, y, 0.5]) });
    expect(inkBlockHeight(base)).toBe(600);
    expect(inkBlockGrowTo({ ...base, strokes: [at(300)] })).toBe(600);
    expect(inkBlockGrowTo({ ...base, strokes: [at(500)] })).toBe(700);
    expect(inkBlockHeight({ ...base, h: 1814, strokes: [at(1322)] })).toBe(1500);
    expect(inkBlockGrowTo({ ...base, h: 1814, strokes: [at(1322)] })).toBe(1814);
  });

});
