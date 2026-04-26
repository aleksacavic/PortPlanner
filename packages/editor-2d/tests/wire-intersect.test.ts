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
  function circleP(cx: number, cy: number, r: number): Primitive {
    return {
      id: newPrimitiveId(),
      kind: 'circle',
      layerId: LayerId.DEFAULT,
      displayOverrides: {},
      center: { x: cx, y: cy },
      radius: r,
    };
  }

  it('REGRESSION (post-commit bug fix): rect fully inside circle (wire NOT touching) → false', () => {
    // Procedure-05 round bug: earlier impl had `if (allInside) return
    // true` which selected a circle whenever the selection rect's
    // corners were all within the circle radius — even though the
    // CIRCLE WIRE (outline) was outside the rect. AutoCAD crossing
    // semantic ("wire touches box") rejects this.
    expect(wireIntersectsRect(circleP(0, 0, 100), rect(-5, -5, 5, 5))).toBe(false);
  });

  it('circle outline crossing a rect side → true', () => {
    expect(wireIntersectsRect(circleP(0, 0, 5), rect(3, -10, 10, 10))).toBe(true);
  });

  it('circle fully inside rect (entity wire inside selection rect) → true', () => {
    // Opposite direction from the regression: the circle's outline IS
    // inside the rect, so the wire is inside the box. Crossing semantic
    // ("wholly within OR crossing") matches.
    expect(wireIntersectsRect(circleP(5, 5, 1), rect(0, 0, 10, 10))).toBe(true);
  });

  it('circle far away from rect → false', () => {
    expect(wireIntersectsRect(circleP(100, 100, 5), rect(0, 0, 10, 10))).toBe(false);
  });

  it('circle wire tangent to rect side → true (flatten-js intersect counts tangents)', () => {
    // Circle radius 5 at (0, 0); rect from (5, -10) to (15, 10) touches
    // the circle at exactly (5, 0). flatten-js Segment.intersect(Circle)
    // counts tangent intersections.
    expect(wireIntersectsRect(circleP(0, 0, 5), rect(5, -10, 15, 10))).toBe(true);
  });
});

describe('wireIntersectsRect — rectangle', () => {
  function rectangleP(
    originX: number,
    originY: number,
    width: number,
    height: number,
    angle = 0,
  ): Primitive {
    return {
      id: newPrimitiveId(),
      kind: 'rectangle',
      layerId: LayerId.DEFAULT,
      displayOverrides: {},
      origin: { x: originX, y: originY },
      width,
      height,
      localAxisAngle: angle,
    };
  }

  it('REGRESSION (post-commit bug fix): selection rect fully inside entity rectangle → false', () => {
    // Procedure-05 round bug: earlier impl had a pointInPolygon check
    // returning true whenever a selection-rect corner was inside the
    // entity polygon. That selected the entity whenever the selection
    // rect was fully inside it — but the entity's wire is OUTSIDE the
    // selection rect.
    expect(wireIntersectsRect(rectangleP(-100, -100, 200, 200), rect(-5, -5, 5, 5))).toBe(false);
  });

  it('entity rectangle fully inside selection rect (all 4 corners hit) → true', () => {
    // Each entity corner is inside the selection rect → the
    // existing corner-inside-rect check returns true on the first.
    expect(wireIntersectsRect(rectangleP(2, 2, 4, 4), rect(0, 0, 10, 10))).toBe(true);
  });

  it('entity rectangle side crosses selection rect side → true', () => {
    // 10×10 rectangle from (5, -2) to (15, 8); selection rect (0..10, 0..10).
    // Entity-rect right side x=15 doesn't cross. Entity-rect bottom y=-2
    // doesn't reach. Entity-rect left side x=5 from y=-2 to y=8 — the
    // segment from (5,-2) to (5,8) crosses the rect's bottom edge at
    // (5, 0). Wire touches → true.
    expect(wireIntersectsRect(rectangleP(5, -2, 10, 10), rect(0, 0, 10, 10))).toBe(true);
  });

  it('entity rectangle entirely outside selection rect → false', () => {
    expect(wireIntersectsRect(rectangleP(50, 50, 5, 5), rect(0, 0, 10, 10))).toBe(false);
  });

  it('rotated entity rectangle whose wire crosses selection rect → true', () => {
    // A 10×2 rectangle rotated 45° around origin has a long diagonal
    // wire that sweeps through the selection rect (-3, -3, 3, 3).
    expect(wireIntersectsRect(rectangleP(-5, 0, 10, 2, Math.PI / 4), rect(-3, -3, 3, 3))).toBe(
      true,
    );
  });
});

describe('wireIntersectsRect — arc', () => {
  function arcP(
    cx: number,
    cy: number,
    r: number,
    startAngle: number,
    endAngle: number,
  ): Primitive {
    return {
      id: newPrimitiveId(),
      kind: 'arc',
      layerId: LayerId.DEFAULT,
      displayOverrides: {},
      center: { x: cx, y: cy },
      radius: r,
      startAngle,
      endAngle,
    };
  }

  it('arc endpoint inside selection rect → true', () => {
    // Arc from (5, 0) to (0, 5) — quarter arc, radius 5, center (0, 0).
    // Selection rect (4, -1, 6, 1) contains the start endpoint (5, 0).
    expect(wireIntersectsRect(arcP(0, 0, 5, 0, Math.PI / 2), rect(4, -1, 6, 1))).toBe(true);
  });

  it('arc midpoint inside selection rect → true', () => {
    // Same quarter arc; midpoint at angle π/4 → (5/√2, 5/√2) ≈ (3.54, 3.54).
    expect(wireIntersectsRect(arcP(0, 0, 5, 0, Math.PI / 2), rect(3, 3, 4, 4))).toBe(true);
  });

  it('arc curve crossing rect side (no endpoint inside) → true', () => {
    // Quarter arc from (5, 0) to (0, 5); selection rect across the
    // arc's mid-region at (2, 2)-(4, 4). No endpoints inside; the arc
    // curves through the region.
    expect(wireIntersectsRect(arcP(0, 0, 5, 0, Math.PI / 2), rect(2, 2, 4, 4))).toBe(true);
  });

  it('arc whose convex region encloses the rect but wire does NOT touch → false', () => {
    // Half-arc from (10, 0) to (-10, 0) (top half). Selection rect
    // small in the middle (-3, 1)-(3, 4). Arc radius 10, so the arc
    // curve is way above (y up to 10). Selection rect is below the arc.
    // Wire doesn't touch the rect.
    expect(wireIntersectsRect(arcP(0, 0, 10, 0, Math.PI), rect(-3, 1, 3, 4))).toBe(false);
  });

  it('arc fully outside rect (wire and bbox both outside) → false', () => {
    // Quarter arc at (100, 100), radius 5; rect at origin.
    expect(wireIntersectsRect(arcP(100, 100, 5, 0, Math.PI / 2), rect(0, 0, 10, 10))).toBe(false);
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
