// M1.3 Round 6 — paintDimensionGuides per-shape dispatch tests per
// plan §11. Asserts each variant emits the expected primitive calls
// (witness + dim line + arrow ticks for linear-dim; ctx.arc for
// angle-arc; tick mark for radius-line). Plan §10 audit C3.8.
//
// Records ctx calls via a Proxy recorder (same pattern as
// paintCrosshair.test.ts).

import { dark } from '@portplanner/design-system';
import { describe, expect, it } from 'vitest';

import { paintDimensionGuides } from '../src/canvas/painters/paintDimensionGuides';
import type { Viewport } from '../src/canvas/view-transform';
import type { DimensionGuide } from '../src/tools/types';

const viewport: Viewport = {
  panX: 0,
  panY: 0,
  zoom: 10,
  dpr: 1,
  canvasWidthCss: 800,
  canvasHeightCss: 600,
  crosshairSizePct: 100,
};

interface CtxCall {
  method: string;
  args: unknown[];
}

function makeCtxRecorder(): { ctx: CanvasRenderingContext2D; calls: CtxCall[] } {
  const calls: CtxCall[] = [];
  const state: Record<string, unknown> = {};
  const handler: ProxyHandler<object> = {
    get(_t, prop) {
      const k = prop as string;
      if (k in state) return state[k];
      return (...args: unknown[]) => calls.push({ method: k, args });
    },
    set(_t, prop, value) {
      state[prop as string] = value;
      calls.push({ method: `set:${String(prop)}`, args: [value] });
      return true;
    },
  };
  return { ctx: new Proxy({}, handler) as unknown as CanvasRenderingContext2D, calls };
}

