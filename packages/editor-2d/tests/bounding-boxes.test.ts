import { LayerId, type Primitive, newPrimitiveId } from '@portplanner/domain';
import { describe, expect, it } from 'vitest';

import { bboxOfPrimitive } from '../src/canvas/bounding-boxes';

const base = { id: newPrimitiveId(), layerId: LayerId.DEFAULT, displayOverrides: {} };

describe('bboxOfPrimitive', () => {
  it('point bbox is degenerate (min===max)', () => {
    const p: Primitive = { ...base, kind: 'point', position: { x: 3, y: 5 } };
    expect(bboxOfPrimitive(p)).toEqual({ minX: 3, minY: 5, maxX: 3, maxY: 5 });
  });

  it('line bbox envelopes both endpoints', () => {
    const p: Primitive = { ...base, kind: 'line', p1: { x: -2, y: 4 }, p2: { x: 6, y: -1 } };
    expect(bboxOfPrimitive(p)).toEqual({ minX: -2, minY: -1, maxX: 6, maxY: 4 });
  });

  it('rectangle bbox accounts for localAxisAngle rotation', () => {
    const p: Primitive = {
      ...base,
      kind: 'rectangle',
      origin: { x: 0, y: 0 },
      width: 10,
      height: 10,
      localAxisAngle: Math.PI / 4,
    };
    const bb = bboxOfPrimitive(p)!;
    // Rotated 10×10 square at origin: spans roughly (-7.07, 0) to (7.07, 14.14).
    expect(bb.minX).toBeCloseTo(-7.0710678, 5);
    expect(bb.maxX).toBeCloseTo(7.0710678, 5);
  });

  it('circle bbox is centre±radius', () => {
    const p: Primitive = { ...base, kind: 'circle', center: { x: 2, y: 3 }, radius: 4 };
    expect(bboxOfPrimitive(p)).toEqual({ minX: -2, minY: -1, maxX: 6, maxY: 7 });
  });

  it('arc bbox includes the cardinal extremum (top of unit circle, 0..π)', () => {
    const p: Primitive = {
      ...base,
      kind: 'arc',
      center: { x: 0, y: 0 },
      radius: 1,
      startAngle: 0,
      endAngle: Math.PI,
    };
    const bb = bboxOfPrimitive(p)!;
    expect(bb.minX).toBeCloseTo(-1, 9);
    expect(bb.maxX).toBeCloseTo(1, 9);
    expect(bb.minY).toBeCloseTo(0, 9);
    expect(bb.maxY).toBeCloseTo(1, 9); // top of unit circle
  });

  it('arc bbox quadrant-spanning (sweep crosses 3π/2)', () => {
    const p: Primitive = {
      ...base,
      kind: 'arc',
      center: { x: 0, y: 0 },
      radius: 1,
      startAngle: Math.PI,
      endAngle: 2 * Math.PI,
    };
    const bb = bboxOfPrimitive(p)!;
    expect(bb.minY).toBeCloseTo(-1, 9); // bottom of unit circle is included
    expect(bb.maxY).toBeCloseTo(0, 9);
  });

  it('xline returns null bbox (infinite)', () => {
    const p: Primitive = { ...base, kind: 'xline', pivot: { x: 0, y: 0 }, angle: 0 };
    expect(bboxOfPrimitive(p)).toBeNull();
  });

  it('open polyline with bulges=0 envelope = vertex envelope', () => {
    const p: Primitive = {
      ...base,
      kind: 'polyline',
      vertices: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 5 },
      ],
      bulges: [0, 0],
      closed: false,
    };
    const bb = bboxOfPrimitive(p)!;
    expect(bb).toEqual({ minX: 0, minY: 0, maxX: 10, maxY: 5 });
  });

  it('polyline with non-zero bulge widens bbox to include arc extent', () => {
    const p: Primitive = {
      ...base,
      kind: 'polyline',
      vertices: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ],
      bulges: [1], // semicircle (θ = π); positive bulge = CCW = lower arc
      closed: false,
    };
    const bb = bboxOfPrimitive(p)!;
    // Lower semicircle reaches y ≈ -5 (radius) at the bottom of the arc.
    expect(bb.minY).toBeLessThan(-4);
    expect(bb.maxY).toBeCloseTo(0, 6);
  });
});
