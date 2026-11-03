// AGPL-3.0-or-later. Part of the Onyx Ink fork (Singularity Notebook) of Ink Notebook, modified by Andrew Gribben, 2026.

import { afterEach, describe, expect, it, vi } from "vitest";
import { InputRouter } from "../src/ink/input";

describe("InputRouter passTouch", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("ignores touch pointers without cancelling the browser gesture", () => {
    vi.stubGlobal("Element", class {});
    const router = Object.create(InputRouter.prototype) as InputRouter;
    Object.assign(router, { s: { settings: { passTouch: true } } });
    const event = { pointerType: "touch", target: null, preventDefault: vi.fn(), stopPropagation: vi.fn() };
    (router as any).onDown(event);
    (router as any).onMove(event, false);
    (router as any).onUp(event);
    (router as any).onCancel(event);
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(event.stopPropagation).not.toHaveBeenCalled();
  });
});
