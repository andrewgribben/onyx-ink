// AGPL-3.0-or-later. Part of the Onyx Ink fork (Singularity Notebook) of Ink Notebook, modified by Andrew Gribben, 2026.

/**
 * Finger scrolling for inline blocks. The browser's own scrolling (touch-action: pan-y) also applies to the pen,
 * so a vertical pen stroke scrolled the note mid-stroke and the replayed Onyx stroke landed in the wrong place.
 * The block keeps touch-action: none and scrolls the note itself for touch pointers only.
 */
export class TouchScroll {
  private last = new Map<number, number>();

  constructor(private el: HTMLElement) {}

  down(e: PointerEvent): void {
    this.last.set(e.pointerId, e.clientY);
  }

  move(e: PointerEvent): void {
    const y = this.last.get(e.pointerId);
    if (y === undefined) return;
    this.last.set(e.pointerId, e.clientY);
    const scroller = scrollParent(this.el);
    if (scroller) scroller.scrollTop += y - e.clientY;
  }

  up(e: PointerEvent): void {
    this.last.delete(e.pointerId);
  }
}

export function scrollParent(el: HTMLElement): HTMLElement | null {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const overflow = getComputedStyle(p).overflowY;
    if ((overflow === "auto" || overflow === "scroll") && p.scrollHeight > p.clientHeight) return p;
  }
  return null;
}
