// AGPL-3.0-or-later. Part of the Onyx Ink fork (Singularity Notebook) of Ink Notebook, modified by Andrew Gribben, 2026.

import type { InkSurface } from "../ink/surface";
import { createSession, type InputPt } from "../ink/tools";
import type { ToolId } from "../ink/types";
import { clientToScreen, webviewOffset } from "./coords";
import { StrokeMatcher, type OnyxStroke, type PointerStroke } from "./matcher";
import { onyxBridge, onyxSettings } from "./state";
import { clientBBox, onyxToClientPoints } from "./replayPoints";

type Pending = {
  id: string;
  pointer: number;
  tool: "pen" | "marker";
  rect: DOMRect;
  downTime: number;
  durationMs: number;
  raw: boolean;
  points: InputPt[];
};

export class OnyxPenReplay {
  private pending: Pending | null = null;
  private matcher: StrokeMatcher | null = null;
  private waiting = new Map<string, { tool: "pen" | "marker"; points: InputPt[]; rect: DOMRect; downTime: number; durationMs: number }>();
  private activeUntil = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private unsubscribeStroke: (() => void) | null = null;
  // The pen reuses one pointerId for every stroke, so waiting strokes need their own ids.
  private nextId = 0;

  constructor(private s: InkSurface) {
    this.subscribe();
  }

  get busy(): boolean {
    return !!this.pending || this.waiting.size > 0;
  }

  begin(e: PointerEvent, tool: ToolId, rect: DOMRect, first: InputPt): boolean {
    this.subscribe();
    const bridge = onyxBridge();
    if (!bridge || bridge.state !== "active" || e.pointerType !== "pen" || (tool !== "pen" && tool !== "marker") ||
        (e.buttons & 34) !== 0 || e.button === 2 || e.button === 5 || this.pending) return false;
    const settings = onyxSettings();
    if (!settings) return false;
    // One matcher for the surface: replacing it would drop strokes still waiting for their Onyx stroke.
    this.matcher ??= new StrokeMatcher(settings.onyxMatchWindowMs, settings.onyxFallbackMs);
    this.pending = {
      id: String(++this.nextId), pointer: e.pointerId, tool, rect, downTime: e.timeStamp, durationMs: 0, raw: false, points: [first],
    };
    bridge.stats.penStrokes++;
    this.activeUntil = performance.now() + 1000;
    return true;
  }

  move(e: PointerEvent, raw: boolean, points: () => InputPt[]): boolean {
    const pending = this.pending;
    if (!pending || e.pointerId !== pending.pointer || (e.buttons & 1) === 0) return false;
    const list = points();
    if (raw) pending.raw = true;
    else if (pending.raw) return true;
    pending.points.push(...list);
    this.activeUntil = performance.now() + 1000;
    return true;
  }

  end(e: PointerEvent, last: InputPt | null): boolean {
    const pending = this.pending;
    if (!pending || e.pointerId !== pending.pointer) return false;
    this.pending = null;
    pending.durationMs = Math.max(0, e.timeStamp - pending.downTime);
    if (last) pending.points.push(last);
    const pointer: PointerStroke = { id: pending.id, bbox: clientBBox(pending.points), upTime: performance.now(), points: pending.points };
    this.waiting.set(pending.id, {
      tool: pending.tool,
      points: pending.points,
      rect: pending.rect,
      downTime: pending.downTime,
      durationMs: pending.durationMs,
    });
    this.matcher?.addPointerStroke(pointer);
    this.pollSoon();
    return true;
  }

  flush(): void {
    this.pending = null;
    if (!this.matcher) return;
    for (const outcome of this.matcher.poll(Infinity)) this.handle(outcome);
    this.clearTimer();
  }

  destroy(): void {
    this.flush();
    this.clearTimer();
    this.unsubscribeStroke?.();
  }

  private subscribe(): void {
    const bridge = onyxBridge();
    if (!bridge) return;
    this.unsubscribeStroke?.();
    this.unsubscribeStroke = bridge.onStroke((stroke) => {
      const settings = onyxSettings();
      if (!settings) return;
      const waiting = [...this.waiting.values()].sort((a, b) => b.downTime - a.downTime)[0];
      // Map with the surface's position at pen-down: the note may have scrolled since (inline blocks).
      const points = this.convert(stroke, waiting?.downTime ?? performance.now(), waiting?.durationMs, waiting?.rect);
      const onyx: OnyxStroke = { bbox: clientBBox(points), arrivalTime: performance.now(), stroke, points };
      this.matcher ??= new StrokeMatcher(settings.onyxMatchWindowMs, settings.onyxFallbackMs);
      this.matcher.addOnyxStroke(onyx);
      this.pollSoon();
    });
  }

