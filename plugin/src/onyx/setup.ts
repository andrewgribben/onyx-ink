// AGPL-3.0-or-later. Part of the Onyx Ink fork (Singularity Notebook) of Ink Notebook, modified by Andrew Gribben, 2026.

import { Notice, Platform } from "obsidian";
import type InkNotebookPlugin from "../main";
import { OnyxBridge } from "./bridge";
import { OnyxDiagnostics } from "./diagnostics";
import { OnyxRegion } from "./region";
import { setOnyxBridge, setOnyxSettings } from "./state";
export { onyxBridge, onyxSettings } from "./state";

export function setupOnyx(plugin: InkNotebookPlugin): void {
  setOnyxSettings(plugin.settings);
  const createBridge = (): OnyxBridge => new OnyxBridge(
    plugin.settings.onyxPort,
    plugin.settings.onyxBridge,
    plugin.manifest.version,
    undefined,
    Platform.isAndroidApp,
    (message) => new Notice(message),
  );
  let bridge = createBridge();
  setOnyxBridge(bridge);
  let region = Platform.isAndroidApp && plugin.settings.onyxBridge !== "off" ? new OnyxRegion(plugin.app) : null;
  const restart = (): void => {
    region?.destroy();
    region = null;
    bridge.destroy();
    bridge = createBridge();
    setOnyxBridge(bridge);
    if (Platform.isAndroidApp && plugin.settings.onyxBridge !== "off") region = new OnyxRegion(plugin.app);
    window.dispatchEvent(new Event("onyx-bridge-change"));
  };
  plugin.addCommand({
    id: "toggle-onyx-bridge",
    name: "Toggle Onyx pen bridge",
    callback: () => {
      plugin.settings.onyxBridge = plugin.settings.onyxBridge === "off" ? "auto" : "off";
      void plugin.saveSettings();
      restart();
      new Notice(`Onyx pen bridge ${plugin.settings.onyxBridge}.`);
    },
  });
  plugin.addCommand({
    id: "show-onyx-bridge-diagnostics",
    name: "Show Onyx bridge diagnostics",
    callback: () => new OnyxDiagnostics(plugin.app, bridge, plugin.manifest.id).open(),
  });
  plugin.register(() => {
    region?.destroy();
    region = null;
    bridge.destroy();
    setOnyxBridge(null);
    setOnyxSettings(null);
    window.dispatchEvent(new Event("onyx-bridge-change"));
  });
}
