import { LayerId, type Grid, type Primitive, newGridId, newPrimitiveId } from '@portplanner/domain';
import { describe, expect, it } from 'vitest';

import { commitSnappedVertex } from '../src/snap/commit';
import { DEFAULT_METRIC_EPSILON, equalsMetric } from '../src/snap/equals';
import { gatherOsnapCandidates } from '../src/snap/osnap';
import { applyOrtho } from '../src/snap/ortho';
import { resolveSnap } from '../src/snap/priority';
import { isSnapCandidate } from '../src/snap/screen-tolerance';
import type { Viewport } from '../src/canvas/view-transform';

const viewport: Viewport = {
  panX: 0,
  panY: 0,
  zoom: 10,
  dpr: 1,
  canvasWidthCss: 800,
  canvasHeightCss: 600,
};

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

describe('Layer-1 commit (bit-copy)', () => {
  it('returns a new Point2D with bit-identical coords to target (I-39)', () => {
    const target = { x: 1.234567, y: -8.765432 };
    const committed = commitSnappedVertex(target);
    expect(Object.is(committed.x, target.x)).toBe(true);
    expect(Object.is(committed.y, target.y)).toBe(true);
    // It's a new object (not aliased)
    expect(committed).not.toBe(target);
  });
});

describe('Layer-2 equalsMetric', () => {
  it('default ε is 1e-6 (I-37)', () => {
    expect(DEFAULT_METRIC_EPSILON).toBe(1e-6);
  });
  it('returns true within ε', () => {
    expect(equalsMetric({ x: 0, y: 0 }, { x: 5e-7, y: 0 })).toBe(true);
  });
  it('returns false outside ε', () => {
    expect(equalsMetric({ x: 0, y: 0 }, { x: 1e-3, y: 0 })).toBe(false);
  });
});

describe('Layer-3 isSnapCandidate', () => {
  it('default px tolerance is 10 (I-38)', () => {
    // At zoom=10 px/m, 10 px = 1 m. Candidate at 0.99 m should snap, 1.01 m should not.
    expect(isSnapCandidate({ x: 0, y: 0 }, { x: 0.99, y: 0 }, viewport)).toBe(true);
    expect(isSnapCandidate({ x: 0, y: 0 }, { x: 1.01, y: 0 }, viewport)).toBe(false);
  });
});

describe('OSNAP candidates (M1.3a subset)', () => {
  it('endpoints of a line', () => {
    const a = line({ x: 0, y: 0 }, { x: 10, y: 0 });
    const cands = gatherOsnapCandidates([a]);
    const eps = cands.filter((c) => c.kind === 'endpoint');
    expect(eps).toHaveLength(2);
  });

  it('midpoint of a line', () => {
    const a = line({ x: 0, y: 0 }, { x: 10, y: 0 });
    const cands = gatherOsnapCandidates([a]);
    const mid = cands.find((c) => c.kind === 'midpoint');
    expect(mid?.point).toEqual({ x: 5, y: 0 });
  });

  it('intersection of two crossing lines', () => {
    const a = line({ x: 0, y: 0 }, { x: 10, y: 10 });
    const b = line({ x: 0, y: 10 }, { x: 10, y: 0 });
    const cands = gatherOsnapCandidates([a, b]);
    const ix = cands.find((c) => c.kind === 'intersection');
    expect(ix?.point.x).toBeCloseTo(5, 6);
    expect(ix?.point.y).toBeCloseTo(5, 6);
  });

  it('node candidates from polyline vertices', () => {
    const poly: Primitive = {
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
    const cands = gatherOsnapCandidates([poly]);
    const nodes = cands.filter((c) => c.kind === 'node');
    expect(nodes).toHaveLength(3);
  });
});

describe('Ortho modifier', () => {
  it('clamps to +X axis when |dx| >= |dy|', () => {
    expect(applyOrtho({ x: 0, y: 0 }, { x: 10, y: 3 })).toEqual({ x: 10, y: 0 });
  });
  it('clamps to +Y axis when |dy| > |dx|', () => {
    expect(applyOrtho({ x: 0, y: 0 }, { x: 3, y: 10 })).toEqual({ x: 0, y: 10 });
  });
});

describe('Snap priority resolver', () => {
  const grid: Grid = {
    id: newGridId(),
    origin: { x: 0, y: 0 },
    angle: 0,
    spacingX: 1,
    spacingY: 1,
    layerId: LayerId.DEFAULT,
    visible: true,
    activeForSnap: true,
  };

  it('OSNAP wins over GSNAP when both are within tolerance (I-40)', () => {
    const a = line({ x: 0, y: 0 }, { x: 10, y: 0 });
    const cursor = { x: 0.05, y: 0.05 }; // near endpoint (0,0) AND grid node (0,0)
    const hit = resolveSnap({
      cursor,
      priorPoint: null,
      primitives: [a],
      grids: [grid],
      viewport,
      toggles: { osnap: true, gsnap: true, ortho: false },
    });
    expect(hit.kind).toBe('endpoint');
  });

  it('GSNAP fires when no OSNAP candidate is within tolerance', () => {
    const cursor = { x: 0.05, y: 0.05 };
    const hit = resolveSnap({
      cursor,
      priorPoint: null,
      primitives: [],
      grids: [grid],
      viewport,
      toggles: { osnap: true, gsnap: true, ortho: false },
    });
    expect(hit.kind).toBe('grid-node');
  });

  it('Ortho applies AFTER snap (does not re-clamp away from OSNAP target — I-41)', () => {
    const a = line({ x: 5, y: 5 }, { x: 10, y: 10 });
    const cursor = { x: 5.05, y: 5.05 }; // near endpoint (5,5)
    const hit = resolveSnap({
      cursor,
      priorPoint: { x: 0, y: 0 },
      primitives: [a],
      grids: [grid],
      viewport,
      toggles: { osnap: true, gsnap: true, ortho: true },
    });
    // OSNAP returned (5,5); Ortho doesn't override.
    expect(hit.point).toEqual({ x: 5, y: 5 });
  });

  it('cursor passes through with Ortho applied when no snap fires', () => {
    const cursor = { x: 100, y: 3 };
    const hit = resolveSnap({
      cursor,
      priorPoint: { x: 0, y: 0 },
      primitives: [],
      grids: [],
      viewport,
      toggles: { osnap: false, gsnap: false, ortho: true },
    });
    // Ortho clamps to +X axis (|dx|=100 > |dy|=3).
    expect(hit.point).toEqual({ x: 100, y: 0 });
  });
});