  private convert(stroke: Parameters<typeof onyxToClientPoints>[0], t0: number, durationMs?: number, rect?: DOMRect): InputPt[] {
    const settings = onyxSettings();
    const dpr = window.devicePixelRatio || 1;
    const offset = webviewOffset({ width: screen.width, height: screen.height }, { width: innerWidth, height: innerHeight });
    return onyxToClientPoints(stroke, {
      dpr,
      webview: offset,
      calibration: { x: settings?.onyxCalibrationX ?? 0, y: settings?.onyxCalibrationY ?? 0 },
      pressureOn: this.s.settings.pressure,
      hello: onyxBridge()?.hello ?? null,
      t0,
      durationMs,
      toPage: (cx, cy) => this.s.toPage(cx, cy, rect),
    });
  }

  private pollSoon(): void {
    if (this.timer === null) this.timer = setTimeout(() => this.poll(), 25);
  }

  private poll(): void {
    this.timer = null;
    for (const outcome of this.matcher?.poll(performance.now()) ?? []) this.handle(outcome);
    if (this.busy) this.pollSoon();
  }

  private handle(outcome: ReturnType<StrokeMatcher["poll"]>[number]): void {
    const bridge = onyxBridge();
    if (!bridge) return;
    if (outcome.type === "matched") {
      const pointer = this.waiting.get(outcome.pointerId);
      if (!pointer) return;
      this.waiting.delete(outcome.pointerId);
      const stroke = outcome.onyxStroke as OnyxStroke & { stroke: Parameters<typeof onyxToClientPoints>[0]; points: InputPt[] };
      try {
        this.commit(pointer.tool, stroke.points);
        const a = clientBBox(stroke.points);
        const b = clientBBox(pointer.points);
        bridge.recordOffset(a.x + a.w / 2 - b.x - b.w / 2, a.y + a.h / 2 - b.y - b.h / 2);
        bridge.recordOutcome("matched");
        this.refresh(a);
      } catch {
        this.commit(pointer.tool, pointer.points);
        bridge.recordOutcome("fallbacks");
        this.refresh(clientBBox(pointer.points));
      }
    } else if (outcome.type === "fallback") {
      const pointer = this.waiting.get(outcome.pointerStroke.id);
      if (!pointer) return;
      this.waiting.delete(outcome.pointerStroke.id);
      this.commit(pointer.tool, pointer.points);
      bridge.recordOutcome("fallbacks");
      this.refresh(clientBBox(pointer.points));
    } else if (outcome.type === "orphan") {
      const stroke = outcome.onyxStroke as OnyxStroke & { points: InputPt[] };
      const bounds = this.s.el.getBoundingClientRect();
      const first = stroke.points[0];
      const inside = first && first.cx >= bounds.left && first.cx <= bounds.right && first.cy >= bounds.top && first.cy <= bounds.bottom;
      if (performance.now() <= this.activeUntil && inside) {
        const tool = this.s.tools.tool;
        if (tool === "pen" || tool === "marker") {
          this.commit(tool, stroke.points);
          this.refresh(clientBBox(stroke.points));
        }
      }
      bridge.recordOutcome("orphans");
    } else {
      bridge.recordOutcome("late");
    }
  }

  private commit(tool: "pen" | "marker", points: InputPt[]): void {
    if (points.length === 0) return;
    // Hold-to-snap is not supported in bridge mode.
    const session = createSession(this.s, tool, points[0], { isPen: true, ctrl: false });
    session.move(points.slice(1, -1));
    session.up(points.length > 1 ? points[points.length - 1] : null);
  }

  private refresh(box: { x: number; y: number; w: number; h: number }): void {
    const dpr = window.devicePixelRatio || 1;
    const settings = onyxSettings();
    const offset = webviewOffset({ width: screen.width, height: screen.height }, { width: innerWidth, height: innerHeight });
    const calibration = { x: settings?.onyxCalibrationX ?? 0, y: settings?.onyxCalibrationY ?? 0 };
    const a = clientToScreen(box.x, box.y, 0, 0, dpr, offset.x, offset.y, calibration);
    const b = clientToScreen(box.x + box.w, box.y + box.h, 0, 0, dpr, offset.x, offset.y, calibration);
    onyxBridge()?.send({ type: "refresh", rect: [a.x, a.y, b.x, b.y] });
  }

  private clearTimer(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }
}
