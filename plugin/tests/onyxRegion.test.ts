// AGPL-3.0-or-later. Part of the Onyx Ink fork (Singularity Notebook) of Ink Notebook, modified by Andrew Gribben, 2026.

import { describe, expect, it, vi } from "vitest";
import { decideRegion, onyxStyle, physicalRect, sendOnChange, type RegionRect } from "../src/onyx/region";
import type { InkSurface } from "../src/ink/surface";

const surface: RegionRect = { left: 10, top: 20, right: 210, bottom: 220 };
const viewport = { width: 180, height: 190 };

describe("Onyx region", () => {
  it("clips multiple surfaces and toolbar exclusions to the viewport", () => {
    expect(decideRegion({ surfaces: [surface, { left: 150, top: 50, right: 220, bottom: 100 },
      { left: 200, top: 200, right: 240, bottom: 240 }], excludes: [{ left: 0, top: 0, right: 60, bottom: 45 }], viewport,
      modalOpen: false, keyboardUp: false, focusedInput: false, tool: "pen", dpr: 1,
      calibration: { x: 0, y: 0 } })).toEqual({
      rect: [10, 20, 180, 190], rects: [[10, 20, 180, 190], [150, 50, 180, 100]],
      exclude: [[10, 20, 60, 45]],
    });
  });

  it.each(["modal", "keyboard", "focus", "tool", "missing"])("pauses for %s", (reason) => {
    expect(decideRegion({ surfaces: reason === "missing" ? [] : [surface], excludes: [], viewport,
      modalOpen: reason === "modal", keyboardUp: reason === "keyboard", focusedInput: reason === "focus",
      tool: reason === "tool" ? "text" : "pen",
      dpr: 1.875, calibration: { x: 0, y: 0 } }))
      .toBeNull();
  });

  it("rounds calibrated CSS bounds outwards at 1.875 dpr", () => {
    expect(physicalRect({ left: 1.1, top: 2.1, right: 10.1, bottom: 20.1 }, 1.875, { x: 0, y: 0 }))
      .toEqual([2, 3, 19, 38]);
  });

  it("calculates the on-screen pen or marker width", () => {
    const tools = { tool: "pen", pen: "fountain", color: "#AABBCC", markerColor: "#FFE14D",
      widths: { fountain: 1.8, marker: 16 } };
    expect(onyxStyle({ tools: tools as InkSurface["tools"], view: { scale: 1.25 } as InkSurface["view"], dpr: 1.875 }))
      .toEqual({ type: "style", kind: "pen", widthPx: 4.2, color: "#aabbcc" });
    tools.tool = "marker";
    expect(onyxStyle({ tools: tools as InkSurface["tools"], view: { scale: 1.25 } as InkSurface["view"], dpr: 1.875 }))
      .toEqual({ type: "style", kind: "marker", widthPx: 37.5, color: "#ffe14d" });
  });

  it("sends only when the JSON value changes", () => {
    const send = vi.fn();
    let last = sendOnChange("", { type: "region", rect: [1, 2, 3, 4] }, send);
    last = sendOnChange(last, { type: "region", rect: [1, 2, 3, 4] }, send);
    sendOnChange(last, { type: "region", rect: [2, 2, 3, 4] }, send);
    expect(send).toHaveBeenCalledTimes(2);
  });
});
