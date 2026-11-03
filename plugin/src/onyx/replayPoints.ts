// AGPL-3.0-or-later. Part of the Onyx Ink fork (Singularity Notebook) of Ink Notebook, modified by Andrew Gribben, 2026.

import { screenToClient, pressure, timestamps, type XY } from "./coords";
import type { InputPt } from "../ink/tools";
import type { CompanionHello, CompanionStroke } from "./protocol";

export type ReplayEnvironment = {
  dpr: number;
  webview: XY;
  calibration: XY;
  pressureOn: boolean;
  hello: CompanionHello | null;
  t0: number;
  durationMs?: number;
  toPage: (cx: number, cy: number) => { x: number; y: number };
};

export function onyxToClientPoints(stroke: CompanionStroke, env: ReplayEnvironment): InputPt[] {
  const times = timestamps(stroke.pts, stroke.v, env.durationMs);
  return stroke.pts.map(([x, y, rawPressure], index) => {
    const client = screenToClient(x, y, stroke.ox, stroke.oy, env.dpr, env.webview.x, env.webview.y, env.calibration);
    const page = env.toPage(client.x, client.y);
    return {
      ...page,
      p: pressure(rawPressure, env.hello?.pressureMax ?? 4096, env.pressureOn),
      t: env.t0 + times[index],
      cx: client.x,
      cy: client.y,
    };
  });
}

export function clientBBox(points: readonly Pick<InputPt, "cx" | "cy">[]): { x: number; y: number; w: number; h: number } {
  if (points.length === 0) return { x: 0, y: 0, w: 0, h: 0 };
  const xs = points.map((point) => point.cx);
  const ys = points.map((point) => point.cy);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}
