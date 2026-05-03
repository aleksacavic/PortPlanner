// M1.3b fillet-chamfer Phase 1 — domain tests for fillet helpers.
// Covers the 11 input-pattern rows from the plan §6.1.0 decision table
// across the three exported helpers. Geometry values verified against
// hand-computed expected positions for 90° and oblique corners.

import { describe, expect, it } from 'vitest';

import {
  filletLineAndPolylineEndpoint,
  filletPolylineCorner,
  filletTwoLines,
} from '../src/transforms';
import type { LinePrimitive, PolylinePrimitive } from '../src/types/primitive';

const FLOAT_TOL = 1e-9;

function makeLine(p1x: number, p1y: number, p2x: number, p2y: number): LinePrimitive {
  return {
    id: 'l1' as LinePrimitive['id'],
    kind: 'line',
    layerId: 'layer-default' as LinePrimitive['layerId'],
    displayOverrides: {},
    p1: { x: p1x, y: p1y },
    p2: { x: p2x, y: p2y },
  };
}

function makePolyline(
  vertices: Array<[number, number]>,
  bulges: number[],
  closed = false,
): PolylinePrimitive {
  return {
    id: 'pl1' as PolylinePrimitive['id'],
    kind: 'polyline',
    layerId: 'layer-default' as PolylinePrimitive['layerId'],
    displayOverrides: {},
    vertices: vertices.map(([x, y]) => ({ x, y })),
    bulges,
    closed,
  };
}

describe('filletTwoLines', () => {
  it('90° corner: trims both lines by R and emits arc with R=2 at expected center', () => {
    // L1: (-5,0) → (5,0)  horizontal through origin
    // L2: (0,-5) → (0,5)  vertical through origin
    // pickHints near (4,0) and (0,4) → keep east end of L1, north end of L2
    const l1 = makeLine(-5, 0, 5, 0);
    const l2 = makeLine(0, -5, 0, 5);
    const result = filletTwoLines(l1, l2, 2, {
      p1Hint: { x: 4, y: 0 },
      p2Hint: { x: 0, y: 4 },
    });
    // L1: trimmed end (originally p1=(-5,0)) moves to (2, 0); kept end (5,0).
    expect(result.l1Updated.p1.x).toBeCloseTo(2, 9);
    expect(result.l1Updated.p1.y).toBeCloseTo(0, 9);
    expect(result.l1Updated.p2).toEqual({ x: 5, y: 0 });
    // L2: trimmed end (originally p1=(0,-5)) moves to (0, 2); kept end (0,5).
    expect(result.l2Updated.p1.x).toBeCloseTo(0, 9);
    expect(result.l2Updated.p1.y).toBeCloseTo(2, 9);
    expect(result.l2Updated.p2).toEqual({ x: 0, y: 5 });
    // Arc center on bisector at distance R*√2 = 2√2 from corner = (2, 2).
    expect(result.newArc.kind).toBe('arc');
    expect(result.newArc.center.x).toBeCloseTo(2, 9);
    expect(result.newArc.center.y).toBeCloseTo(2, 9);
    expect(result.newArc.radius).toBe(2);
    // Sweep is the short side (π/2).
    const sweep = result.newArc.endAngle - result.newArc.startAngle;
    expect(sweep).toBeCloseTo(Math.PI / 2, 9);
  });

  it('30° oblique corner: trim distance = R/tan(15°) and arc is equidistant from tangent points', () => {
    // Vertical L1 going up; L2 at 60° from horizontal going up-right.
    // u1=(0,1), u2=(cos60°, sin60°)=(0.5, 0.866). Angle between them
    // (interior corner angle θ) = acos(u1·u2) = acos(0.866) = 30° = π/6.
    // Per the corrected formula d = R·cot(θ/2) = R / tan(15°) ≈ R·3.732.
    // For R=1: d ≈ 3.732. L1 length from corner (0,0) to kept (0,5) is 5,
    // so d=3.732 < 5 — no throw.
    const l1 = makeLine(0, -5, 0, 5);
    const l2 = makeLine(0, 0, 10, Math.tan(Math.PI / 3) * 10);
    const result = filletTwoLines(l1, l2, 1, {
      p1Hint: { x: 0, y: 4 },
      p2Hint: { x: 8, y: Math.tan(Math.PI / 3) * 8 },
    });
    const expectedD = 1 / Math.tan(Math.PI / 12);
    expect(result.l1Updated.p1.x).toBeCloseTo(0, 9);
    expect(result.l1Updated.p1.y).toBeCloseTo(expectedD, 9);
    expect(result.l1Updated.p2).toEqual({ x: 0, y: 5 });
    // Critical: arc must be equidistant (radius=R=1) from BOTH tangent
    // points. This is the bug-fix anchor — the prior trimDistance formula
    // produced an arc center NOT equidistant from the trim points, which
    // is the root cause of the visual misalignment users saw on non-90°
    // fillets.
    const t1 = result.l1Updated.p1; // tangent on L1 at the trim point
    const t2 = {
      x: l2.p1.x + 0.5 * expectedD,
      y: l2.p1.y + Math.sin(Math.PI / 3) * expectedD,
    };
    const c = result.newArc.center;
    expect(Math.hypot(c.x - t1.x, c.y - t1.y)).toBeCloseTo(1, 9);
    expect(Math.hypot(c.x - t2.x, c.y - t2.y)).toBeCloseTo(1, 9);
  });

  it('throws on parallel lines', () => {
    const l1 = makeLine(0, 0, 10, 0);
    const l2 = makeLine(0, 1, 10, 1);
    expect(() =>
      filletTwoLines(l1, l2, 1, { p1Hint: { x: 5, y: 0 }, p2Hint: { x: 5, y: 1 } }),
    ).toThrow(/parallel/);
  });

  it('throws when trim distance ≥ source segment length', () => {
    // Short line + huge radius → trim distance > segment length.
    const l1 = makeLine(0, 0, 1, 0);
    const l2 = makeLine(0, 0, 0, 1);
    expect(() =>
      filletTwoLines(l1, l2, 100, { p1Hint: { x: 1, y: 0 }, p2Hint: { x: 0, y: 1 } }),
    ).toThrow(/too large|trim distance|max/);
  });

  it('throws on radius ≤ 0', () => {
    const l1 = makeLine(-5, 0, 5, 0);
    const l2 = makeLine(0, -5, 0, 5);
    expect(() =>
      filletTwoLines(l1, l2, 0, { p1Hint: { x: 4, y: 0 }, p2Hint: { x: 0, y: 4 } }),
    ).toThrow(/radius/);
    expect(() =>
      filletTwoLines(l1, l2, -1, { p1Hint: { x: 4, y: 0 }, p2Hint: { x: 0, y: 4 } }),
    ).toThrow(/radius/);
  });
});

