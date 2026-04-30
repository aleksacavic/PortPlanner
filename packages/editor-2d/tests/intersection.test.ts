// Phase 2 intersection-algorithm tests per the snap-engine-extension
// plan §4.0.1 supported pair matrix + Phase 2 mandatory completion
// gates. Every cell marked `R` in the matrix has a fixture here;
// every cell marked `D` (xline-anything, point-anything) has an
// explicit empty-return assertion.

import {
  type Arc,
  type CirclePrimitive,
  LayerId,
  type LinePrimitive,
  type PointPrimitive,
  type Polyline,
  type Rectangle,
  type Xline,
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

function makeArc(
  center: { x: number; y: number },
  radius: number,
  startAngle: number,
  endAngle: number,
): Arc {
  return {
    id: newPrimitiveId(),
    kind: 'arc',
    layerId: LAYER,
    displayOverrides: NO_OVERRIDES,
    center,
    radius,
    startAngle,
    endAngle,
  };
}

function makeXline(pivot: { x: number; y: number }, angle: number): Xline {
  return {
    id: newPrimitiveId(),
    kind: 'xline',
    layerId: LAYER,
    displayOverrides: NO_OVERRIDES,
    pivot,
    angle,
  };
}

function makePoint(position: { x: number; y: number }): PointPrimitive {
  return {
    id: newPrimitiveId(),
    kind: 'point',
    layerId: LAYER,
    displayOverrides: NO_OVERRIDES,
    position,
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

function makeRect(origin: { x: number; y: number }, width: number, height: number): Rectangle {
  return {
    id: newPrimitiveId(),
    kind: 'rectangle',
    layerId: LAYER,
    displayOverrides: NO_OVERRIDES,
    origin,
    width,
    height,
    localAxisAngle: 0,
  };
}

describe('line-circle intersection (lineCircle algorithm)', () => {
  it('0-root: line misses the circle entirely', () => {
    const line = makeLine({ x: 0, y: 5 }, { x: 10, y: 5 });
    const circle = makeCircle({ x: 0, y: 0 }, 3);
    expect(intersect(line, circle)).toEqual([]);
  });

  it('1-root: line tangent to circle (single touch point)', () => {
    const line = makeLine({ x: -5, y: 3 }, { x: 5, y: 3 });
    const circle = makeCircle({ x: 0, y: 0 }, 3);
    const result = intersect(line, circle);
    expect(result).toHaveLength(1);
    expect(result[0]?.x).toBeCloseTo(0, 9);
    expect(result[0]?.y).toBeCloseTo(3, 9);
  });

  it('2-root: line is a chord of the circle', () => {
    const line = makeLine({ x: -5, y: 0 }, { x: 5, y: 0 });
    const circle = makeCircle({ x: 0, y: 0 }, 3);
    const result = intersect(line, circle);
    expect(result).toHaveLength(2);
    const sorted = [...result].sort((a, b) => a.x - b.x);
    expect(sorted[0]?.x).toBeCloseTo(-3, 9);
    expect(sorted[1]?.x).toBeCloseTo(3, 9);
  });

  it('symmetric: intersect(circle, line) === intersect(line, circle)', () => {
    const line = makeLine({ x: -5, y: 0 }, { x: 5, y: 0 });
    const circle = makeCircle({ x: 0, y: 0 }, 3);
    expect(intersect(circle, line)).toEqual(intersect(line, circle));
  });

  it('segment clamp: line ends inside circle returns only the entry point', () => {
    const line = makeLine({ x: -5, y: 0 }, { x: 0, y: 0 });
    const circle = makeCircle({ x: 0, y: 0 }, 3);
    const result = intersect(line, circle);
    expect(result).toHaveLength(1);
    expect(result[0]?.x).toBeCloseTo(-3, 9);
  });
});

describe('circle-circle intersection (circleCircle algorithm)', () => {
  it('disjoint: centres far apart', () => {
    const a = makeCircle({ x: 0, y: 0 }, 1);
    const b = makeCircle({ x: 10, y: 0 }, 1);
    expect(intersect(a, b)).toEqual([]);
  });

  it('one inside other: smaller circle entirely within larger', () => {
    const a = makeCircle({ x: 0, y: 0 }, 5);
    const b = makeCircle({ x: 1, y: 0 }, 1);
    expect(intersect(a, b)).toEqual([]);
  });

  it('externally tangent: 1 touch point', () => {
    const a = makeCircle({ x: 0, y: 0 }, 3);
    const b = makeCircle({ x: 5, y: 0 }, 2);
    const result = intersect(a, b);
    expect(result).toHaveLength(1);
    expect(result[0]?.x).toBeCloseTo(3, 9);
    expect(result[0]?.y).toBeCloseTo(0, 9);
  });

  it('internally tangent: smaller circle touches larger from inside', () => {
    const a = makeCircle({ x: 0, y: 0 }, 5);
    const b = makeCircle({ x: 3, y: 0 }, 2);
    const result = intersect(a, b);
    expect(result).toHaveLength(1);
    expect(result[0]?.x).toBeCloseTo(5, 9);
    expect(result[0]?.y).toBeCloseTo(0, 9);
  });

  it('2-point overlap', () => {
    const a = makeCircle({ x: 0, y: 0 }, 5);
    const b = makeCircle({ x: 6, y: 0 }, 5);
    const result = intersect(a, b);
    expect(result).toHaveLength(2);
    const sorted = [...result].sort((p, q) => p.y - q.y);
    expect(sorted[0]?.x).toBeCloseTo(3, 9);
    expect(sorted[0]?.y).toBeCloseTo(-4, 9);
    expect(sorted[1]?.x).toBeCloseTo(3, 9);
    expect(sorted[1]?.y).toBeCloseTo(4, 9);
  });
});

describe('lineArc sweep filter', () => {
  it('line crosses underlying circle inside the arc sweep: returns the in-sweep points', () => {
    const arc = makeArc({ x: 0, y: 0 }, 3, 0, Math.PI);
    const line = makeLine({ x: -5, y: 2 }, { x: 5, y: 2 });
    const result = intersect(line, arc);
    expect(result).toHaveLength(2);
  });

  it('line crosses circle but OUTSIDE the arc sweep: returns []', () => {
    const arc = makeArc({ x: 0, y: 0 }, 3, 0, Math.PI);
    const line = makeLine({ x: -5, y: -2 }, { x: 5, y: -2 });
    expect(intersect(line, arc)).toEqual([]);
  });

  it('line crosses circle with one point inside sweep, one outside: returns 1', () => {
    const arc = makeArc({ x: 0, y: 0 }, 3, -Math.PI / 2, Math.PI / 2);
    const line = makeLine({ x: -5, y: 0 }, { x: 5, y: 0 });
    const result = intersect(line, arc);
    expect(result).toHaveLength(1);
    expect(result[0]?.x).toBeCloseTo(3, 9);
  });
});

describe('circle-arc intersection', () => {
  it('inside arc sweep', () => {
    const a = makeCircle({ x: 0, y: 0 }, 5);
    const arc = makeArc({ x: 6, y: 0 }, 5, Math.PI / 2, Math.PI * 1.5);
    const result = intersect(a, arc);
    expect(result).toHaveLength(2);
  });

  it('outside arc sweep', () => {
    const a = makeCircle({ x: 0, y: 0 }, 5);
    const arc = makeArc({ x: 6, y: 0 }, 5, -Math.PI / 4, Math.PI / 4);
    expect(intersect(a, arc)).toEqual([]);
  });
});

describe('arc-arc intersection (arcArc — both sweep filters)', () => {
  it('both arcs include the intersection points', () => {
    const a = makeArc({ x: 0, y: 0 }, 5, 0, Math.PI);
    const b = makeArc({ x: 6, y: 0 }, 5, Math.PI / 2, Math.PI * 1.5);
    const result = intersect(a, b);
    expect(result).toHaveLength(1);
    expect(result[0]?.x).toBeCloseTo(3, 9);
    expect(result[0]?.y).toBeCloseTo(4, 9);
  });

  it('one arc excludes both candidates: returns []', () => {
    const a = makeArc({ x: 0, y: 0 }, 5, -Math.PI / 4, Math.PI / 4);
    const b = makeArc({ x: 6, y: 0 }, 5, -Math.PI / 4, Math.PI / 4);
    expect(intersect(a, b)).toEqual([]);
  });
});

describe('composite decomposition: rectangle / polyline pairs', () => {
  it('line crosses 2 edges of a rectangle', () => {
    const rect = makeRect({ x: 0, y: 0 }, 10, 10);
    const line = makeLine({ x: -5, y: 5 }, { x: 15, y: 5 });
    const result = intersect(rect, line);
    expect(result).toHaveLength(2);
    const sorted = [...result].sort((a, b) => a.x - b.x);
    expect(sorted[0]?.x).toBeCloseTo(0, 9);
    expect(sorted[1]?.x).toBeCloseTo(10, 9);
  });

  it('circle entirely inside rectangle: no edge crossing', () => {
    const rect = makeRect({ x: 0, y: 0 }, 10, 10);
    const circle = makeCircle({ x: 5, y: 5 }, 3);
    expect(intersect(rect, circle)).toEqual([]);
  });

  it('open polyline crossing another open polyline at the centre', () => {
    const a = makePolyline(
      [
        { x: 0, y: 0 },
        { x: 10, y: 10 },
      ],
      false,
    );
    const b = makePolyline(
      [
        { x: 0, y: 10 },
        { x: 10, y: 0 },
      ],
      false,
    );
    const result = intersect(a, b);
    expect(result).toHaveLength(1);
    expect(result[0]?.x).toBeCloseTo(5, 9);
    expect(result[0]?.y).toBeCloseTo(5, 9);
  });
});

describe('xline excluded (per A2 + I-SNAP-4)', () => {
  it('xline ∩ line: returns []', () => {
    const x = makeXline({ x: 0, y: 0 }, 0);
    const line = makeLine({ x: 0, y: 5 }, { x: 10, y: 5 });
    expect(intersect(x, line)).toEqual([]);
  });

  it('xline ∩ circle: returns []', () => {
    const x = makeXline({ x: 0, y: 0 }, 0);
    const circle = makeCircle({ x: 5, y: 0 }, 2);
    expect(intersect(x, circle)).toEqual([]);
  });
});

describe('point excluded (per A3 + I-SNAP-4)', () => {
  it('point ∩ line: returns []', () => {
    const p = makePoint({ x: 5, y: 5 });
    const line = makeLine({ x: 0, y: 0 }, { x: 10, y: 10 });
    expect(intersect(p, line)).toEqual([]);
  });

  it('point ∩ circle: returns []', () => {
    const p = makePoint({ x: 5, y: 5 });
    const circle = makeCircle({ x: 5, y: 5 }, 0.001);
    expect(intersect(p, circle)).toEqual([]);
  });
});

describe('selfIntersect: atomic kinds return []', () => {
  it('line', () => expect(selfIntersect(makeLine({ x: 0, y: 0 }, { x: 1, y: 1 }))).toEqual([]));
  it('circle', () => expect(selfIntersect(makeCircle({ x: 0, y: 0 }, 5))).toEqual([]));
  it('arc', () => expect(selfIntersect(makeArc({ x: 0, y: 0 }, 5, 0, Math.PI))).toEqual([]));
  it('xline', () => expect(selfIntersect(makeXline({ x: 0, y: 0 }, 0))).toEqual([]));
  it('point', () => expect(selfIntersect(makePoint({ x: 0, y: 0 }))).toEqual([]));
});
