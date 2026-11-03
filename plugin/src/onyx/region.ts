// AGPL-3.0-or-later. Part of the Onyx Ink fork (Singularity Notebook) of Ink Notebook, modified by Andrew Gribben, 2026.

import type { InkSurface } from "../ink/surface";
import type { App, EventRef } from "obsidian";
import { clientToScreen, webviewOffset } from "./coords";
import { inlineInkSurfaces, onyxBridge, onyxSettings } from "./state";

export type RegionRect = { left: number; top: number; right: number; bottom: number };
type RegionInput = {
  surfaces: RegionRect[];
  excludes: RegionRect[];
  viewport: { width: number; height: number };
  modalOpen: boolean;
  keyboardUp: boolean;
  focusedInput: boolean;
  tool: string;
  dpr: number;
  calibration: { x: number; y: number };
};

export function sendOnChange(last: string, value: unknown, send: (value: unknown) => void): string {
  const encoded = JSON.stringify(value) ?? "undefined";
  if (encoded !== last) send(value);
  return encoded;
}

function intersect(a: RegionRect, b: RegionRect): RegionRect | null {
  const rect = {
    left: Math.max(a.left, b.left), top: Math.max(a.top, b.top),
    right: Math.min(a.right, b.right), bottom: Math.min(a.bottom, b.bottom),
  };
  return rect.right > rect.left && rect.bottom > rect.top ? rect : null;
}

export function decideRegion(input: RegionInput): {
  rect: [number, number, number, number];
  rects: [number, number, number, number][];
  exclude: [number, number, number, number][];
} | null {
  if (input.modalOpen || input.keyboardUp || input.focusedInput ||
      (input.tool !== "pen" && input.tool !== "marker") || input.surfaces.length === 0) return null;
  const viewport = { left: 0, top: 0, right: input.viewport.width, bottom: input.viewport.height };
  const clipped = input.surfaces.map((rect) => intersect(rect, viewport)).filter((rect): rect is RegionRect => !!rect);
  if (clipped.length === 0) return null;
  const rects = clipped.map((rect) => physicalRect(rect, input.dpr, input.calibration));
  const rect = [
    Math.min(...rects.map((item) => item[0])),
    Math.min(...rects.map((item) => item[1])),
    Math.max(...rects.map((item) => item[2])),
    Math.max(...rects.map((item) => item[3])),
  ] as [number, number, number, number];
  return {
    rect,
    rects,
    exclude: clipped.flatMap((surface) => input.excludes.map((item) => intersect(item, surface))
      .filter((item): item is RegionRect => !!item).map((item) => physicalRect(item, input.dpr, input.calibration))),
  };
}

export function physicalRect(rect: RegionRect, dpr: number, calibration: { x: number; y: number },
  offset = { x: 0, y: 0 }): [number, number, number, number] {
  const a = clientToScreen(rect.left, rect.top, 0, 0, dpr, offset.x, offset.y, calibration);
  const b = clientToScreen(rect.right, rect.bottom, 0, 0, dpr, offset.x, offset.y, calibration);
  return [Math.floor(a.x), Math.floor(a.y), Math.ceil(b.x), Math.ceil(b.y)];
}

