// AGPL-3.0-or-later. Part of the Onyx Ink fork (Singularity Notebook) of Ink Notebook, modified by Andrew Gribben, 2026.

import { describe, expect, it } from "vitest";
import { parseMessage } from "../src/onyx/protocol";

describe("Onyx protocol", () => {
  it("parses upstream v1 strokes without changing millisecond timestamps", () => {
    const message = parseMessage(JSON.stringify({
      type: "stroke", w: 100, h: 200, ox: 4, oy: 5, pts: [[1, 2, 4096, 0], [3, 4, 2000, 1730000000000]], extra: true,
    }));
    expect(message).toMatchObject({ type: "stroke", v: 1, pts: [[1, 2, 4096, 0], [3, 4, 2000, 1730000000000]] });
  });

  it("parses v2 companion messages and ignores unknown fields", () => {
    expect(parseMessage('{"type":"hello","v":2,"app":"companion","version":"1","screen":{"w":1,"h":2},"pressureMax":4096,"x":1}'))
      .toMatchObject({ type: "hello", screen: { w: 1, h: 2 } });
    expect(parseMessage('{"type":"state","v":2,"raw":"enabled"}')).toMatchObject({ type: "state", raw: "enabled" });
    expect(parseMessage('{"type":"stroke","v":2,"id":42,"w":2,"h":2,"ox":0,"oy":0,"pts":[[0,0,1,1730000000000]]}'))
      .toMatchObject({ type: "stroke", v: 2, id: 42 });
  });

  it("returns null for unknown types and malformed frames without throwing", () => {
    for (const raw of ["", "{", "{}", '{"type":"unknown"}',
      '{"type":"state","v":2,"raw":"other"}',
      '{"type":"stroke","w":1,"h":1,"ox":0,"oy":0,"pts":[[0,0,0,NaN]]}',
      '{"type":"stroke","v":2,"id":1.5,"w":1,"h":1,"ox":0,"oy":0,"pts":[[0,0,0,1]]}',
      '{"type":"stroke","w":1,"h":1,"ox":0,"oy":0,"pts":[[0,0,0]]}',
      '{"type":"hello","v":2,"app":"x","version":"1","screen":{"w":1,"h":"2"},"pressureMax":4096}']) {
      expect(() => parseMessage(raw)).not.toThrow();
      expect(parseMessage(raw)).toBeNull();
    }
  });
});
