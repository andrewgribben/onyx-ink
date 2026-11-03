// AGPL-3.0-or-later. Part of the Onyx Ink fork (Singularity Notebook) of Ink Notebook, modified by Andrew Gribben, 2026.

import { describe, expect, it } from "vitest";
import { StrokeMatcher, type OnyxStroke, type PointerStroke } from "../src/onyx/matcher";

const pointer = (id: string, upTime = 100, x = 10): PointerStroke => ({ id, upTime, bbox: { x, y: 10, w: 10, h: 10 } });
const onyx = (arrivalTime = 200, x = 10): OnyxStroke => ({ arrivalTime, bbox: { x, y: 10, w: 10, h: 10 } });

describe("Onyx stroke matching", () => {
  it("matches overlapping pointer and Onyx strokes", () => {
    const matcher = new StrokeMatcher();
    matcher.addPointerStroke(pointer("p1"));
    matcher.addOnyxStroke(onyx());
    expect(matcher.poll(200)[0]).toMatchObject({ type: "matched", pointerId: "p1" });
  });

  it("falls back at the timeout and reports an unmatched Onyx stroke as orphan", () => {
    const matcher = new StrokeMatcher();
    matcher.addPointerStroke(pointer("p1"));
    expect(matcher.poll(449)).toEqual([]);
    expect(matcher.poll(450)[0]).toMatchObject({ type: "fallback", pointerStroke: { id: "p1" } });
    matcher.addOnyxStroke(onyx(451, 100));
    expect(matcher.poll(451)[0]).toMatchObject({ type: "orphan" });
  });

  it("chooses the earliest unmatched pointer and accepts the padded edge", () => {
    const matcher = new StrokeMatcher();
    matcher.addPointerStroke(pointer("early", 100));
    matcher.addPointerStroke(pointer("later", 110));
    matcher.addOnyxStroke(onyx(200, 44));
    expect(matcher.poll(200)[0]).toMatchObject({ type: "matched", pointerId: "early" });
  });

  it("includes the match window edge and drops a late frame after fallback", () => {
    const matcher = new StrokeMatcher();
    matcher.addPointerStroke(pointer("edge", 100));
    matcher.addOnyxStroke(onyx(700));
    expect(matcher.poll(700)[0]).toMatchObject({ type: "matched", pointerId: "edge" });
    const late = new StrokeMatcher();
    late.addPointerStroke(pointer("fallback", 100));
    expect(late.poll(450)[0].type).toBe("fallback");
    late.addOnyxStroke(onyx(800));
    expect(late.poll(800)[0].type).toBe("late");
    late.addOnyxStroke(onyx(2200));
    expect(late.poll(2200)[0].type).toBe("orphan");
  });
});