export function onyxStyle(surface: Pick<InkSurface, "tools" | "view" | "dpr">): {
  type: "style"; kind: "pen" | "marker"; widthPx: number; color: string;
} | null {
  const { tools } = surface;
  if (tools.tool !== "pen" && tools.tool !== "marker") return null;
  const width = tools.tool === "marker" ? tools.widths.marker : tools.widths[tools.pen];
  const color = (tools.tool === "marker" ? tools.markerColor : tools.color).toLowerCase();
  if (!/^#[0-9a-f]{6}$/.test(color)) return null;
  return { type: "style", kind: tools.tool, widthPx: Math.round(width * surface.view.scale * surface.dpr * 10) / 10, color };
}

function visible(el: Element): boolean {
  const style = getComputedStyle(el);
  const rect = el.getBoundingClientRect();
  return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
}

function inputFocused(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const type = (el as HTMLInputElement).type;
  const textInput = el.tagName === "INPUT" && !/^(checkbox|radio|range|button|submit|color)$/i.test(type);
  return textInput || el.tagName === "TEXTAREA" || (el as HTMLElement).isContentEditable;
}

export class OnyxRegion {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private interval: ReturnType<typeof setInterval> | null = null;
  private observer: MutationObserver;
  private unsubscribe: (() => void) | null = null;
  private lastRegion = "";
  private lastStyle = "";
  private lastPause = "";
  private workspaceEvents: EventRef[] = [];
  private refresh = () => this.schedule();

  constructor(private app: App) {
    window.addEventListener("resize", this.refresh);
    window.visualViewport?.addEventListener("resize", this.refresh);
    document.addEventListener("focusin", this.refresh);
    document.addEventListener("focusout", this.refresh);
    document.addEventListener("scroll", this.refresh, true);
    window.addEventListener("onyx-bridge-change", this.bridgeChanged);
    window.addEventListener("onyx-surface-change", this.refresh);
    this.observer = new MutationObserver(this.refresh);
    if (document.body) this.observer.observe(document.body, { childList: true, subtree: true });
    this.workspaceEvents.push(this.app.workspace.on("active-leaf-change", this.refresh));
    this.workspaceEvents.push(this.app.workspace.on("layout-change", this.refresh));
    this.workspaceEvents.push(this.app.workspace.on("file-open", this.refresh));
    this.bindBridge();
    this.schedule();
  }

  destroy(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    if (this.interval !== null) clearInterval(this.interval);
    this.observer.disconnect();
    this.unsubscribe?.();
    for (const event of this.workspaceEvents) this.app.workspace.offref(event);
    this.workspaceEvents = [];
    window.removeEventListener("resize", this.refresh);
    window.visualViewport?.removeEventListener("resize", this.refresh);
    document.removeEventListener("focusin", this.refresh);
    document.removeEventListener("focusout", this.refresh);
    document.removeEventListener("scroll", this.refresh, true);
    window.removeEventListener("onyx-bridge-change", this.bridgeChanged);
    window.removeEventListener("onyx-surface-change", this.refresh);
    onyxBridge()?.send({ type: "region", rect: null, exclude: [] });
  }

  private bridgeChanged = (): void => {
    this.bindBridge();
    this.lastRegion = "";
    this.lastStyle = "";
    this.schedule();
  };

  private bindBridge(): void {
    this.unsubscribe?.();
    const bridge = onyxBridge();
    if (!bridge) return;
    this.unsubscribe = bridge.onChange((state) => {
      if (state === "connected" || state === "active") {
        this.lastRegion = "";
        this.lastStyle = "";
        this.interval ??= setInterval(this.refresh, 1000);
      } else if (this.interval !== null) {
        clearInterval(this.interval);
        this.interval = null;
      }
      this.schedule();
    });
    if (bridge.state === "connected" || bridge.state === "active") this.interval ??= setInterval(this.refresh, 1000);
  }

  private schedule(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      this.update();
    }, 100);
  }

  private update(): void {
    const bridge = onyxBridge();
    if (!bridge || (bridge.state !== "connected" && bridge.state !== "active" && bridge.state !== "paused")) return;
    const leaf = this.app.workspace.activeLeaf;
    const view = leaf?.view as { getViewType(): string; surface?: InkSurface; containerEl?: HTMLElement } | undefined;
    const activeSurface = view?.getViewType() === "ink-notebook" && view.surface?.el.isConnected ? view.surface : null;
    const blocks = inlineInkSurfaces().filter((surface) => surface.el.isConnected &&
      !!view?.containerEl?.contains(surface.el));
    const surfaces = [...(activeSurface ? [activeSurface] : []), ...blocks];
    const selected = blocks.length > 0
      ? [...blocks].sort((a, b) => b.input.lastActivity - a.input.lastActivity)[0]
      : activeSurface;
    const modalSelectors = ".modal-container, .menu, .suggestion-container, .popover, .prompt";
    const modalOpen = [...document.querySelectorAll(modalSelectors)].some(visible);
    const gap = screen.height - innerHeight > 120 || (!!visualViewport && innerHeight - visualViewport.height > 120);
    const pauseReason = !selected ? "no visible ink surface" : modalOpen ? "modal or menu open" : gap ? "keyboard open" :
      inputFocused() ? "text input focused" : selected.tools.tool !== "pen" && selected.tools.tool !== "marker" ?
        `tool is ${selected.tools.tool}` : "";
    if (pauseReason !== this.lastPause) {
      this.lastPause = pauseReason;
      bridge.pauseReason = pauseReason;
    }
    const bounds = surfaces.map((surface) => surface.el.getBoundingClientRect());
    const rects = bounds.filter((r) => r.width > 0 && r.height > 0)
      .map((r) => ({ left: r.left, top: r.top, right: r.right, bottom: r.bottom }));
    const excludes = [...document.querySelectorAll(".ink-ui")].filter(visible).map((el) => {
      const r = el.getBoundingClientRect();
      return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
    });
    const offset = webviewOffset({ width: screen.width, height: screen.height }, { width: innerWidth, height: innerHeight });
    const settings = onyxSettings();
    const calibration = { x: settings?.onyxCalibrationX ?? 0, y: settings?.onyxCalibrationY ?? 0 };
    const decision = decideRegion({ surfaces: rects, excludes, viewport: { width: innerWidth, height: innerHeight }, modalOpen,
      keyboardUp: gap, focusedInput: inputFocused(), tool: selected?.tools.tool ?? "", dpr: devicePixelRatio || 1,
      calibration: { x: calibration.x - offset.x, y: calibration.y - offset.y } });
    const message: { type: "region"; rect: [number, number, number, number] | null; rects?: [number, number, number, number][];
      exclude: [number, number, number, number][] } = decision
      ? { type: "region" as const, rect: decision.rect, rects: decision.rects, exclude: decision.exclude }
      : { type: "region", rect: null, exclude: [] };
    const encoded = sendOnChange(this.lastRegion, message, (value) => bridge.send(value as typeof message));
    if (encoded !== this.lastRegion) {
      this.lastRegion = encoded;
      bridge.regionStatus = decision ? JSON.stringify(message.rect) : "paused (null region)";
      // Logged so diagnostics shows what was sent before the diagnostics modal itself paused the region.
      bridge.logEvent("region", decision ? `${JSON.stringify(message.rect)}, ${message.exclude.length} excluded` : `null (${pauseReason})`);
    }
    const style = selected ? onyxStyle(selected) : null;
    const styleText = style ? sendOnChange(this.lastStyle, style, (value) => bridge.send(value as typeof style)) : "";
    if (style && styleText !== this.lastStyle) {
      this.lastStyle = styleText;
      bridge.styleStatus = `${style.kind} ${style.widthPx}px ${style.color}`;
    }
  }
}
