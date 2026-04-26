// gripsOf tests for M1.3d Phase 5.
//
// Verifies the per-kind grip count + positions match the AutoCAD-
// comparable shapes documented in plan §8 Phase 5 step 1.

import { LayerId, type Primitive, newPrimitiveId } from '@portplanner/domain';
import { describe, expect, it } from 'vitest';

import { gripsOf } from '../src/canvas/grip-positions';

function point(): Primitive {
  return {
    id: newPrimitiveId(),
    kind: 'point',
    layerId: LayerId.DEFAULT,
    displayOverrides: {},
    position: { x: 1, y: 2 },
  };
}

function line(): Primitive {
  return {
    id: newPrimitiveId(),
    kind: 'line',
    layerId: LayerId.DEFAULT,
    displayOverrides: {},
    p1: { x: 0, y: 0 },
    p2: { x: 10, y: 0 },
  };
}

function polyline(): Primitive {
  return {
    id: newPrimitiveId(),
    kind: 'polyline',
    layerId: LayerId.DEFAULT,
    displayOverrides: {},
    vertices: [
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 5, y: 5 },
    ],
    bulges: [0, 0],
    closed: false,
  };
}

function rectangleAxisAligned(): Primitive {
  return {
    id: newPrimitiveId(),
    kind: 'rectangle',
    layerId: LayerId.DEFAULT,
    displayOverrides: {},
    origin: { x: 0, y: 0 },
    width: 4,
    height: 3,
    localAxisAngle: 0,
  };
}

function circle(): Primitive {
  return {
    id: newPrimitiveId(),
    kind: 'circle',
    layerId: LayerId.DEFAULT,
    displayOverrides: {},
    center: { x: 0, y: 0 },
    radius: 5,
  };
}

function arc(): Primitive {
  return {
    id: newPrimitiveId(),
    kind: 'arc',
    layerId: LayerId.DEFAULT,
    displayOverrides: {},
    center: { x: 0, y: 0 },
    radius: 5,
    startAngle: 0,
    endAngle: Math.PI / 2,
  };
}

function xline(): Primitive {
  return {
    id: newPrimitiveId(),
    kind: 'xline',
    layerId: LayerId.DEFAULT,
    displayOverrides: {},
    pivot: { x: 1, y: 1 },
    angle: 0, // along +X
  };
}

describe('gripsOf — per-primitive grip counts and shapes (M1.3d Phase 5)', () => {
  it('point → 1 grip at position', () => {
    const p = point();
    const grips = gripsOf(p);
    expect(grips).toHaveLength(1);
    expect(grips[0]?.gripKind).toBe('position');
    expect(grips[0]?.position).toEqual({ x: 1, y: 2 });
  });

  it('line → 2 grips (p1 and p2)', () => {
    const p = line();
    const grips = gripsOf(p);
    expect(grips).toHaveLength(2);
    expect(grips[0]?.gripKind).toBe('p1');
    expect(grips[1]?.gripKind).toBe('p2');
    expect(grips[0]?.position).toEqual({ x: 0, y: 0 });
    expect(grips[1]?.position).toEqual({ x: 10, y: 0 });
  });

  it('polyline → N grips, one per vertex', () => {
    const p = polyline();
    const grips = gripsOf(p);
    expect(grips).toHaveLength(3);
    expect(grips.map((g) => g.gripKind)).toEqual(['vertex-0', 'vertex-1', 'vertex-2']);
  });

  it('rectangle → 4 corners (axis-aligned)', () => {
    const p = rectangleAxisAligned();
    const grips = gripsOf(p);
    expect(grips).toHaveLength(4);
    expect(grips.map((g) => g.gripKind)).toEqual([
      'corner-sw',
      'corner-se',
      'corner-ne',
      'corner-nw',
    ]);
    expect(grips[0]?.position).toEqual({ x: 0, y: 0 });
    expect(grips[1]?.position).toEqual({ x: 4, y: 0 });
    expect(grips[2]?.position).toEqual({ x: 4, y: 3 });
    expect(grips[3]?.position).toEqual({ x: 0, y: 3 });
  });

  it('circle → 5 grips (center + N/E/S/W on circumference)', () => {
    const p = circle();
    const grips = gripsOf(p);
    expect(grips).toHaveLength(5);
    expect(grips.map((g) => g.gripKind)).toEqual(['center', 'east', 'north', 'west', 'south']);
    expect(grips[0]?.position).toEqual({ x: 0, y: 0 });
    expect(grips[1]?.position).toEqual({ x: 5, y: 0 });
    expect(grips[2]?.position).toEqual({ x: 0, y: 5 });
    expect(grips[3]?.position).toEqual({ x: -5, y: 0 });
    expect(grips[4]?.position).toEqual({ x: 0, y: -5 });
  });

  it('arc → 3 grips (start, mid, end)', () => {
    const p = arc();
    const grips = gripsOf(p);
    expect(grips).toHaveLength(3);
    expect(grips.map((g) => g.gripKind)).toEqual(['start', 'mid', 'end']);
    expect(grips[0]?.position.x).toBeCloseTo(5, 9);
    expect(grips[0]?.position.y).toBeCloseTo(0, 9);
    // mid at angle π/4 = (5/√2, 5/√2)
    expect(grips[1]?.position.x).toBeCloseTo(5 / Math.SQRT2, 6);
    expect(grips[1]?.position.y).toBeCloseTo(5 / Math.SQRT2, 6);
  });

  it('xline → 2 grips (pivot + direction indicator at pivot+10m along angle)', () => {
    const p = xline();
    const grips = gripsOf(p);
    expect(grips).toHaveLength(2);
    expect(grips[0]?.gripKind).toBe('pivot');
    expect(grips[0]?.position).toEqual({ x: 1, y: 1 });
    expect(grips[1]?.gripKind).toBe('direction');
    // xline angle 0 → +X, distance 10m → (1+10, 1) = (11, 1).
    expect(grips[1]?.position.x).toBeCloseTo(11, 9);
    expect(grips[1]?.position.y).toBeCloseTo(1, 9);
  });

  it('every grip carries the parent entityId', () => {
    const p = polyline();
    const grips = gripsOf(p);
    for (const g of grips) {
      expect(g.entityId).toBe(p.id);
    }
  });
});
