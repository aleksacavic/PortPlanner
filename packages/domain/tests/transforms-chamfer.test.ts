// M1.3b fillet-chamfer Phase 1 — domain tests for chamfer helpers.
// Mirrors the fillet test structure with two-distance method (d1, d2)
// instead of radius. New segment is a straight LinePrimitive (or
// straight polyline edge with bulge=0) instead of an arc.

import { describe, expect, it } from 'vitest';

import {
  chamferLineAndPolylineEndpoint,
  chamferPolylineCorner,
  chamferTwoLines,
} from '../src/transforms';
import type { LinePrimitive, PolylinePrimitive } from '../src/types/primitive';

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

describe('chamferTwoLines', () => {
  it('90° corner with d1=3, d2=2: trims each line by its distance + emits straight segment', () => {
    const l1 = makeLine(-5, 0, 5, 0); // horizontal
    const l2 = makeLine(0, -5, 0, 5); // vertical
    const result = chamferTwoLines(l1, l2, 3, 2, {
      p1Hint: { x: 4, y: 0 },
      p2Hint: { x: 0, y: 4 },
    });
    // L1 trimmed by 3 toward kept (5,0): trimmed end at (3, 0).
    expect(result.l1Updated.p1.x).toBeCloseTo(3, 9);
    expect(result.l1Updated.p1.y).toBeCloseTo(0, 9);
    expect(result.l1Updated.p2).toEqual({ x: 5, y: 0 });
    // L2 trimmed by 2 toward kept (0,5): trimmed end at (0, 2).
    expect(result.l2Updated.p1.x).toBeCloseTo(0, 9);
    expect(result.l2Updated.p1.y).toBeCloseTo(2, 9);
    expect(result.l2Updated.p2).toEqual({ x: 0, y: 5 });
    // Chamfer segment connects (3, 0) and (0, 2).
    expect(result.newSegment.kind).toBe('line');
    expect(result.newSegment.p1.x).toBeCloseTo(3, 9);
    expect(result.newSegment.p1.y).toBeCloseTo(0, 9);
    expect(result.newSegment.p2.x).toBeCloseTo(0, 9);
    expect(result.newSegment.p2.y).toBeCloseTo(2, 9);
  });

  it('symmetric distances d1=d2 produce a 45° chamfer at a 90° corner', () => {
    const l1 = makeLine(-5, 0, 5, 0);
    const l2 = makeLine(0, -5, 0, 5);
    const result = chamferTwoLines(l1, l2, 1, 1, {
      p1Hint: { x: 4, y: 0 },
      p2Hint: { x: 0, y: 4 },
    });
    // Chamfer segment from (1, 0) to (0, 1) — slope -1 (45°).
    expect(result.newSegment.p1.x).toBeCloseTo(1, 9);
    expect(result.newSegment.p1.y).toBeCloseTo(0, 9);
    expect(result.newSegment.p2.x).toBeCloseTo(0, 9);
    expect(result.newSegment.p2.y).toBeCloseTo(1, 9);
  });

  it('throws on parallel lines', () => {
    const l1 = makeLine(0, 0, 10, 0);
    const l2 = makeLine(0, 1, 10, 1);
    expect(() =>
      chamferTwoLines(l1, l2, 1, 1, { p1Hint: { x: 5, y: 0 }, p2Hint: { x: 5, y: 1 } }),
    ).toThrow(/parallel/);
  });

  it('throws when either trim distance ≥ source segment length', () => {
    const l1 = makeLine(0, 0, 1, 0);
    const l2 = makeLine(0, 0, 0, 1);
    expect(() =>
      chamferTwoLines(l1, l2, 100, 0.5, {
        p1Hint: { x: 1, y: 0 },
        p2Hint: { x: 0, y: 1 },
      }),
    ).toThrow(/trim distance/);
  });

  it('throws on d1 ≤ 0 or d2 ≤ 0', () => {
    const l1 = makeLine(-5, 0, 5, 0);
    const l2 = makeLine(0, -5, 0, 5);
    expect(() =>
      chamferTwoLines(l1, l2, 0, 1, { p1Hint: { x: 4, y: 0 }, p2Hint: { x: 0, y: 4 } }),
    ).toThrow(/distances/);
    expect(() =>
      chamferTwoLines(l1, l2, 1, -1, { p1Hint: { x: 4, y: 0 }, p2Hint: { x: 0, y: 4 } }),
    ).toThrow(/distances/);
  });
});

