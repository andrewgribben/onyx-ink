// AGPL-3.0-or-later. Part of the Onyx Ink fork (Singularity Notebook) of Ink Notebook, modified by Andrew Gribben, 2026.

import { MarkdownRenderChild, Notice, normalizePath, setIcon, TFile, type Editor } from "obsidian";
import type InkNotebookPlugin from "../main";
import { parseInkFile, serializeInkFile } from "../core/ink/codec";
import { joinPath } from "../core/folders";
import { InkSurface } from "../ink/surface";
import type { SurfaceSettings } from "../ink/types";
import { einkActive, lowLatencyActive } from "./einkMode";
import { INK_VIEW_TYPE } from "./inkView";
import { registerInlineSurface, unregisterInlineSurface } from "../onyx/state";
import { createInkBlockText, inkBlockNeedsGrowth } from "../onyx/inkBlock";

const SAVE_DELAY_MS = 1000;
const GROW_BY = 300;

export async function insertInkBlock(plugin: InkNotebookPlugin, editor: Editor, note: TFile): Promise<void> {
  const folder = await plugin.pairs.ensureInkFolder(note);
  let file: TFile | null = null;
  for (let n = 1; !file; n++) {
    const path = normalizePath(joinPath(folder, `${note.basename} handwriting ${n}.ink.md`));
    if (!plugin.app.vault.getAbstractFileByPath(path)) file = await plugin.app.vault.create(path, createInkBlockText());
  }
  const cursor = editor.getCursor();
  const line = editor.getLine(cursor.line);
  const before = line.slice(0, cursor.ch);
  const after = line.slice(cursor.ch);
  const previous = cursor.line > 0 ? editor.getLine(cursor.line - 1) : "";
  const next = cursor.line + 1 < editor.lineCount() ? editor.getLine(cursor.line + 1) : "";
  const prefix = before.trim() ? "\n\n" : previous.trim() ? "\n" : "";
  const suffix = after.trim() ? "\n\n" : next.trim() ? "\n" : "";
  editor.replaceRange(`${prefix}![[${file.basename}]]${suffix}`, cursor);
}

export class InkBlockChild extends MarkdownRenderChild {
  private file: TFile | null = null;
  private surface!: InkSurface;
  private frontmatter = "";
  private timer: number | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private lastWritten: string | null = null;
  private dirty = false;
  private revision = 0;
  private controls!: HTMLElement;
  private pageEl!: HTMLElement;

  constructor(el: HTMLElement, private plugin: InkNotebookPlugin, private sourcePath: string) {
    super(el);
  }

