// AGPL-3.0-or-later. Part of the Onyx Ink fork (Singularity Notebook) of Ink Notebook, modified by Andrew Gribben, 2026.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { onyxToClientPoints } from "../src/onyx/replayPoints";
import { parseMessage, type CompanionHello, type CompanionStroke } from "../src/onyx/protocol";

const frames = JSON.parse(readFileSync(join(__dirname, "fixtures/onyx/noteair5c-v2-landscape-12-strokes.json"), "utf8")) as string[];
const hello = parseMessage(frames[0]) as CompanionHello;
const strokes = frames.slice(2).map((frame) => parseMessage(frame) as CompanionStroke);

describe("Onyx replay points", () => {
  it("converts all fixture strokes without losing points or screen bounds", () => {
    expect(strokes).toHaveLength(12);
    for (const stroke of strokes) {
      const points = onyxToClientPoints(stroke, {
        dpr: 1,
        webview: { x: 0, y: 0 },
        calibration: { x: 0, y: 0 },
        pressureOn: true,
        hello,
        t0: 123,
        toPage: (cx, cy) => ({ x: cx, y: cy }),
      });
      expect(points).toHaveLength(stroke.pts.length);
      expect(points[0].t).toBe(123);
      expect(points.every((point, index) => index === 0 || point.t >= points[index - 1].t)).toBe(true);
      expect(points.every((point) => point.p >= 0.05 && point.p <= 1)).toBe(true);
      expect(points.every((point) => point.cx >= 0 && point.cx <= 2480 && point.cy >= 0 && point.cy <= 1860)).toBe(true);
    }
  });

  it("maps a recorded point at double density and includes the overlay origin", () => {
    const first = strokes[0].pts[0];
    const point = onyxToClientPoints(strokes[0], {
      dpr: 2,
      webview: { x: 0, y: 0 },
      calibration: { x: 0, y: 0 },
      pressureOn: true,
      hello,
      t0: 9,
      toPage: (cx, cy) => ({ x: cx, y: cy }),
    })[0];
    expect(point.cx).toBeCloseTo(first[0] / 2);
    expect(point.cy).toBeCloseTo((first[1] + 62) / 2);
    expect(point.p).toBeCloseTo(first[2] / 4096);
  });
});
