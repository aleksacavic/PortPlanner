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
  it("'linear-dim' emits witness lines + dim line + 2 arrow ticks (one per end)", () => {
    const guide: DimensionGuide = {
      kind: 'linear-dim',
      anchorA: { x: 0, y: 0 },
      anchorB: { x: 10, y: 0 },
      offsetCssPx: 10,
    };
    const { ctx, calls } = makeCtxRecorder();
    paintDimensionGuides(ctx, [guide], viewport, dark);
    // Expected sub-paths:
    //   - 2 witness lines (1 moveTo + 1 lineTo each = 2 of each)
    //   - 1 dim line (1 moveTo + 1 lineTo)
    //   - 2 arrow ticks (each tick = 2 strokes via 2 moveTo + 2 lineTo)
    // → ≥7 moveTo, ≥7 lineTo total. Stroke called multiple times.
    const moveTos = calls.filter((c) => c.method === 'moveTo');
    const lineTos = calls.filter((c) => c.method === 'lineTo');
    expect(moveTos.length).toBeGreaterThanOrEqual(7);
    expect(lineTos.length).toBeGreaterThanOrEqual(7);
    expect(calls.filter((c) => c.method === 'stroke').length).toBeGreaterThanOrEqual(3);
  });

  it("'angle-arc' emits ctx.arc with the right pivot + base + sweep + radius (in metric)", () => {
    const guide: DimensionGuide = {
      kind: 'angle-arc',
      pivot: { x: 5, y: 5 },
      baseAngleRad: 0,
      sweepAngleRad: Math.PI / 6,
      radiusCssPx: 40,
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
    // radiusCssPx 40 / metricToPx (zoom 10 * dpr 1 = 10) = 4 metric units.
    expect(r).toBeCloseTo(4, 6);
    expect(start).toBeCloseTo(0, 6);
    expect(end).toBeCloseTo(Math.PI / 6, 6);
  });

  it("'radius-line' emits a perpendicular tick at the segment midpoint", () => {
    const guide: DimensionGuide = {
      kind: 'radius-line',
      pivot: { x: 0, y: 0 },
      endpoint: { x: 10, y: 0 },
    };
    const { ctx, calls } = makeCtxRecorder();
    paintDimensionGuides(ctx, [guide], viewport, dark);
    // Expect at least one moveTo + lineTo for the tick stroke.
    const moveTos = calls.filter((c) => c.method === 'moveTo');
    const lineTos = calls.filter((c) => c.method === 'lineTo');
    expect(moveTos.length).toBeGreaterThanOrEqual(1);
    expect(lineTos.length).toBeGreaterThanOrEqual(1);
    expect(calls.find((c) => c.method === 'stroke')).toBeDefined();
  });

  it('empty guide array is a no-op (no save/restore noise)', () => {
    const { ctx, calls } = makeCtxRecorder();
    paintDimensionGuides(ctx, [], viewport, dark);
    expect(calls).toHaveLength(0);
  });
});