describe('paintDimensionGuides — per-shape dispatch', () => {
  it("'linear-dim' (full mode) emits witness lines + dim line + filled-square end-caps (NO arrow ticks per AC)", () => {
    const guide: DimensionGuide = {
      kind: 'linear-dim',
      anchorA: { x: 0, y: 0 },
      anchorB: { x: 10, y: 0 },
      offsetCssPx: 10,
    };
    const { ctx, calls } = makeCtxRecorder();
    paintDimensionGuides(ctx, [guide], viewport, dark);
    // Expected sub-paths in FULL mode:
    //   - 2 witness lines + 1 dim line in a single beginPath/stroke
    //     pair (3 moveTo + 3 lineTo).
    //   - 2 fillRect calls for the end-cap squares (one per witness end).
    //   - NO paintTickAt calls — arrow ticks were removed in favour of
    //     end-cap squares (AC parity; user feedback "you added end cap
    //     squares and kept arrows" — the duplicate was incorrect).
    const moveTos = calls.filter((c) => c.method === 'moveTo');
    const lineTos = calls.filter((c) => c.method === 'lineTo');
    expect(moveTos.length).toBeGreaterThanOrEqual(3);
    expect(lineTos.length).toBeGreaterThanOrEqual(3);
    expect(calls.filter((c) => c.method === 'fillRect').length).toBe(2);
    expect(calls.filter((c) => c.method === 'stroke').length).toBeGreaterThanOrEqual(1);
  });

  it("'angle-arc' emits ctx.arc with pivot + base + sweep; radius is the AUTHORITATIVE radiusMetric field (= line length per Round-2 user spec)", () => {
    const guide: DimensionGuide = {
      kind: 'angle-arc',
      pivot: { x: 5, y: 5 },
      baseAngleRad: 0,
      sweepAngleRad: Math.PI / 6,
      radiusMetric: 7,
    };
    const { ctx, calls } = makeCtxRecorder();
    paintDimensionGuides(ctx, [guide], viewport, dark);
    const arcs = calls.filter((c) => c.method === 'arc');
    expect(arcs).toHaveLength(1);
    const arc = arcs[0];
    if (!arc) throw new Error('no arc call');
    const [cx, cy, r, start, end] = arc.args as [number, number, number, number, number];
    expect(cx).toBeCloseTo(5, 6);
    expect(cy).toBeCloseTo(5, 6);
    // Round-2 user spec: radiusMetric is the arc radius directly (no
    // CSS-px ↔ metric conversion needed in the painter).
    expect(r).toBeCloseTo(7, 6);
    expect(start).toBeCloseTo(0, 6);
    expect(end).toBeCloseTo(Math.PI / 6, 6);
  });

  // Round-2 remediation Blocker fix: angle-arc geometry must produce
  // visually-correct wedge orientation in all four quadrants of the
  // (cursor - pivot) vector. Test asserts the SEMANTIC contract:
  //   - sweep > 0 → ccw=false (visually CCW under Y-flipped transform)
  //   - sweep < 0 → ccw=true  (visually CW under Y-flipped transform)
  //   - end angle = baseAngleRad + sweepAngleRad
  // Each quadrant uses pivot at line start (origin) + a representative
  // cursor in that quadrant; sweep = atan2(cursor.y - p1.y, cursor.x - p1.x)
  // matches what draw-line.ts emits.
  describe('angle-arc quadrant orientation (Round-2 Blocker fix — wedge side correctness)', () => {
    function arcCallFor(cursor: { x: number; y: number }) {
      const sweep = Math.atan2(cursor.y, cursor.x);
      const guide: DimensionGuide = {
        kind: 'angle-arc',
        pivot: { x: 0, y: 0 },
        baseAngleRad: 0,
        sweepAngleRad: sweep,
        radiusMetric: Math.hypot(cursor.x, cursor.y),
      };
      const { ctx, calls } = makeCtxRecorder();
      paintDimensionGuides(ctx, [guide], viewport, dark);
      const arc = calls.filter((c) => c.method === 'arc')[0];
      if (!arc) throw new Error('no arc call');
      const [, , , start, end, ccw] = arc.args as [number, number, number, number, number, boolean];
      return { sweep, start, end, ccw };
    }

    it('NE quadrant (cursor up-right of pivot): sweep > 0, ccw=false → small wedge ABOVE baseline visually', () => {
      const r = arcCallFor({ x: 10, y: 5 });
      expect(r.sweep).toBeGreaterThan(0);
      expect(r.sweep).toBeLessThan(Math.PI / 2);
      expect(r.start).toBeCloseTo(0, 6);
      expect(r.end).toBeCloseTo(r.sweep, 6);
      expect(r.ccw).toBe(false);
    });

    it('SE quadrant (cursor down-right of pivot): sweep < 0, ccw=true → small wedge BELOW baseline visually', () => {
      const r = arcCallFor({ x: 10, y: -5 });
      expect(r.sweep).toBeLessThan(0);
      expect(r.sweep).toBeGreaterThan(-Math.PI / 2);
      expect(r.start).toBeCloseTo(0, 6);
      expect(r.end).toBeCloseTo(r.sweep, 6);
      expect(r.ccw).toBe(true);
    });

    it('NW quadrant (cursor up-left of pivot): sweep > π/2, ccw=false → wedge sweeps CCW past 90°', () => {
      const r = arcCallFor({ x: -10, y: 5 });
      expect(r.sweep).toBeGreaterThan(Math.PI / 2);
      expect(r.sweep).toBeLessThan(Math.PI);
      expect(r.start).toBeCloseTo(0, 6);
      expect(r.end).toBeCloseTo(r.sweep, 6);
      expect(r.ccw).toBe(false);
    });

    it('SW quadrant (cursor down-left of pivot): sweep < -π/2, ccw=true → wedge sweeps CW past -90°', () => {
      const r = arcCallFor({ x: -10, y: -5 });
      expect(r.sweep).toBeLessThan(-Math.PI / 2);
      expect(r.sweep).toBeGreaterThan(-Math.PI);
      expect(r.start).toBeCloseTo(0, 6);
      expect(r.end).toBeCloseTo(r.sweep, 6);
      expect(r.ccw).toBe(true);
    });

    it('horizontal-right (cursor exactly east of pivot): sweep = 0 → degenerate zero-sweep arc', () => {
      const r = arcCallFor({ x: 10, y: 0 });
      expect(r.sweep).toBeCloseTo(0, 6);
      expect(r.end).toBeCloseTo(r.start, 6);
    });
  });

  it("'radius-line' is a visual no-op (AC parity — paintPreview's circle arm draws the radius line; pill sits on its midpoint)", () => {
    const guide: DimensionGuide = {
      kind: 'radius-line',
      pivot: { x: 0, y: 0 },
      endpoint: { x: 10, y: 0 },
    };
    const { ctx, calls } = makeCtxRecorder();
    paintDimensionGuides(ctx, [guide], viewport, dark);
    // Painter draws ONLY the ctx.save/setLineDash/setStroke setup (from
    // the outer paintDimensionGuides scope) — no moveTo/lineTo/arc from
    // the radius-line case. Plan §3 A2 explicitly allowed the no-op.
    expect(calls.filter((c) => c.method === 'moveTo')).toHaveLength(0);
    expect(calls.filter((c) => c.method === 'lineTo')).toHaveLength(0);
    expect(calls.filter((c) => c.method === 'arc')).toHaveLength(0);
  });

  it('empty guide array is a no-op (no save/restore noise)', () => {
    const { ctx, calls } = makeCtxRecorder();
    paintDimensionGuides(ctx, [], viewport, dark);
    expect(calls).toHaveLength(0);
  });
});
