// AGPL-3.0-or-later. Part of the Onyx Ink fork (Singularity Notebook) of Ink Notebook, modified by Andrew Gribben, 2026.

import { afterEach, describe, expect, it, vi } from "vitest";
import { InputRouter } from "../src/ink/input";
import { TouchScroll } from "../src/onyx/touchScroll";

describe("InputRouter passTouch", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("scrolls the note with a finger instead of drawing", () => {
    vi.stubGlobal("Element", class {});
    vi.stubGlobal("getComputedStyle", () => ({ overflowY: "auto" }));
    const scroller = { scrollTop: 100, scrollHeight: 2000, clientHeight: 500, parentElement: null };
    const el = { parentElement: scroller, setPointerCapture: vi.fn() };
    const router = Object.create(InputRouter.prototype) as InputRouter;
    Object.assign(router, { s: { el, settings: { passTouch: true } }, touchScroll: new TouchScroll(el as unknown as HTMLElement) });
    const at = (clientY: number) => ({ pointerType: "touch", pointerId: 3, clientY, target: null, stopPropagation: vi.fn() });
    (router as any).onDown(at(300));
    (router as any).onMove(at(260), false);
    (router as any).onUp(at(260));
    (router as any).onMove(at(100), false);
    expect(scroller.scrollTop).toBe(140);
  });
});