describe('chamferPolylineCorner', () => {
  it('open polyline 90° interior vertex: replaces K with [P1, P2] + straight bulge=0', () => {
    const p = makePolyline(
      [
        [0, 0],
        [10, 0],
        [10, 10],
      ],
      [0, 0],
    );
    const result = chamferPolylineCorner(p, 1, 3, 2);
    // Vertex 1 replaced by P1=(7, 0) and P2=(10, 2).
    expect(result.vertices.length).toBe(4);
    expect(result.vertices[1]!.x).toBeCloseTo(7, 9);
    expect(result.vertices[1]!.y).toBeCloseTo(0, 9);
    expect(result.vertices[2]!.x).toBeCloseTo(10, 9);
    expect(result.vertices[2]!.y).toBeCloseTo(2, 9);
    // Bulges: 0 inserted at index 1 (the new straight chamfer segment).
    expect(result.bulges).toEqual([0, 0, 0]);
  });

  it('throws on open polyline endpoint vertex', () => {
    const p = makePolyline(
      [
        [0, 0],
        [10, 0],
        [10, 10],
      ],
      [0, 0],
    );
    expect(() => chamferPolylineCorner(p, 0, 1, 1)).toThrow(/endpoint/);
    expect(() => chamferPolylineCorner(p, 2, 1, 1)).toThrow(/endpoint/);
  });

  it('closed polyline vertex 0 succeeds (wrap-around corner)', () => {
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
    const result = chamferPolylineCorner(p, 0, 0.2, 0.3);
    expect(result.vertices.length).toBe(5);
    // P1 on segment v0→v3 at distance 0.2: (0, 0.2)
    expect(result.vertices[0]!.x).toBeCloseTo(0, 9);
    expect(result.vertices[0]!.y).toBeCloseTo(0.2, 9);
    // P2 on segment v0→v1 at distance 0.3: (0.3, 0)
    expect(result.vertices[1]!.x).toBeCloseTo(0.3, 9);
    expect(result.vertices[1]!.y).toBeCloseTo(0, 9);
    // bulges length = vertices length for closed polyline.
    expect(result.bulges.length).toBe(5);
    // First bulge = 0 (straight chamfer).
    expect(result.bulges[0]).toBe(0);
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
    expect(() => chamferPolylineCorner(p, 1, 1, 1)).toThrow(/already curved/);
  });

  it('throws on d1 ≤ 0 or d2 ≤ 0', () => {
    const p = makePolyline(
      [
        [0, 0],
        [10, 0],
        [10, 10],
      ],
      [0, 0],
    );
    expect(() => chamferPolylineCorner(p, 1, 0, 1)).toThrow(/distances/);
    expect(() => chamferPolylineCorner(p, 1, 1, -1)).toThrow(/distances/);
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
    expect(() => chamferPolylineCorner(p, 1, 100, 0.5)).toThrow(/trim distance/);
  });
});

describe('chamferLineAndPolylineEndpoint', () => {
  it('line + open polyline first-vertex: trims line by d1, polyline endpoint by d2, emits LinePrimitive segment', () => {
    const line = makeLine(-5, 0, 5, 0);
    const poly = makePolyline(
      [
        [0, 0],
        [0, 5],
        [3, 8],
      ],
      [0, 0],
    );
    const result = chamferLineAndPolylineEndpoint(line, { x: 4, y: 0 }, poly, 0, 3, 2);
    expect(result.lineUpdated.p1.x).toBeCloseTo(3, 9);
    expect(result.lineUpdated.p1.y).toBeCloseTo(0, 9);
    expect(result.lineUpdated.p2).toEqual({ x: 5, y: 0 });
    expect(result.polylineUpdated.vertices[0]!.x).toBeCloseTo(0, 9);
    expect(result.polylineUpdated.vertices[0]!.y).toBeCloseTo(2, 9);
    expect(result.newSegment.kind).toBe('line');
    expect(result.newSegment.p1.x).toBeCloseTo(3, 9);
    expect(result.newSegment.p1.y).toBeCloseTo(0, 9);
    expect(result.newSegment.p2.x).toBeCloseTo(0, 9);
    expect(result.newSegment.p2.y).toBeCloseTo(2, 9);
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
    expect(() => chamferLineAndPolylineEndpoint(line, { x: 4, y: 0 }, poly, 0, 1, 1)).toThrow(
      /closed polyline|polyline must be open/,
    );
  });

  it('throws on parallel line and polyline-segment', () => {
    const line = makeLine(0, 0, 10, 0);
    const poly = makePolyline(
      [
        [0, 1],
        [10, 1],
        [15, 5],
      ],
      [0, 0],
    );
    expect(() => chamferLineAndPolylineEndpoint(line, { x: 9, y: 0 }, poly, 0, 1, 1)).toThrow(
      /parallel/,
    );
  });
});
