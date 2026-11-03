// AGPL-3.0-or-later. Part of the Onyx Ink fork (Singularity Notebook) of Ink Notebook, modified by Andrew Gribben, 2026.

import { App, Modal, Notice } from "obsidian";
import type { OnyxBridge } from "./bridge";

export class OnyxDiagnostics extends Modal {
  constructor(app: App, private bridge: OnyxBridge, private pluginId: string) {
    super(app);
  }

  onOpen(): void {
    this.render();
  }

  private render(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "Onyx bridge diagnostics" });
    contentEl.createEl("p", { text: `State: ${this.bridge.state}` });
    const hello = this.bridge.hello;
    contentEl.createEl("p", {
      text: hello
        ? `Companion: ${hello.app} ${hello.version}, ${hello.screen.w} × ${hello.screen.h}, pressureMax ${hello.pressureMax}`
        : "Companion: none",
    });
    const stats = Object.entries(this.bridge.stats).map(([key, value]) => `${key} ${value}`).join(", ");
    contentEl.createEl("p", { text: `Stats: ${stats}` });
    const { matched, fallbacks, penStrokes } = this.bridge.stats;
    contentEl.createEl("p", { text: `matched + fallbacks = ${matched + fallbacks} of ${penStrokes} pen strokes` });
    for (const event of [...this.bridge.events].reverse()) {
      contentEl.createEl("p", { text: `${new Date(event.time).toLocaleTimeString()} ${event.kind}: ${event.summary}` });
    }
    contentEl.createEl("button", { text: "Refresh" }).onclick = () => this.render();
    contentEl.createEl("button", { text: "Save raw log" }).onclick = () => void this.save();
  }

  private async save(): Promise<void> {
    const path = `${this.app.vault.configDir}/plugins/${this.pluginId}/onyx-log-${Date.now()}.json`;
    try {
      await this.app.vault.adapter.write(path, JSON.stringify(this.bridge.frames, null, 2));
      new Notice(`Saved Onyx log: ${path}`);
    } catch {
      new Notice("Could not save Onyx log.");
    }
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
