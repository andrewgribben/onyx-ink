// AGPL-3.0-or-later. Part of the Onyx Ink fork (Singularity Notebook) of Ink Notebook, modified by Andrew Gribben, 2026.

import { afterEach, describe, expect, it, vi } from "vitest";
import { OnyxBridge } from "../src/onyx/bridge";

type Handler = (event: any) => void;
class FakeSocket {
  readyState = 0;
  onopen: Handler | null = null;
  onmessage: Handler | null = null;
  onerror: Handler | null = null;
  onclose: Handler | null = null;
  sent: string[] = [];
  send(raw: string): void { this.sent.push(raw); }
  close(): void {
    this.readyState = 3;
    this.onclose?.({});
  }
  open(): void {
    this.readyState = 1;
    this.onopen?.({});
  }
  frame(raw: string): void { this.onmessage?.({ data: raw }); }
}

const stroke = '{"type":"stroke","v":2,"id":9,"w":10,"h":10,"ox":0,"oy":0,"pts":[[1,2,3,100]]}';

describe("Onyx bridge", () => {
  afterEach(() => vi.useRealTimers());

  it("sends hello on open and delivers and counts strokes", () => {
    const socket = new FakeSocket();
    const bridge = new OnyxBridge(8765, "on", "2.3.2", () => socket, true);
    const listener = vi.fn();
    const change = vi.fn();
    bridge.onStroke(listener);
    bridge.onChange(change);
    socket.open();
    expect(JSON.parse(socket.sent[0])).toEqual({ type: "hello", v: 2, app: "ink-notebook-onyx", version: "2.3.2" });
    socket.frame(stroke);
    expect(listener).toHaveBeenCalledOnce();
    expect(bridge.stats.rx).toBe(1);
    expect(bridge.events.at(-1)?.summary).toContain("9");
    socket.frame('{"type":"state","v":2,"raw":"enabled"}');
    bridge.send({ type: "region", rect: [0, 0, 10, 10], exclude: [] });
    expect(bridge.state).toBe("active");
    expect(change).toHaveBeenLastCalledWith("active");
    bridge.recordOffset(2, 4);
    bridge.recordOffset(4, 8);
    expect(bridge.stats).toMatchObject({ offsetX: 3, offsetY: 6, offsetSamples: 2 });
    bridge.destroy();
  });

  it("backs off 1, 2, 4, 8, 15, then stays at 15 seconds", () => {
    vi.useFakeTimers();
    const sockets: FakeSocket[] = [];
    const bridge = new OnyxBridge(8765, "on", "1", () => {
      const socket = new FakeSocket();
      sockets.push(socket);
      return socket;
    }, true);
    for (const delay of [1000, 2000, 4000, 8000, 15000, 15000]) {
      sockets.at(-1)?.close();
      expect(vi.getTimerCount()).toBe(1);
      vi.advanceTimersByTime(delay - 1);
      expect(sockets).toHaveLength(sockets.length);
      vi.advanceTimersByTime(1);
    }
    expect(sockets).toHaveLength(7);
    bridge.destroy();
  });

  it("disables after 20 socket errors on an open connection", () => {
    const socket = new FakeSocket();
    const bridge = new OnyxBridge(8765, "on", "1", () => socket, true);
    socket.open();
    for (let i = 0; i < 20; i++) socket.onerror?.({});
    expect(bridge.stats.errors).toBe(20);
    expect(bridge.state).toBe("disconnected");
    bridge.destroy();
  });

  it("does not count refused connections as errors", () => {
    const socket = new FakeSocket();
    const bridge = new OnyxBridge(8765, "on", "1", () => socket, true);
    for (let i = 0; i < 30; i++) socket.onerror?.({});
    expect(bridge.stats.errors).toBe(0);
    bridge.destroy();
  });

  it("connects in on mode outside Android", () => {
    const factory = vi.fn(() => new FakeSocket());
    const bridge = new OnyxBridge(8765, "on", "1", factory, false);
    expect(factory).toHaveBeenCalledOnce();
    bridge.destroy();
  });

  it("does not connect in auto mode outside Android", () => {
    const factory = vi.fn(() => new FakeSocket());
    const bridge = new OnyxBridge(8765, "auto", "1", factory, false);
    expect(factory).not.toHaveBeenCalled();
    bridge.destroy();
  });

  it("ignores unknown messages without counting them as errors", () => {
    const socket = new FakeSocket();
    const bridge = new OnyxBridge(8765, "on", "1", () => socket, true);
    socket.frame('{"type":"future-message"}');
    expect(bridge.stats.errors).toBe(0);
    expect(bridge.stats.rx).toBe(1);
    expect(bridge.frames).toHaveLength(1);
    bridge.destroy();
  });
});
