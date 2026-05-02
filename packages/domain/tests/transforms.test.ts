// M1.3b simple-transforms Phase 1 — domain transform helpers tests.
// Per I-MOD-1, transforms are pure (no editor-2d / store / react /
// design-system). Per I-MOD-7, scale rejects factor === 0 and allows
// factor < 0 (AC flip semantics).

import { describe, expect, it } from 'vitest';
import {
  type ArcPrimitive,
  type CirclePrimitive,
  type LinePrimitive,
  type PointPrimitive,
  type PolylinePrimitive,
  type Primitive,
  type RectanglePrimitive,
  type XlinePrimitive,
  mirrorPrimitive,
  offsetPrimitive,
  rotatePrimitive,
  scalePrimitive,
} from '../src';
import { LayerId, newPrimitiveId } from '../src/ids';

const ZERO = { x: 0, y: 0 };

function pt(): PointPrimitive {
  return {
    kind: 'point',
    id: newPrimitiveId(),
    layerId: LayerId.DEFAULT,
    displayOverrides: {},
    position: { x: 5, y: 0 },
  };
}
function ln(p1 = { x: 0, y: 0 }, p2 = { x: 10, y: 0 }): LinePrimitive {
  return {
    kind: 'line',
    id: newPrimitiveId(),
    layerId: LayerId.DEFAULT,
    displayOverrides: {},
    p1,
    p2,
  };
}
function poly(): PolylinePrimitive {
  return {
    kind: 'polyline',
    id: newPrimitiveId(),
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
function rect(): RectanglePrimitive {
  return {
    kind: 'rectangle',
    id: newPrimitiveId(),
    layerId: LayerId.DEFAULT,
    displayOverrides: {},
    origin: { x: 0, y: 0 },
    width: 10,
    height: 5,
    localAxisAngle: 0,
  };
}
function circ(): CirclePrimitive {
  return {
    kind: 'circle',
    id: newPrimitiveId(),
    layerId: LayerId.DEFAULT,
    displayOverrides: {},
    center: { x: 0, y: 0 },
    radius: 5,
  };
}
function arc(): ArcPrimitive {
  return {
    kind: 'arc',
    id: newPrimitiveId(),
    layerId: LayerId.DEFAULT,
    displayOverrides: {},
    center: { x: 0, y: 0 },
    radius: 5,
    startAngle: 0,
    endAngle: Math.PI / 2,
  };
}
function xl(): XlinePrimitive {
  return {
    kind: 'xline',
    id: newPrimitiveId(),
    layerId: LayerId.DEFAULT,
    displayOverrides: {},
    pivot: { x: 0, y: 0 },
    angle: 0,
  };
}

describe('rotatePrimitive', () => {
  it('rotates a line by π/2 about origin → swaps x/y with sign flip', () => {
    const r = rotatePrimitive(ln(), ZERO, Math.PI / 2) as LinePrimitive;
    expect(r.p1.x).toBeCloseTo(0, 6);
    expect(r.p1.y).toBeCloseTo(0, 6);
    expect(r.p2.x).toBeCloseTo(0, 6);
    expect(r.p2.y).toBeCloseTo(10, 6);
  });
  it('rotates a point about a non-origin base', () => {
    const r = rotatePrimitive(pt(), { x: 5, y: 0 }, Math.PI) as PointPrimitive;
    // Point at (5,0) rotated π about (5,0) → unchanged.
    expect(r.position.x).toBeCloseTo(5, 6);
    expect(r.position.y).toBeCloseTo(0, 6);
  });
  it('rotates polyline vertices; bulges preserved', () => {
    const p = poly();
    p.bulges = [0.5, -0.3];
    const r = rotatePrimitive(p, ZERO, Math.PI / 2) as PolylinePrimitive;
    expect(r.vertices[0]?.x).toBeCloseTo(0, 6);
    expect(r.vertices[1]?.x).toBeCloseTo(0, 6);
    expect(r.vertices[1]?.y).toBeCloseTo(5, 6);
    expect(r.bulges).toEqual([0.5, -0.3]);
  });
  it('rectangle: localAxisAngle increments by angleRad', () => {
    const r = rotatePrimitive(rect(), ZERO, Math.PI / 4) as RectanglePrimitive;
    expect(r.localAxisAngle).toBeCloseTo(Math.PI / 4, 6);
  });
  it('rectangle: SW corner (origin) rotates about base — geometry survives', () => {
    // rect at SW=(2,3), w=10, h=5, axis=0; rotate 90° about origin.
    const r0 = rect();
    r0.origin = { x: 2, y: 3 };
    const r = rotatePrimitive(r0, ZERO, Math.PI / 2) as RectanglePrimitive;
    // Original SW (2,3) rotated 90° CCW about (0,0) → (-3, 2).
    expect(r.origin.x).toBeCloseTo(-3, 6);
    expect(r.origin.y).toBeCloseTo(2, 6);
    expect(r.width).toBeCloseTo(10, 6);
    expect(r.height).toBeCloseTo(5, 6);
    expect(r.localAxisAngle).toBeCloseTo(Math.PI / 2, 6);
  });
  it('arc: startAngle + endAngle increment by angleRad', () => {
    const r = rotatePrimitive(arc(), ZERO, Math.PI / 2) as ArcPrimitive;
    expect(r.startAngle).toBeCloseTo(Math.PI / 2, 6);
    expect(r.endAngle).toBeCloseTo(Math.PI, 6);
  });
  it('xline: pivot rotated + angle incremented', () => {
    const x = xl();
    x.pivot = { x: 5, y: 0 };
    const r = rotatePrimitive(x, ZERO, Math.PI / 2) as XlinePrimitive;
    expect(r.pivot.x).toBeCloseTo(0, 6);
    expect(r.pivot.y).toBeCloseTo(5, 6);
    expect(r.angle).toBeCloseTo(Math.PI / 2, 6);
  });
});

describe('scalePrimitive', () => {
  it('throws on factor === 0 (per I-MOD-7)', () => {
    expect(() => scalePrimitive(ln(), ZERO, 0)).toThrow(/factor === 0/);
  });
  it('flips on negative factor (line: p1↔p2 about base when factor=-1)', () => {
    // Line from (0,0) to (10,0) scaled by -1 about (5,0) → flips to
    // (10,0) to (0,0) — i.e., scales by -1 about midpoint.
    const r = scalePrimitive(
      ln({ x: 0, y: 0 }, { x: 10, y: 0 }),
      { x: 5, y: 0 },
      -1,
    ) as LinePrimitive;
    expect(r.p1.x).toBeCloseTo(10, 6);
    expect(r.p2.x).toBeCloseTo(0, 6);
  });
  it('scales line by factor 2 about origin', () => {
    const r = scalePrimitive(ln(), ZERO, 2) as LinePrimitive;
    expect(r.p1.x).toBeCloseTo(0, 6);
    expect(r.p2.x).toBeCloseTo(20, 6);
  });
  it('scales circle radius by |factor|', () => {
    const r = scalePrimitive(circ(), ZERO, 3) as CirclePrimitive;
    expect(r.radius).toBeCloseTo(15, 6);
    const r2 = scalePrimitive(circ(), ZERO, -3) as CirclePrimitive;
    expect(r2.radius).toBeCloseTo(15, 6); // |factor| applied to radius
  });
  it('scales rectangle width/height by |factor|', () => {
    const r = scalePrimitive(rect(), ZERO, 2) as RectanglePrimitive;
    expect(r.width).toBeCloseTo(20, 6);
    expect(r.height).toBeCloseTo(10, 6);
  });
  it('rectangle: positive factor — SW corner scales, axis unchanged', () => {
    const r0 = rect();
    r0.origin = { x: 2, y: 3 };
    const r = scalePrimitive(r0, ZERO, 2) as RectanglePrimitive;
    expect(r.origin.x).toBeCloseTo(4, 6);
    expect(r.origin.y).toBeCloseTo(6, 6);
    expect(r.localAxisAngle).toBeCloseTo(0, 6);
  });
  it('rectangle: negative factor — NE becomes new SW (flip through base)', () => {
    // rect SW=(5,5), w=10, h=5; NE_world = (15,10). Scale by -2 about (0,0):
    //   NE scaled = (-30, -20) ← becomes new SW of the flipped rectangle.
    const r0 = rect();
    r0.origin = { x: 5, y: 5 };
    const r = scalePrimitive(r0, ZERO, -2) as RectanglePrimitive;
    expect(r.origin.x).toBeCloseTo(-30, 6);
    expect(r.origin.y).toBeCloseTo(-20, 6);
    expect(r.width).toBeCloseTo(20, 6);
    expect(r.height).toBeCloseTo(10, 6);
    expect(r.localAxisAngle).toBeCloseTo(0, 6);
  });
  it('xline pivot scales but angle unchanged (direction-invariant)', () => {
    const x = xl();
    x.pivot = { x: 5, y: 0 };
    x.angle = Math.PI / 4;
    const r = scalePrimitive(x, ZERO, 2) as XlinePrimitive;
    expect(r.pivot.x).toBeCloseTo(10, 6);
    expect(r.angle).toBeCloseTo(Math.PI / 4, 6);
  });
});

describe('mirrorPrimitive', () => {
  const xAxisLine = { p1: { x: 0, y: 0 }, p2: { x: 1, y: 0 } };
  it('mirrors a point above x-axis to below x-axis', () => {
    const p = pt();
    p.position = { x: 3, y: 5 };
    const r = mirrorPrimitive(p, xAxisLine) as PointPrimitive;
    expect(r.position.x).toBeCloseTo(3, 6);
    expect(r.position.y).toBeCloseTo(-5, 6);
  });
  it('mirrors a line across x-axis', () => {
    const r = mirrorPrimitive(ln({ x: 0, y: 5 }, { x: 10, y: 5 }), xAxisLine) as LinePrimitive;
    expect(r.p1.y).toBeCloseTo(-5, 6);
    expect(r.p2.y).toBeCloseTo(-5, 6);
  });
  it('polyline bulges negate (CCW ↔ CW flip)', () => {
    const p = poly();
    p.bulges = [0.5, -0.3];
    const r = mirrorPrimitive(p, xAxisLine) as PolylinePrimitive;
    expect(r.bulges).toEqual([-0.5, 0.3]);
  });
  it('xline angle reflects via 2*lineAngle - angle', () => {
    const x = xl();
    x.angle = Math.PI / 4; // 45°
    // Mirror line is x-axis (angle 0); reflected angle = -π/4.
    const r = mirrorPrimitive(x, xAxisLine) as XlinePrimitive;
    expect(r.angle).toBeCloseTo(-Math.PI / 4, 6);
  });
  it('circle center reflects; radius unchanged', () => {
    const c = circ();
    c.center = { x: 2, y: 3 };
    const r = mirrorPrimitive(c, xAxisLine) as CirclePrimitive;
    expect(r.center.y).toBeCloseTo(-3, 6);
    expect(r.radius).toBeCloseTo(5, 6);
  });
  it('rectangle: original NW becomes new SW after reflection (orientation flip)', () => {
    // Axis-aligned rect: SW=(2,3), w=10, h=5 → NW_world=(2, 8).
    // Reflect across x-axis: NW_world → (2, -8). That becomes new SW.
    // New axis = 2*lineAngle - α = 2*0 - 0 = 0.
    const r0 = rect();
    r0.origin = { x: 2, y: 3 };
    const r = mirrorPrimitive(r0, xAxisLine) as RectanglePrimitive;
    expect(r.origin.x).toBeCloseTo(2, 6);
    expect(r.origin.y).toBeCloseTo(-8, 6);
    expect(r.width).toBeCloseTo(10, 6);
    expect(r.height).toBeCloseTo(5, 6);
    expect(r.localAxisAngle).toBeCloseTo(0, 6);
  });
  it('zero-length mirror line is a no-op (degenerate)', () => {
    const p = pt();
    p.position = { x: 3, y: 5 };
    const r = mirrorPrimitive(p, { p1: ZERO, p2: ZERO }) as PointPrimitive;
    expect(r.position).toEqual({ x: 3, y: 5 });
  });
});

describe('offsetPrimitive', () => {
  it('throws on point primitive (no offset semantic)', () => {
    expect(() => offsetPrimitive(pt(), 1, 1)).toThrow(/point/);
  });
  it('throws on distance <= 0', () => {
    expect(() => offsetPrimitive(ln(), 0, 1)).toThrow(/distance/);
    expect(() => offsetPrimitive(ln(), -1, 1)).toThrow(/distance/);
  });
  it('offsets a horizontal line perpendicular to its direction', () => {
    // Line from (0,0) to (10,0); offset distance 2, side +1 → CCW perp
    // = (0, 1) → shift up by 2.
    const r = offsetPrimitive(ln(), 2, 1) as LinePrimitive;
    expect(r.p1.y).toBeCloseTo(2, 6);
    expect(r.p2.y).toBeCloseTo(2, 6);
    // side -1 → shift down.
    const r2 = offsetPrimitive(ln(), 2, -1) as LinePrimitive;
    expect(r2.p1.y).toBeCloseTo(-2, 6);
  });
  it('circle: radius grows by distance × side; throws if would shrink ≤ 0', () => {
    const r = offsetPrimitive(circ(), 2, 1) as CirclePrimitive;
    expect(r.radius).toBeCloseTo(7, 6);
    const r2 = offsetPrimitive(circ(), 2, -1) as CirclePrimitive;
    expect(r2.radius).toBeCloseTo(3, 6);
    expect(() => offsetPrimitive(circ(), 5, -1)).toThrow(/radius/);
  });
  it('rectangle: dimensions ± 2*distance, centered', () => {
    const r = offsetPrimitive(rect(), 1, 1) as RectanglePrimitive;
    expect(r.width).toBeCloseTo(12, 6);
    expect(r.height).toBeCloseTo(7, 6);
    expect(r.origin.x).toBeCloseTo(-1, 6);
    expect(r.origin.y).toBeCloseTo(-1, 6);
  });
  it('throws on bulged polyline (V1 deferred)', () => {
    const p = poly();
    p.bulges = [0.5, 0];
    expect(() => offsetPrimitive(p, 1, 1)).toThrow(/bulged/);
  });
  it('xline pivot shifts perpendicular to direction; angle unchanged', () => {
    // Horizontal xline (angle=0); CCW perp = (0,1); shift up by 2.
    const r = offsetPrimitive(xl(), 2, 1) as XlinePrimitive;
    expect(r.pivot.y).toBeCloseTo(2, 6);
    expect(r.angle).toBeCloseTo(0, 6);
  });
});

// I-MOD-1 enforcement: confirm transforms produce a Primitive (no
// store / React types leak). TypeScript catches this at compile time;
// this test is a runtime safety net asserting the helpers return objects
// whose `kind` field matches the Primitive discriminated union.
describe('I-MOD-1 transforms are pure (return Primitive shape)', () => {
  it('rotatePrimitive returns a Primitive with same kind', () => {
    const result: Primitive = rotatePrimitive(ln(), ZERO, 0);
    expect(result.kind).toBe('line');
  });
  it('scalePrimitive returns a Primitive with same kind', () => {
    const result: Primitive = scalePrimitive(ln(), ZERO, 1);
    expect(result.kind).toBe('line');
  });
  it('mirrorPrimitive returns a Primitive with same kind', () => {
    const result: Primitive = mirrorPrimitive(ln(), { p1: ZERO, p2: { x: 1, y: 0 } });
    expect(result.kind).toBe('line');
  });
  it('offsetPrimitive returns a Primitive with same kind', () => {
    const result: Primitive = offsetPrimitive(ln(), 1, 1);
    expect(result.kind).toBe('line');
  });
});
