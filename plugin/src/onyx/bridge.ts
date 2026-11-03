// AGPL-3.0-or-later. Part of the Onyx Ink fork (Singularity Notebook) of Ink Notebook, modified by Andrew Gribben, 2026.

import { parseMessage, type CompanionMessage, type CompanionStroke, type PluginMessage } from "./protocol";

export type BridgeState = "disconnected" | "connected" | "active" | "paused";
export type BridgeEvent = { time: number; kind: string; summary: string };
type Socket = {
  readyState: number;
  onopen: ((event: unknown) => void) | null;
  onmessage: ((event: { data: string }) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onclose: ((event: unknown) => void) | null;
  send(data: string): void;
  close(): void;
};
type SocketFactory = (url: string) => Socket;

export class OnyxBridge {
  state: BridgeState = "disconnected";
  hello: Extract<CompanionMessage, { type: "hello" }> | null = null;
  raw: Extract<CompanionMessage, { type: "state" }> ["raw"] | "" = "";
  readonly stats = { rx: 0, matched: 0, fallbacks: 0, orphans: 0, errors: 0 };
  readonly events: BridgeEvent[] = [];
  readonly frames: string[] = [];
  private socket: Socket | null = null;
  private retry = 1000;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private killed = false;
  private sentRegion = false;
  private listeners = new Set<(message: CompanionStroke) => void>();

  constructor(
    private port: number,
    private mode: "auto" | "on" | "off",
    private version: string,
    private makeSocket: SocketFactory = (url) => new WebSocket(url) as unknown as Socket,
    android = false,
    private notify: (message: string) => void = () => undefined,
  ) {
    if (mode === "on" || (mode === "auto" && android)) this.connect();
  }

  onStroke(listener: (message: CompanionStroke) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  recordOutcome(kind: "matched" | "fallbacks" | "orphans"): void {
    this.stats[kind]++;
    this.event(kind, kind);
  }

  send(message: PluginMessage): void {
    try {
      if (this.socket?.readyState !== 1) return;
      this.socket.send(JSON.stringify(message));
      if (message.type === "region") {
        this.sentRegion = message.rect !== null;
        this.updateState();
      }
    } catch {
      this.error("send failed");
    }
  }

  destroy(): void {
    this.killed = true;
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    this.socket?.close();
    this.socket = null;
    this.state = "disconnected";
  }

  private connect(): void {
    if (this.killed) return;
    try {
      const socket = this.makeSocket(`ws://127.0.0.1:${this.port}`);
      this.socket = socket;
      socket.onopen = () => {
        this.retry = 1000;
        this.state = "connected";
        this.send({ type: "hello", v: 2, app: "ink-notebook-onyx", version: this.version });
      };
      socket.onmessage = (event) => this.receive(event.data);
      // A refused connection (companion not running) is retried, not counted towards the kill switch.
      socket.onerror = () => {
        if (this.state !== "disconnected") this.error("WebSocket error");
      };
      socket.onclose = () => {
        if (this.socket === socket) this.socket = null;
        this.state = "disconnected";
        this.scheduleReconnect();
      };
    } catch {
      this.error("WebSocket construction failed");
      this.scheduleReconnect();
    }
  }

  private receive(raw: string): void {
    this.frames.push(raw);
    if (this.frames.length > 50) this.frames.shift();
    this.stats.rx++;
    const message = parseMessage(raw);
    if (!message) return;
    if (message.type === "hello") this.hello = message;
    if (message.type === "state") {
      this.raw = message.raw;
      this.updateState();
    }
    if (message.type === "stroke") {
      for (const listener of this.listeners) {
        const start = performance.now();
        try {
          listener(message);
        } catch {
          this.error("stroke handler failed");
        }
        if (performance.now() - start > 250) this.kill("A stroke handler took more than 250 ms.");
      }
      const id = message.id === undefined ? "v1" : String(message.id);
      this.event("stroke", `id ${id}, v${message.v}, ${message.pts.length} points`);
      return;
    }
    this.event(message.type, message.type === "state" ? message.raw : `${message.app} ${message.version}`);
  }

  private updateState(): void {
    if (this.state === "disconnected") return;
    if (this.raw === "paused") this.state = "paused";
    else this.state = this.raw === "enabled" && this.sentRegion ? "active" : "connected";
  }

  private scheduleReconnect(): void {
    if (this.killed || this.timer !== null) return;
    const delay = this.retry;
    this.retry = Math.min(15000, this.retry * 2);
    this.timer = setTimeout(() => {
      this.timer = null;
      this.connect();
    }, delay);
  }

  private event(kind: string, summary: string): void {
    this.events.push({ time: Date.now(), kind, summary });
    if (this.events.length > 20) this.events.shift();
  }

  private error(summary: string): void {
    this.stats.errors++;
    this.event("error", summary);
    if (this.stats.errors >= 20) this.kill("The bridge reached 20 errors.");
  }

  private kill(reason: string): void {
    if (this.killed) return;
    this.killed = true;
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    this.socket?.close();
    this.socket = null;
    this.state = "disconnected";
    this.notify(`Onyx bridge disabled for this session. ${reason}`);
  }
}