describe('filletPolylineCorner', () => {
  it('open polyline 90° interior vertex: replaces K with [P1, P2] + correct bulge', () => {
    // L-shape: (0,0) → (10,0) → (10,10). Corner at vertex 1.
    const p = makePolyline(
      [
        [0, 0],
        [10, 0],
        [10, 10],
      ],
      [0, 0],
    );
    const result = filletPolylineCorner(p, 1, 2);
    // Expected: vertex 1 replaced by P1=(8,0) and P2=(10,2).
    expect(result.vertices.length).toBe(4);
    expect(result.vertices[0]).toEqual({ x: 0, y: 0 });
    expect(result.vertices[1]!.x).toBeCloseTo(8, 9);
    expect(result.vertices[1]!.y).toBeCloseTo(0, 9);
    expect(result.vertices[2]!.x).toBeCloseTo(10, 9);
    expect(result.vertices[2]!.y).toBeCloseTo(2, 9);
    expect(result.vertices[3]).toEqual({ x: 10, y: 10 });
    // Bulges: insert tan(π/8) at index 1; flanking segments stay 0.
    expect(result.bulges.length).toBe(3);
    expect(result.bulges[0]).toBe(0);
    expect(Math.abs(result.bulges[1]!) - Math.tan(Math.PI / 8)).toBeLessThan(FLOAT_TOL);
    expect(result.bulges[2]).toBe(0);
  });

  it('throws on open polyline endpoint vertex (vertex 0 or N-1)', () => {
    const p = makePolyline(
      [
        [0, 0],
        [10, 0],
        [10, 10],
      ],
      [0, 0],
    );
    expect(() => filletPolylineCorner(p, 0, 1)).toThrow(/endpoint/);
    expect(() => filletPolylineCorner(p, 2, 1)).toThrow(/endpoint/);
  });

  it('closed polyline: vertex 0 IS a corner (wrap-around) — succeeds', () => {
    // Closed unit square at origin, vertices CCW.
    const p = makePolyline(
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ],
      [0, 0, 0, 0],
      true,
    );
    const result = filletPolylineCorner(p, 0, 0.2);
    // Vertex 0 replaced by P1 (on segment v0→v3 = north) and P2 (on segment v0→v1 = east).
    expect(result.vertices.length).toBe(5);
    expect(result.vertices[0]!.x).toBeCloseTo(0, 9);
    expect(result.vertices[0]!.y).toBeCloseTo(0.2, 9);
    expect(result.vertices[1]!.x).toBeCloseTo(0.2, 9);
    expect(result.vertices[1]!.y).toBeCloseTo(0, 9);
    // Closed → bulges length = vertices length = 5.
    expect(result.bulges.length).toBe(5);
    // First bulge is the new arc bulge.
    expect(Math.abs(result.bulges[0]!) - Math.tan(Math.PI / 8)).toBeLessThan(FLOAT_TOL);
  });

  it('throws when adjacent segment is already curved', () => {
    const p = makePolyline(
      [
        [0, 0],
        [10, 0],
        [10, 10],
      ],
      [0.5, 0],
    );
    expect(() => filletPolylineCorner(p, 1, 1)).toThrow(/already curved/);
  });

  it('throws on radius ≤ 0', () => {
    const p = makePolyline(
      [
        [0, 0],
        [10, 0],
        [10, 10],
      ],
      [0, 0],
    );
    expect(() => filletPolylineCorner(p, 1, 0)).toThrow(/radius/);
    expect(() => filletPolylineCorner(p, 1, -1)).toThrow(/radius/);
  });

  it('throws when trim distance ≥ adjacent segment length', () => {
    const p = makePolyline(
      [
        [0, 0],
        [1, 0],
        [1, 1],
      ],
      [0, 0],
    );
    expect(() => filletPolylineCorner(p, 1, 100)).toThrow(/too large|trim distance|max/);
  });
});

