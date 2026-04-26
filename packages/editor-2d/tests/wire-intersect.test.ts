// wire-intersect tests for M1.3d-Remediation-2 R5.
//
// Per-primitive narrow-phase tests. The critical regression case is
// "bbox overlaps rect but wire does NOT" — for diagonal lines and
// similar shapes whose AABB encompasses the rect but whose actual
// geometry stays outside.

import { LayerId, type Primitive, newPrimitiveId } from '@portplanner/domain';
import { describe, expect, it } from 'vitest';

import type { BBox } from '../src/canvas/bounding-boxes';
import { wireIntersectsRect } from '../src/canvas/wire-intersect';

function line(p1: { x: number; y: number }, p2: { x: number; y: number }): Primitive {
  return {
    id: newPrimitiveId(),
    kind: 'line',
    layerId: LayerId.DEFAULT,
    displayOverrides: {},
    p1,
    p2,
  };
}

function rect(minX: number, minY: number, maxX: number, maxY: number): BBox {
  return { minX, minY, maxX, maxY };
}

describe('wireIntersectsRect — point', () => {
  it('point inside rect → true', () => {
    const p: Primitive = {
      id: newPrimitiveId(),
      kind: 'point',
      layerId: LayerId.DEFAULT,
      displayOverrides: {},
      position: { x: 5, y: 5 },
    };
    expect(wireIntersectsRect(p, rect(0, 0, 10, 10))).toBe(true);
  });

  it('point outside rect → false', () => {
    const p: Primitive = {
      id: newPrimitiveId(),
      kind: 'point',
      layerId: LayerId.DEFAULT,
      displayOverrides: {},
      position: { x: 50, y: 50 },
    };
    expect(wireIntersectsRect(p, rect(0, 0, 10, 10))).toBe(false);
  });
});

describe('wireIntersectsRect — line', () => {
  it('line segment fully inside rect → true', () => {
    expect(wireIntersectsRect(line({ x: 1, y: 1 }, { x: 4, y: 4 }), rect(0, 0, 10, 10))).toBe(true);
  });

  it('line segment crossing rect side → true', () => {
    expect(wireIntersectsRect(line({ x: -5, y: 5 }, { x: 5, y: 5 }), rect(0, 0, 10, 10))).toBe(
      true,
    );
  });

  it('line segment fully outside rect with bbox NOT overlapping → false', () => {
    expect(
      wireIntersectsRect(line({ x: 100, y: 100 }, { x: 110, y: 110 }), rect(0, 0, 10, 10)),
    ).toBe(false);
  });

  it('REGRESSION: diagonal line with bbox OVERLAPPING rect but wire OUTSIDE → false', () => {
    // Line from (-5, 30) to (30, -5). Bbox = (-5, -5) to (30, 30).
    // Rect = (10, 10) to (15, 15). Bbox-overlaps-rect (true) but the
    // line wire (passing through y = -x + 25) at x ∈ [10, 15] gives
    // y ∈ [10, 15] reversed — actually y = 25 - x → at x = 10, y = 15;
    // at x = 15, y = 10. That's the diagonal of the rect (10,10)-(15,15)!
    // So this line DOES wire-cross the rect.
    //
    // Use a different shape: line from (-5, 50) to (50, -5). At x = 10,
    // y = 50 - x - (45/55)*0 ... let me parametrize: direction (55,
    // -55), normalized. y = 50 - (45/55)*(x+5) = 50 - 0.818*(x+5).
    // At x=10: y = 50 - 12.27 = 37.73. At x=15: y = 50 - 16.36 = 33.63.
    // So at the rect's x range, y is well above (33-37 vs rect's 10-15).
    // → no wire-rect intersection.
    expect(wireIntersectsRect(line({ x: -5, y: 50 }, { x: 50, y: -5 }), rect(10, 10, 15, 15))).toBe(
      false,
    );
  });
});

describe('wireIntersectsRect — polyline', () => {
  it('polyline with vertex inside rect → true', () => {
    const poly: Primitive = {
      id: newPrimitiveId(),
      kind: 'polyline',
      layerId: LayerId.DEFAULT,
      displayOverrides: {},
      vertices: [
        { x: -10, y: 5 },
        { x: 5, y: 5 },
        { x: 5, y: -10 },
      ],
      bulges: [0, 0],
      closed: false,
    };
    expect(wireIntersectsRect(poly, rect(0, 0, 10, 10))).toBe(true);
  });

  it('polyline whose segment crosses rect (no vertex inside) → true', () => {
    const poly: Primitive = {
      id: newPrimitiveId(),
      kind: 'polyline',
      layerId: LayerId.DEFAULT,
      displayOverrides: {},
      vertices: [
        { x: -5, y: 5 },
        { x: 15, y: 5 },
      ],
      bulges: [0],
      closed: false,
    };
    expect(wireIntersectsRect(poly, rect(0, 0, 10, 10))).toBe(true);
  });

  it('polyline fully outside rect → false', () => {
    const poly: Primitive = {
      id: newPrimitiveId(),
      kind: 'polyline',
      layerId: LayerId.DEFAULT,
      displayOverrides: {},
      vertices: [
        { x: 100, y: 100 },
        { x: 110, y: 100 },
        { x: 110, y: 110 },
      ],
      bulges: [0, 0],
      closed: false,
    };
    expect(wireIntersectsRect(poly, rect(0, 0, 10, 10))).toBe(false);
  });
});

describe('wireIntersectsRect — circle', () => {
  it('rect inside circle (all corners within radius) → true', () => {
    const circle: Primitive = {
      id: newPrimitiveId(),
      kind: 'circle',
      layerId: LayerId.DEFAULT,
      displayOverrides: {},
      center: { x: 0, y: 0 },
      radius: 100,
    };
    expect(wireIntersectsRect(circle, rect(-5, -5, 5, 5))).toBe(true);
  });

  it('circle outline crossing rect side → true', () => {
    const circle: Primitive = {
      id: newPrimitiveId(),
      kind: 'circle',
      layerId: LayerId.DEFAULT,
      displayOverrides: {},
      center: { x: 0, y: 0 },
      radius: 5,
    };
    expect(wireIntersectsRect(circle, rect(3, -10, 10, 10))).toBe(true);
  });

  it('circle far away from rect → false', () => {
    const circle: Primitive = {
      id: newPrimitiveId(),
      kind: 'circle',
      layerId: LayerId.DEFAULT,
      displayOverrides: {},
      center: { x: 100, y: 100 },
      radius: 5,
    };
    expect(wireIntersectsRect(circle, rect(0, 0, 10, 10))).toBe(false);
  });
});

describe('wireIntersectsRect — xline', () => {
  it('xline crossing rect → true', () => {
    const xl: Primitive = {
      id: newPrimitiveId(),
      kind: 'xline',
      layerId: LayerId.DEFAULT,
      displayOverrides: {},
      pivot: { x: 5, y: 5 },
      angle: 0,
    };
    expect(wireIntersectsRect(xl, rect(0, 0, 10, 10))).toBe(true);
  });

  it('xline parallel and outside rect → false', () => {
    const xl: Primitive = {
      id: newPrimitiveId(),
      kind: 'xline',
      layerId: LayerId.DEFAULT,
      displayOverrides: {},
      pivot: { x: 100, y: 100 },
      angle: 0, // horizontal at y=100
    };
    expect(wireIntersectsRect(xl, rect(0, 0, 10, 10))).toBe(false);
  });
});
