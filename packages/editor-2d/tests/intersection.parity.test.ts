// Phase 1 parity fixtures locking the dispatcher refactor's bit-
// identical-behaviour guarantee. Per the snap-engine-extension plan
// §1.3 self-audit + Codex Round-1 H1 fix:
//
//   F1 — single line  → no self-intersection.
//   F2 — single open polyline (3 vertices, no self-cross) → emits the
//        shared interior vertex (because `lineLineIntersection`
//        clamps t/u to [0,1] inclusive, so adjacent segments at the
//        shared endpoint emit it).
//   F3 — single polyline shaped like a figure-8 → emits the actual
//        crossing point + the adjacency points.
//   F4 — two crossing lines → emits the crossing.
//   F5 — line + circle. **Phase 1 SKIP-marker:** asserts current
//        empty result (line-circle intersection NOT yet supported in
//        the dispatcher table at Phase 1 commit). Phase 2 will flip
//        this fixture to assert `[X1, X2]` after `lineCircle` is
//        registered. The flip is the explicit Phase 1→Phase 2
//        transition gate — no silent drift.

import {
  type CirclePrimitive,
  LayerId,
  type LinePrimitive,
  type Polyline,
  newPrimitiveId,
} from '@portplanner/domain';
import { describe, expect, it } from 'vitest';

import { intersect, selfIntersect } from '../src/snap/intersection';

const LAYER = LayerId.DEFAULT;
const NO_OVERRIDES = {} as never;

function makeLine(p1: { x: number; y: number }, p2: { x: number; y: number }): LinePrimitive {
  return {
    id: newPrimitiveId(),
    kind: 'line',
    layerId: LAYER,
    displayOverrides: NO_OVERRIDES,
    p1,
    p2,
  };
}

function makePolyline(vertices: Array<{ x: number; y: number }>, closed: boolean): Polyline {
  const segCount = closed ? vertices.length : vertices.length - 1;
  return {
    id: newPrimitiveId(),
    kind: 'polyline',
    layerId: LAYER,
    displayOverrides: NO_OVERRIDES,
    vertices,
    bulges: new Array(segCount).fill(0),
    closed,
  };
}

function makeCircle(center: { x: number; y: number }, radius: number): CirclePrimitive {
  return {
    id: newPrimitiveId(),
    kind: 'circle',
    layerId: LAYER,
    displayOverrides: NO_OVERRIDES,
    center,
    radius,
  };
}

describe('intersection parity fixtures (Phase 1 refactor preserves osnap.ts:intersectionsOf behaviour bit-identically)', () => {
  it('F1 — single line: selfIntersect = []', () => {
    const line = makeLine({ x: 0, y: 0 }, { x: 10, y: 0 });
    expect(selfIntersect(line)).toEqual([]);
  });

  it('F2 — open polyline ABC (no self-cross): emits shared vertex B (adjacency intersection)', () => {
    const A = { x: 0, y: 0 };
    const B = { x: 5, y: 0 };
    const C = { x: 10, y: 5 };
    const poly = makePolyline([A, B, C], false);
    const result = selfIntersect(poly);
    // Adjacency: segments AB and BC share endpoint B.
    expect(result).toHaveLength(1);
    expect(result[0]?.x).toBeCloseTo(B.x, 9);
    expect(result[0]?.y).toBeCloseTo(B.y, 9);
  });

  it('F3 — polyline shaped like figure-8: emits the cross point + 2 adjacency points (3 total)', () => {
    // Vertices form X: A→B (top-left to bottom-right), B→C (bottom-
    // right to top-right), C→D (top-right to bottom-left). Segments
    // AB and CD cross at point (5, 5).
    const A = { x: 0, y: 0 };
    const B = { x: 10, y: 10 };
    const C = { x: 10, y: 0 };
    const D = { x: 0, y: 10 };
    const poly = makePolyline([A, B, C, D], false);
    const result = selfIntersect(poly);
    // Adjacency: AB ∩ BC at B (10,10); BC ∩ CD at C (10,0).
    // Crossing: AB ∩ CD at (5,5).
    expect(result).toHaveLength(3);
    // Sort by x then y for stable comparison.
    const sorted = [...result].sort((a, b) => a.x - b.x || a.y - b.y);
    expect(sorted[0]?.x).toBeCloseTo(5, 9);
    expect(sorted[0]?.y).toBeCloseTo(5, 9);
    expect(sorted[1]?.x).toBeCloseTo(10, 9);
    expect(sorted[1]?.y).toBeCloseTo(0, 9);
    expect(sorted[2]?.x).toBeCloseTo(10, 9);
    expect(sorted[2]?.y).toBeCloseTo(10, 9);
  });

  it('F4 — two crossing lines: emits the crossing point', () => {
    const horizontal = makeLine({ x: 0, y: 5 }, { x: 10, y: 5 });
    const vertical = makeLine({ x: 5, y: 0 }, { x: 5, y: 10 });
    const result = intersect(horizontal, vertical);
    expect(result).toHaveLength(1);
    expect(result[0]?.x).toBeCloseTo(5, 9);
    expect(result[0]?.y).toBeCloseTo(5, 9);
  });

  it('F4b — symmetric: intersect(b, a) returns the same crossing as intersect(a, b)', () => {
    const horizontal = makeLine({ x: 0, y: 5 }, { x: 10, y: 5 });
    const vertical = makeLine({ x: 5, y: 0 }, { x: 5, y: 10 });
    const ab = intersect(horizontal, vertical);
    const ba = intersect(vertical, horizontal);
    expect(ab).toEqual(ba);
  });

  it('F4c — parallel lines do not intersect', () => {
    const a = makeLine({ x: 0, y: 0 }, { x: 10, y: 0 });
    const b = makeLine({ x: 0, y: 5 }, { x: 10, y: 5 });
    expect(intersect(a, b)).toEqual([]);
  });

  it('F4d — non-overlapping segments on the same line do not intersect (clamp catches)', () => {
    const a = makeLine({ x: 0, y: 0 }, { x: 5, y: 0 });
    const b = makeLine({ x: 10, y: 0 }, { x: 15, y: 0 });
    expect(intersect(a, b)).toEqual([]);
  });

  // F5 — flipped at Phase 2 commit per REM8-P2-ParityF5Flipped gate.
  // Phase 1 asserted [] (lineCircle not yet registered); Phase 2 has
  // lineCircle registered and a chord-crossing line returns the two
  // entry/exit points. The flip is the explicit transition marker —
  // any future regression that loses Phase 2's lineCircle wiring
  // surfaces here.
  it('F5 — Phase 2 (lineCircle registered): line crossing a circle as a chord returns the 2 intersection points', () => {
    // Line from (-5, 0) to (5, 0); circle center (0, 0) radius 3.
    // Chord crosses the circle at (-3, 0) and (3, 0).
    const line = makeLine({ x: -5, y: 0 }, { x: 5, y: 0 });
    const circle = makeCircle({ x: 0, y: 0 }, 3);
    const result = intersect(line, circle);
    expect(result).toHaveLength(2);
    const sorted = [...result].sort((a, b) => a.x - b.x);
    expect(sorted[0]?.x).toBeCloseTo(-3, 9);
    expect(sorted[0]?.y).toBeCloseTo(0, 9);
    expect(sorted[1]?.x).toBeCloseTo(3, 9);
    expect(sorted[1]?.y).toBeCloseTo(0, 9);
  });
});
