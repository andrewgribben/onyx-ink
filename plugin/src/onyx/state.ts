// AGPL-3.0-or-later. Part of the Onyx Ink fork (Singularity Notebook) of Ink Notebook, modified by Andrew Gribben, 2026.

import type { InkSettings } from "../settings";
import type { OnyxBridge } from "./bridge";
import type { InkSurface } from "../ink/surface";

let currentBridge: OnyxBridge | null = null;
let currentSettings: InkSettings | null = null;
const inlineSurfaces = new Set<InkSurface>();

export function registerInlineSurface(surface: InkSurface): void {
  inlineSurfaces.add(surface);
  onyxSurfaceChanged();
}

export function unregisterInlineSurface(surface: InkSurface): void {
  inlineSurfaces.delete(surface);
  onyxSurfaceChanged();
}

export function inlineInkSurfaces(): InkSurface[] {
  return [...inlineSurfaces];
}

export function onyxBridge(): OnyxBridge | null {
  return currentBridge;
}

export function onyxSettings(): InkSettings | null {
  return currentSettings;
}

export function setOnyxBridge(bridge: OnyxBridge | null): void {
  currentBridge = bridge;
}

export function setOnyxSettings(settings: InkSettings | null): void {
  currentSettings = settings;
}

export function onyxSurfaceChanged(): void {
  window.dispatchEvent(new Event("onyx-surface-change"));
}
