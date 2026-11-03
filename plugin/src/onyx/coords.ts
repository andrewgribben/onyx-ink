// AGPL-3.0-or-later. Part of the Onyx Ink fork (Singularity Notebook) of Ink Notebook, modified by Andrew Gribben, 2026.

export type XY = { x: number; y: number };

export function screenToClient(
  px: number,
  py: number,
  ox: number,
  oy: number,
  dpr: number,
  webviewLeft = 0,
  webviewTop = 0,
  calibration: XY = { x: 0, y: 0 },
): XY {
  return { x: (px + ox) / dpr - webviewLeft + calibration.x, y: (py + oy) / dpr - webviewTop + calibration.y };
}

export function clientToScreen(
  x: number,
  y: number,
  ox: number,
  oy: number,
  dpr: number,
  webviewLeft = 0,
  webviewTop = 0,
  calibration: XY = { x: 0, y: 0 },
): XY {
  return { x: (x - calibration.x + webviewLeft) * dpr - ox, y: (y - calibration.y + webviewTop) * dpr - oy };
}

export function webviewOffset(
  screen: { width: number; height: number },
  inner: { width: number; height: number },
): XY {
  const x = screen.width - inner.width;
  const y = screen.height - inner.height;
  return { x: x >= 0 && x < 120 ? x : 0, y: y >= 0 && y < 120 ? y : 0 };
}

export function pressure(value: number, pressureMax = 4096, enabled = true): number {
  if (!enabled) return 0.5;
  const max = Number.isFinite(pressureMax) && pressureMax > 0 ? pressureMax : 4096;
  return Math.max(0.05, Math.min(1, value / max));
}

export function timestamps(points: readonly (readonly number[])[], version: 1 | 2, durationMs?: number): number[] {
  if (version === 2) {
    const first = points[0]?.[3] ?? 0;
    return points.map((point) => point[3] - first);
  }
  const step = durationMs !== undefined && points.length > 1 ? durationMs / (points.length - 1) : 8;
  return points.map((_, index) => index * step);
}