  onload(): void {
    const abstract = this.plugin.app.vault.getAbstractFileByPath(this.sourcePath);
    if (!(abstract instanceof TFile)) return;
    this.file = abstract;
    this.containerEl.addClass("ink-block");
    this.controls = this.containerEl.createDiv({ cls: "ink-ui ink-block-controls" });
    this.pageEl = this.containerEl.createDiv({ cls: "ink-block-page" });
    this.surface = new InkSurface(this.pageEl, {
      images: this.plugin.images,
      icon: (el, name) => setIcon(el, name),
      openLink: (target, newTab) => void this.plugin.app.workspace.openLinkText(target, this.file?.path ?? "", newTab),
      changed: () => this.changed(),
      toolChanged: () => this.updateControls(),
      historyChanged: () => this.updateControls(),
      notice: (message) => new Notice(message, 2500),
    });
    this.surface.el.addClass("ink-block-touch");
    this.surface.tools = structuredClone(this.plugin.settings.tools);
    if (!["pen", "marker", "eraser"].includes(this.surface.tools.tool)) this.surface.tools.tool = "pen";
    this.surface.setSettings(this.surfaceSettings());
    this.addControls();
    void this.loadFile(true).catch((error) => {
      new Notice("The handwriting block could not be loaded.", 5000);
      console.error("Ink Notebook: handwriting block load failed", error);
    });
    registerInlineSurface(this.surface);
    this.registerEvent(this.plugin.app.vault.on("modify", (file) => {
      if (file.path === this.file?.path) void this.reloadIfExternal();
    }));
    this.register(this.plugin.images.subscribe(() => this.surface.queueRender()));
    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(() => this.resizePage());
      this.resizeObserver.observe(this.containerEl);
    }
  }

  onunload(): void {
    this.resizeObserver?.disconnect();
    if (this.surface) {
      unregisterInlineSurface(this.surface);
      this.surface.destroy();
    }
    if (this.timer !== null) window.clearTimeout(this.timer);
    if (this.dirty) void this.save().catch(() => undefined);
  }

  private surfaceSettings(): Partial<SurfaceSettings> {
    const settings = this.plugin.settings;
    return {
      fingerDrawing: false,
      sideButton: settings.sideButton,
      pressure: settings.pressure,
      twoFingerUndo: false,
      threeFingerRedo: false,
      swipePages: false,
      scribbleErase: settings.scribbleErase,
      holdToShape: settings.holdToShape,
      fit: "width",
      lowLatency: lowLatencyActive(settings),
      eink: einkActive(settings),
      passTouch: true,
    };
  }

  private addControls(): void {
    const button = (icon: string, label: string, run: () => void) => {
      const el = this.controls.createEl("button", { cls: "ink-block-button", attr: { "aria-label": label, title: label } });
      setIcon(el, icon);
      el.addEventListener("click", run);
      return el;
    };
    button("pen-tool", "Pen", () => this.surface.setTools({ tool: "pen" }));
    button("eraser", "Eraser", () => this.surface.setTools({ tool: "eraser" }));
    button("undo-2", "Undo", () => this.surface.undo());
    button("redo-2", "Redo", () => this.surface.redo());
    button("maximize-2", "Expand", () => void this.expand());
    this.updateControls();
  }

  private updateControls(): void {
    if (!this.controls || !this.surface) return;
    const buttons = [...this.controls.querySelectorAll("button")];
    buttons[0]?.toggleClass("is-active", this.surface.tools.tool === "pen");
    buttons[1]?.toggleClass("is-active", this.surface.tools.tool === "eraser");
    if (buttons[2]) buttons[2].disabled = !this.surface.history.canUndo;
    if (buttons[3]) buttons[3].disabled = !this.surface.history.canRedo;
  }

  private resizePage(): void {
    const page = this.surface?.page;
    if (!page) return;
    const width = Math.max(1, this.containerEl.clientWidth);
    this.pageEl.style.height = `${page.h * (Math.max(50, width - 24) / page.w) + 24}px`;
    this.surface.resize();
  }

  private changed(): void {
    if (!this.surface) return;
    if (inkBlockNeedsGrowth(this.surface.page)) this.surface.growPageBy(GROW_BY);
    this.dirty = true;
    this.revision++;
    this.resizePage();
    this.updateControls();
    if (this.timer !== null) window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => void this.save().catch(() => undefined), SAVE_DELAY_MS);
  }

  private async loadFile(initial = false): Promise<void> {
    if (!this.file) return;
    const parsed = parseInkFile(await this.plugin.app.vault.cachedRead(this.file));
    this.frontmatter = parsed.frontmatter;
    this.surface.load(parsed);
    this.dirty = false;
    this.resizePage();
    if (initial) this.containerEl.setAttr("aria-label", `Handwriting block from ${this.file.basename}`);
  }

  private async save(): Promise<void> {
    if (!this.file || !this.dirty) return;
    if (this.timer !== null) window.clearTimeout(this.timer);
    this.timer = null;
    const revision = this.revision;
    const text = serializeInkFile(this.frontmatter, this.surface.file);
    this.lastWritten = text;
    try {
      await this.plugin.app.vault.modify(this.file, text);
      if (revision === this.revision) this.dirty = false;
    } catch (error) {
      new Notice("Could not save the handwriting block. Your changes are still open.", 5000);
      console.error("Ink Notebook: handwriting block save failed", error);
      throw error;
    }
  }

  private async reloadIfExternal(): Promise<void> {
    if (!this.file || this.dirty) return;
    const text = await this.plugin.app.vault.cachedRead(this.file);
    if (text === this.lastWritten) return;
    this.lastWritten = null;
    try {
      await this.loadFile();
    } catch (error) {
      new Notice("The handwriting block could not be reloaded.", 5000);
      console.error("Ink Notebook: handwriting block reload failed", error);
    }
  }

  private async expand(): Promise<void> {
    await this.save();
    if (!this.file) return;
    await this.plugin.app.workspace.getLeaf(false).setViewState({
      type: INK_VIEW_TYPE,
      state: { file: this.file.path },
      active: true,
    });
  }
}

