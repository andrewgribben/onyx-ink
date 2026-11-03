// AGPL-3.0-or-later. Part of the Onyx Ink fork (Singularity Notebook) of Ink Notebook, modified by Andrew Gribben, 2026.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const setup = vi.hoisted(() => ({ bridge: null as any, settings: null as any }));
const sessions = vi.hoisted(() => ({ calls: [] as any[], throwOnOnyx: false }));

vi.mock("../src/onyx/state", () => ({
  onyxBridge: () => setup.bridge,
  onyxSettings: () => setup.settings,
}));
vi.mock("../src/ink/tools", () => ({
  createSession: (_surface: unknown, tool: string, first: unknown) => {
    sessions.calls.push({ tool, first, moved: [] });
    const call = sessions.calls[sessions.calls.length - 1];
    return {
      move: (points: unknown[]) => {
        call.moved = points;
        if (sessions.throwOnOnyx && tool === "pen" && (first as any).cx > 95) throw new Error("replay failed");
      },
      up: (last: unknown) => { call.last = last; },
      cancel: () => undefined,
    };
  },
}));

import { OnyxBridge } from "../src/onyx/bridge";
import { OnyxPenReplay } from "../src/onyx/replay";

class FakeSocket {
  readyState = 0;
  onopen: ((event: unknown) => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  onclose: ((event: unknown) => void) | null = null;
  send(): void {}
  close(): void { this.readyState = 3; this.onclose?.({}); }
  open(): void { this.readyState = 1; this.onopen?.({}); }
  frame(value: unknown): void { this.onmessage?.({ data: JSON.stringify(value) }); }
}

const rect = { left: 0, top: 0, right: 200, bottom: 200, width: 200, height: 200 } as DOMRect;
const point = (cx: number, cy: number, t = 10) => ({ x: cx, y: cy, p: 0.5, t, cx, cy });
const event = (values: Partial<PointerEvent> = {}) => ({
  pointerId: 1,
  pointerType: "pen",
  buttons: 1,
  button: 0,
  timeStamp: 10,
  ...values,
}) as PointerEvent;

function create() {
  const socket = new FakeSocket();
  const bridge = new OnyxBridge(8765, "on", "1", () => socket, true);
  setup.bridge = bridge;
  setup.settings = { onyxFallbackMs: 350, onyxMatchWindowMs: 600, onyxCalibrationX: 0, onyxCalibrationY: 0 };
  socket.open();
  const surface = {
    el: { getBoundingClientRect: () => rect },
    settings: { pressure: true },
    tools: { tool: "pen" },
    toPage: (cx: number, cy: number) => ({ x: cx, y: cy }),
  } as any;
  const replay = new OnyxPenReplay(surface);
  socket.frame({ type: "state", v: 2, raw: "enabled" });
  bridge.send({ type: "region", rect: [0, 0, 200, 200], exclude: [] });
  return { bridge, replay, socket };
}

function onyx(socket: FakeSocket, x = 100) {
  socket.frame({ type: "stroke", v: 2, id: 1, w: 300, h: 300, ox: 0, oy: 0, pts: [[x, 100, 2048, 500], [x + 2, 101, 2048, 508]] });
}

describe("Onyx pen replay", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(1000);
    vi.stubGlobal("window", Object.assign(new EventTarget(), { devicePixelRatio: 1 }));
    vi.stubGlobal("screen", { width: 300, height: 300 });
    vi.stubGlobal("innerWidth", 300);
    vi.stubGlobal("innerHeight", 300);
    sessions.calls.length = 0;
    sessions.throwOnOnyx = false;
  });
  afterEach(() => {
    setup.bridge?.destroy();
    setup.bridge = null;
    setup.settings = null;
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("matches once and does not replay again after timeout", () => {
    const { replay, socket, bridge } = create();
    expect(replay.begin(event(), "pen", rect, point(100, 100))).toBe(true);
    expect(replay.end(event({ timeStamp: 20 }), point(102, 101))).toBe(true);
    onyx(socket);
    vi.advanceTimersByTime(1000);
    expect(sessions.calls).toHaveLength(1);
    expect(sessions.calls[0].first.cx).toBe(100);
    expect(bridge.stats).toMatchObject({ penStrokes: 1, matched: 1, fallbacks: 0 });
    replay.destroy();
  });

  it("falls back to buffered pointer points when the companion is silent", () => {
    const { replay, bridge } = create();
    replay.begin(event(), "pen", rect, point(10, 10));
    replay.end(event({ timeStamp: 30 }), point(12, 11));
    vi.advanceTimersByTime(400);
    expect(sessions.calls).toHaveLength(1);
    expect(sessions.calls[0].first.cx).toBe(10);
    expect(bridge.stats.fallbacks).toBe(1);
    replay.destroy();
  });

  it("replays eligible orphans and drops those outside the recent active surface", () => {
    const { replay, socket, bridge } = create();
    replay.begin(event(), "pen", rect, point(100, 100));
    replay.end(event(), point(102, 101));
    onyx(socket);
    vi.advanceTimersByTime(30);
    onyx(socket, 150);
    vi.advanceTimersByTime(30);
    onyx(socket, 500);
    vi.advanceTimersByTime(30);
    expect(sessions.calls).toHaveLength(2);
    expect(bridge.stats.orphans).toBe(2);
    replay.destroy();
  });

  it("drops late Onyx frames after pointer fallback", () => {
    const { replay, socket, bridge } = create();
    replay.begin(event(), "pen", rect, point(10, 100));
    replay.end(event(), point(12, 101));
    vi.advanceTimersByTime(400);
    onyx(socket, 10);
    vi.advanceTimersByTime(30);
    expect(sessions.calls).toHaveLength(1);
    expect(bridge.stats.late).toBe(1);
    replay.destroy();
  });

  it("commits pointercancel and flush as pointer fallbacks", () => {
    const first = create();
    first.replay.begin(event(), "pen", rect, point(10, 10));
    first.replay.end(event(), null);
    vi.advanceTimersByTime(400);
    expect(sessions.calls).toHaveLength(1);
    first.replay.destroy();
    sessions.calls.length = 0;
    const second = create();
    second.replay.begin(event(), "pen", rect, point(10, 10));
    second.replay.end(event(), point(12, 11));
    second.replay.flush();
    expect(sessions.calls).toHaveLength(1);
    second.replay.destroy();
  });

  it("rejects eraser buttons, non-pen pointers, and an inactive bridge", () => {
    const { replay, bridge } = create();
    expect(replay.begin(event({ buttons: 32 }), "eraser", rect, point(1, 1))).toBe(false);
    expect(replay.begin(event({ pointerType: "touch" }), "pen", rect, point(1, 1))).toBe(false);
    bridge.destroy();
    expect(replay.begin(event(), "pen", rect, point(1, 1))).toBe(false);
    replay.destroy();
  });

  it("falls back exactly once when Onyx replay throws", () => {
    const { replay, socket, bridge } = create();
    sessions.throwOnOnyx = true;
    replay.begin(event(), "pen", rect, point(90, 100));
    replay.end(event(), point(92, 101));
    onyx(socket);
    vi.advanceTimersByTime(100);
    expect(sessions.calls).toHaveLength(2);
    expect(sessions.calls[1].first.cx).toBe(90);
    expect(bridge.stats).toMatchObject({ matched: 0, fallbacks: 1 });
    replay.destroy();
  });
  it("keeps quick successive strokes from the same pen pointer apart", () => {
    const { bridge, socket } = create();
    const replay = new OnyxPenReplay({
      el: { getBoundingClientRect: () => rect },
      settings: { pressure: true },
      tools: { tool: "pen" },
      toPage: (cx: number, cy: number) => ({ x: cx, y: cy }),
    } as any);
    expect(replay.begin(event(), "pen", rect, point(20, 20))).toBe(true);
    expect(replay.end(event(), point(30, 20))).toBe(true);
    expect(replay.begin(event(), "pen", rect, point(150, 150))).toBe(true);
    expect(replay.end(event(), point(160, 150))).toBe(true);
    vi.advanceTimersByTime(1000);
    expect(sessions.calls.filter((call) => call.tool === "pen")).toHaveLength(2);
    expect(replay.busy).toBe(false);
    expect(bridge.stats.fallbacks).toBe(2);
    void socket;
  });
});
