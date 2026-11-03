// AGPL-3.0-or-later. Part of the Onyx Ink fork (Singularity Notebook) of Ink Notebook, modified by Andrew Gribben, 2026.

export type CompanionHello = {
  type: "hello";
  v: 2;
  app: string;
  version: string;
  screen: { w: number; h: number };
  pressureMax: number;
};

export type CompanionState = { type: "state"; v: 2; raw: "enabled" | "paused" | "stolen" | "disabled" };
export type StrokePoint = [number, number, number, number];
export type CompanionStroke = {
  type: "stroke";
  v: 1 | 2;
  id?: number;
  w: number;
  h: number;
  ox: number;
  oy: number;
  pts: StrokePoint[];
};
export type CompanionMessage = CompanionHello | CompanionState | CompanionStroke;
export type RectTuple = [number, number, number, number];
export type PluginMessage =
  | { type: "hello"; v: 2; app: string; version: string }
  | { type: "region"; rect: RectTuple | null; exclude: RectTuple[] }
  | { type: "style"; kind: "pen" | "marker"; widthPx: number; color: string }
  | { type: "refresh"; rect: RectTuple }
  | { type: "pause" | "resume" };

const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

function rect(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function parseMessage(raw: string): CompanionMessage | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (!rect(value)) return null;
    const message = value as Record<string, unknown>;
    if (message.type === "hello" && message.v === 2 && typeof message.app === "string" && typeof message.version === "string") {
      const screen = message.screen;
      if (rect(screen) && finite(screen.w) && finite(screen.h) && finite(message.pressureMax)) {
        return {
          type: "hello",
          v: 2,
          app: message.app,
          version: message.version,
          screen: { w: screen.w, h: screen.h },
          pressureMax: message.pressureMax,
        };
      }
    }
    if (message.type === "state" && message.v === 2 && ["enabled", "paused", "stolen", "disabled"].includes(message.raw as string)) {
      return { type: "state", v: 2, raw: message.raw as CompanionState["raw"] };
    }
    if (message.type === "stroke" && (message.v === undefined || message.v === 2)) {
      const version = message.v === 2 ? 2 : 1;
      const validPoints = Array.isArray(message.pts) && message.pts.every((point) =>
        Array.isArray(point) && point.length === 4 && point.every(finite),
      );
      if (finite(message.w) && finite(message.h) && finite(message.ox) && finite(message.oy) && validPoints &&
          (version === 1 || (finite(message.id) && Number.isInteger(message.id)))) {
        return {
          type: "stroke",
          v: version,
          ...(version === 2 ? { id: message.id as number } : {}),
          w: message.w,
          h: message.h,
          ox: message.ox,
          oy: message.oy,
          pts: (message.pts as number[][]).map((point) => [point[0], point[1], point[2], point[3]]),
        };
      }
    }
    return null;
  } catch {
    return null;
  }
}
