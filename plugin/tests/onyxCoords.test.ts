// AGPL-3.0-or-later. Part of the Onyx Ink fork (Singularity Notebook) of Ink Notebook, modified by Andrew Gribben, 2026.

import { describe, expect, it } from "vitest";
import { clientToScreen, pressure, screenToClient, timestamps, webviewOffset } from "../src/onyx/coords";

describe("Onyx coordinate mapping", () => {
  it.each([1, 2, 2.5])("round trips at DPR %s with offsets and calibration", (dpr) => {
    const client = screenToClient(300, 420, 10, 20, dpr, 8, 12, { x: 3, y: -4 });
    expect(clientToScreen(client.x, client.y, 10, 20, dpr, 8, 12, { x: 3, y: -4 })).toEqual({ x: 300, y: 420 });
  });

  it("trusts only WebView gaps from zero to 119 CSS pixels", () => {
    expect(webviewOffset({ width: 119, height: 0 }, { width: 0, height: 0 })).toEqual({ x: 119, y: 0 });
    expect(webviewOffset({ width: 120, height: 119 }, { width: 0, height: 0 })).toEqual({ x: 0, y: 119 });
    expect(webviewOffset({ width: 80, height: 140 }, { width: 100, height: 0 })).toEqual({ x: 0, y: 0 });
  });

  it("clamps pressure and uses a neutral value when pressure is disabled", () => {
    expect(pressure(0)).toBe(0.05);
    expect(pressure(5000)).toBe(1);
    expect(pressure(100, 0)).toBeCloseTo(0.05);
    expect(pressure(0, 4096, false)).toBe(0.5);
  });

  it("uses relative v2 times and synthesises v1 times", () => {
    expect(timestamps([[0, 0, 0, 100000], [0, 0, 0, 100013]], 2)).toEqual([0, 13]);
    expect(timestamps([[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], 1)).toEqual([0, 8, 16]);
    expect(timestamps([[0, 0, 0, 0], [0, 0, 0, 0]], 1, 30)).toEqual([0, 30]);
  });
});
