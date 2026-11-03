// AGPL-3.0-or-later. Part of the Onyx Ink fork (Singularity Notebook) of Ink Notebook, modified by Andrew Gribben, 2026.

export type Box = { x: number; y: number; w: number; h: number };
export type PointerStroke = { id: string; bbox: Box; upTime: number; points?: unknown };
export type OnyxStroke = { bbox: Box; arrivalTime: number; [key: string]: unknown };
export type Outcome =
  | { type: "matched"; pointerId: string; onyxStroke: OnyxStroke }
  | { type: "fallback"; pointerStroke: PointerStroke }
  | { type: "orphan"; onyxStroke: OnyxStroke }
  | { type: "late"; onyxStroke: OnyxStroke };

export class StrokeMatcher {
  private pointers: PointerStroke[] = [];
  private onyx: OnyxStroke[] = [];
  private settled: Array<{ bbox: Box; upTime: number }> = [];

  constructor(private matchWindowMs = 600, private fallbackMs = 350, private pad = 24) {}

  addPointerStroke(stroke: PointerStroke): void {
    this.pointers.push(stroke);
  }

  addOnyxStroke(stroke: OnyxStroke): void {
    this.onyx.push(stroke);
  }

  poll(now: number): Outcome[] {
    const outcomes: Outcome[] = [];
    // Settled strokes only need remembering long enough to catch a late overlay frame.
    this.settled = this.settled.filter((item) => now - item.upTime <= 2000);
    for (const stroke of this.onyx) {
      const candidates = this.pointers
        .filter((pointer) => stroke.arrivalTime >= pointer.upTime && stroke.arrivalTime - pointer.upTime <= this.matchWindowMs &&
          this.overlap(pointer.bbox, stroke.bbox))
        .sort((a, b) => a.upTime - b.upTime);
      const pointer = candidates[0];
      if (pointer) {
        this.pointers = this.pointers.filter((item) => item !== pointer);
        this.settled.push({ bbox: pointer.bbox, upTime: pointer.upTime });
        outcomes.push({ type: "matched", pointerId: pointer.id, onyxStroke: stroke });
      } else if (this.settled.some((item) => stroke.arrivalTime >= item.upTime &&
          this.overlap(item.bbox, stroke.bbox))) {
        // A late overlay frame is dropped as late so it can never be replayed as a duplicate orphan.
        outcomes.push({ type: "late", onyxStroke: stroke });
      } else {
        outcomes.push({ type: "orphan", onyxStroke: stroke });
      }
    }
    this.onyx = [];
    const pending: PointerStroke[] = [];
    for (const pointer of this.pointers) {
      if (now - pointer.upTime >= this.fallbackMs) {
        this.settled.push({ bbox: pointer.bbox, upTime: pointer.upTime });
        outcomes.push({ type: "fallback", pointerStroke: pointer });
      } else {
        pending.push(pointer);
      }
    }
    this.pointers = pending;
    return outcomes;
  }

  private overlap(a: Box, b: Box): boolean {
    return a.x - this.pad <= b.x + b.w && a.x + a.w + this.pad >= b.x &&
      a.y - this.pad <= b.y + b.h && a.y + a.h + this.pad >= b.y;
  }
}