describe('filletLineAndPolylineEndpoint', () => {
  it('line + open polyline first-vertex segment: trims line, modifies vertex 0, emits arc', () => {
    // Line going east from (0, 0); polyline going north from (0, 0).
    // Visually meeting at the polyline's first vertex.
    const line = makeLine(-5, 0, 5, 0); // horizontal
    const poly = makePolyline(
      [
        [0, 0],
        [0, 5],
        [3, 8],
      ],
      [0, 0],
    ); // first segment north
    const result = filletLineAndPolylineEndpoint(line, { x: 4, y: 0 }, poly, 0, 2);
    // Line trimmed: kept end (5,0), trimmed end was (-5,0) → now (2, 0).
    expect(result.lineUpdated.p1.x).toBeCloseTo(2, 9);
    expect(result.lineUpdated.p1.y).toBeCloseTo(0, 9);
    expect(result.lineUpdated.p2).toEqual({ x: 5, y: 0 });
    // Polyline vertex 0 moves from (0, 0) to (0, 2) along segment 0 (toward v1).
    expect(result.polylineUpdated.vertices[0]!.x).toBeCloseTo(0, 9);
    expect(result.polylineUpdated.vertices[0]!.y).toBeCloseTo(2, 9);
    expect(result.polylineUpdated.vertices[1]).toEqual({ x: 0, y: 5 });
    expect(result.polylineUpdated.vertices[2]).toEqual({ x: 3, y: 8 });
    // Arc center at (2, 2), radius 2.
    expect(result.newArc.center.x).toBeCloseTo(2, 9);
    expect(result.newArc.center.y).toBeCloseTo(2, 9);
    expect(result.newArc.radius).toBe(2);
  });

  it('line + open polyline last-vertex segment (polylineEndpoint = -1)', () => {
    // Polyline ending at (0, 0); line from there going east.
    const poly = makePolyline(
      [
        [3, 8],
        [0, 5],
        [0, 0],
      ],
      [0, 0],
    );
    const line = makeLine(-5, 0, 5, 0);
    const result = filletLineAndPolylineEndpoint(line, { x: 4, y: 0 }, poly, -1, 2);
    // Line: trimmed (-5,0) → (2,0).
    expect(result.lineUpdated.p1.x).toBeCloseTo(2, 9);
    expect(result.lineUpdated.p1.y).toBeCloseTo(0, 9);
    // Polyline last vertex moves from (0,0) toward (0,5) by 2 → (0, 2).
    expect(result.polylineUpdated.vertices[2]!.x).toBeCloseTo(0, 9);
    expect(result.polylineUpdated.vertices[2]!.y).toBeCloseTo(2, 9);
  });

  it('throws on closed polyline', () => {
    const poly = makePolyline(
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ],
      [0, 0, 0, 0],
      true,
    );
    const line = makeLine(-5, 0, 5, 0);
    expect(() => filletLineAndPolylineEndpoint(line, { x: 4, y: 0 }, poly, 0, 1)).toThrow(
      /closed polyline|polyline must be open/,
    );
  });

  it('throws when adjacent polyline segment is already curved', () => {
    const poly = makePolyline(
      [
        [0, 0],
        [0, 5],
        [3, 8],
      ],
      [0.3, 0],
    );
    const line = makeLine(-5, 0, 5, 0);
    expect(() => filletLineAndPolylineEndpoint(line, { x: 4, y: 0 }, poly, 0, 1)).toThrow(
      /already curved/,
    );
  });

  it('throws on parallel line and polyline-segment', () => {
    const line = makeLine(0, 0, 10, 0); // east
    const poly = makePolyline(
      [
        [0, 1],
        [10, 1],
        [15, 5],
      ],
      [0, 0],
    ); // first segment east at y=1
    expect(() => filletLineAndPolylineEndpoint(line, { x: 9, y: 0 }, poly, 0, 1)).toThrow(
      /parallel/,
    );
  });
});
