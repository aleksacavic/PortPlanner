import {
  LayerId,
  type PolylinePrimitive,
  type Primitive,
  newPrimitiveId,
} from '@portplanner/domain';
import { describe, expect, it } from 'vitest';

import { hitTest } from '../src/canvas/hit-test';
import { PrimitiveSpatialIndex } from '../src/canvas/spatial-index';
import { metricToScreen } from '../src/canvas/view-transform';
import type { Viewport } from '../src/canvas/view-transform';

const viewport: Viewport = {
  panX: 0,
  panY: 0,
  zoom: 10,
  dpr: 1,
  canvasWidthCss: 800,
  canvasHeightCss: 600,
  crosshairSizePct: 100,
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

describe('hit-test', () => {
  it('returns the line id when cursor is near it', () => {
    const idx = new PrimitiveSpatialIndex();
    const a = line({ x: 0, y: 0 }, { x: 10, y: 0 });
    idx.insert(a);
    const map = { [a.id]: a } as never;
    // Metric (5, 0) → screen 400+50, 300-0 = (450, 300)
    const id = hitTest({ x: 450, y: 300 }, viewport, idx, map);
    expect(id).toBe(a.id);
  });

  it('returns null when cursor is far from all primitives', () => {
    const idx = new PrimitiveSpatialIndex();
    const a = line({ x: 0, y: 0 }, { x: 10, y: 0 });
    idx.insert(a);
    const map = { [a.id]: a } as never;
    // Far corner of canvas
    const id = hitTest({ x: 0, y: 0 }, viewport, idx, map);
    expect(id).toBeNull();
  });

  // M1.3b fillet-chamfer Phase 1 — arc-aware polyline hit-test (closes
  // ADR-016 §170 hit-test bulge gap). Polyline geometry: 2 vertices at
  // (0,0)→(2,0), bulge tan(π/8). Arc params (per arcParamsFromBulge):
  // center (1, 1), radius √2 ≈ 1.414, span -3π/4 → -π/4. Arc midpoint
  // at (1, 1-√2) ≈ (1, -0.414). Tolerance 6px / 10 zoom = 0.6 metric.
  describe('bulged polyline arc segments', () => {
    function bulgedPolyline(): PolylinePrimitive {
      return {
        id: newPrimitiveId(),
        kind: 'polyline',
        layerId: LayerId.DEFAULT,
        displayOverrides: {},
        vertices: [
          { x: 0, y: 0 },
          { x: 2, y: 0 },
        ],
        bulges: [Math.tan(Math.PI / 8)],
        closed: false,
      };
    }

    it('cursor on the arc curve hits the polyline', () => {
      const idx = new PrimitiveSpatialIndex();
      const p = bulgedPolyline();
      idx.insert(p);
      const map = { [p.id]: p } as never;
      // Arc midpoint = (1, 1-√2) ≈ (1, -0.414).
      const arcMidMetric = { x: 1, y: 1 - Math.SQRT2 };
      const screen = metricToScreen(arcMidMetric, viewport);
      const id = hitTest({ x: screen.x, y: screen.y }, viewport, idx, map);
      expect(id).toBe(p.id);
    });

    it('cursor on chord-side OPPOSITE the arc misses (arc-aware vs chord)', () => {
      // Cursor at (1, +0.3) — chord-perpendicular distance is 0.3 (within
      // tolerance 0.6, would HIT under the prior chord-approximation
      // logic). But the arc bulges DOWNWARD (toward y < 0), so the arc
      // distance from (1, +0.3) is |hypot(0, 0.3-1) - √2| = |0.7 - 1.414|
      // ≈ 0.714 metric — OUTSIDE tolerance 0.6. Arc-aware logic correctly
      // returns null; this is the test that fails under chord-only logic.
      const idx = new PrimitiveSpatialIndex();
      const p = bulgedPolyline();
      idx.insert(p);
      const map = { [p.id]: p } as never;
      const cursorMetric = { x: 1, y: 0.3 };
      const screen = metricToScreen(cursorMetric, viewport);
      const id = hitTest({ x: screen.x, y: screen.y }, viewport, idx, map);
      expect(id).toBeNull();
    });
  });
});
