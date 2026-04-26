// paintCrosshair tests for M1.3d Phase 8 + M1.3d-Remediation R2b.
//
// R2b changed the visual model from "two long lines through cursor" to
// "four arms with a center gap around a pickbox square" — these tests
// reflect that contract: 4 moveTo + 4 lineTo per crosshair (was 2/2),
// plus a strokeRect for the pickbox + an assertion that no line segment
// crosses into the pickbox region.

import { dark } from '@portplanner/design-system';
import { describe, expect, it } from 'vitest';

import { paintCrosshair } from '../src/canvas/painters/paintCrosshair';
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

const PICKBOX_HALF_CSS = 5;

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

describe('paintCrosshair — full vs pickbox preset (I-DTP-19 + R2b pickbox)', () => {
  it('renders 4 line segments (2 horizontal arms + 2 vertical arms) at sizePct=100', () => {
    const { ctx, calls } = makeCtxRecorder();
    paintCrosshair(ctx, { x: 0, y: 0 }, 100, viewport, dark);
    const moveTos = calls.filter((c) => c.method === 'moveTo');
    const lineTos = calls.filter((c) => c.method === 'lineTo');
    // R2b: was 2 moveTo + 2 lineTo (continuous lines); now 4+4 (arms with
    // pickbox gap).
    expect(moveTos).toHaveLength(4);
    expect(lineTos).toHaveLength(4);
    expect(calls.find((c) => c.method === 'stroke')).toBeDefined();
  });

  it('renders 4 line segments at sizePct=5 (pickbox preset)', () => {
    const { ctx, calls } = makeCtxRecorder();
    paintCrosshair(ctx, { x: 0, y: 0 }, 5, viewport, dark);
    const moveTos = calls.filter((c) => c.method === 'moveTo');
    const lineTos = calls.filter((c) => c.method === 'lineTo');
    // sizePct=5 → crossLen=30 device px → halfH=halfV=15 → arms still
    // visible (halfH > pbHalf), so all 4 segments draw.
    expect(moveTos).toHaveLength(4);
    expect(lineTos).toHaveLength(4);
  });

  it('full-canvas extents are larger than pickbox extents', () => {
    const { ctx: fullCtx, calls: fullCalls } = makeCtxRecorder();
    paintCrosshair(fullCtx, { x: 0, y: 0 }, 100, viewport, dark);
    const { ctx: pickCtx, calls: pickCalls } = makeCtxRecorder();
    paintCrosshair(pickCtx, { x: 0, y: 0 }, 5, viewport, dark);

    // R2b: each axis is now TWO segments (left arm + right arm). Compare
    // the outer extent of the leftmost arm: from `cx-halfH` to `cx-pbHalf`.
    // The further-from-cx endpoint is the moveTo at `cx-halfH`.
    const cxCanvas = (viewport.canvasWidthCss / 2) * viewport.dpr;
    const leftmostExtent = (calls: CtxCall[]): number => {
      const moveTos = calls.filter((c) => c.method === 'moveTo');
      // Find the smallest X-value moveTo (leftmost arm origin).
      const xs = moveTos.map((c) => c.args[0] as number);
      const minX = Math.min(...xs);
      return Math.abs(cxCanvas - minX);
    };
    expect(leftmostExtent(fullCalls)).toBeGreaterThan(leftmostExtent(pickCalls));
  });

  it('sizePct=0 is a no-op (no path commands)', () => {
    const { ctx, calls } = makeCtxRecorder();
    paintCrosshair(ctx, { x: 0, y: 0 }, 0, viewport, dark);
    expect(calls).toEqual([]);
  });

  it('reads color from canvas.transient.crosshair', () => {
    const { ctx, calls } = makeCtxRecorder();
    paintCrosshair(ctx, { x: 0, y: 0 }, 100, viewport, dark);
    const strokeSet = calls.find((c) => c.method === 'set:strokeStyle');
    expect(strokeSet?.args[0]).toBe(dark.canvas.transient.crosshair);
  });

  it('resets transform to identity (screen-space)', () => {
    const { ctx, calls } = makeCtxRecorder();
    paintCrosshair(ctx, { x: 0, y: 0 }, 100, viewport, dark);
    const setT = calls.find((c) => c.method === 'setTransform');
    expect(setT?.args).toEqual([1, 0, 0, 1, 0, 0]);
  });

  it('"solid" sentinel produces empty dash array (no setLineDash content)', () => {
    const { ctx, calls } = makeCtxRecorder();
    paintCrosshair(ctx, { x: 0, y: 0 }, 100, viewport, dark);
    const setLineDash = calls.find((c) => c.method === 'setLineDash');
    expect(setLineDash?.args[0]).toEqual([]);
  });

  // M1.3d-Remediation R2b — new pickbox + segment-clear assertions.

  it('R2b: draws a pickbox square at the cursor (strokeRect with PICKBOX_HALF_CSS extent)', () => {
    const { ctx, calls } = makeCtxRecorder();
    paintCrosshair(ctx, { x: 5, y: 0 }, 100, viewport, dark);
    // Cursor metric (5, 0) → screen (450, 300). dpr=1 → device (450, 300).
    // Pickbox top-left = (cx - pbHalf, cy - pbHalf) = (445, 295). Side = 10.
    const strokeRect = calls.find((c) => c.method === 'strokeRect');
    expect(strokeRect).toBeDefined();
    const [rx, ry, w, h] = strokeRect!.args as [number, number, number, number];
    expect(rx).toBe(450 - PICKBOX_HALF_CSS);
    expect(ry).toBe(300 - PICKBOX_HALF_CSS);
    expect(w).toBe(PICKBOX_HALF_CSS * 2);
    expect(h).toBe(PICKBOX_HALF_CSS * 2);
  });

  it('R2b: line segments do not cross the pickbox region (cx ± pbHalf gap)', () => {
    const { ctx, calls } = makeCtxRecorder();
    paintCrosshair(ctx, { x: 0, y: 0 }, 100, viewport, dark);
    // Cursor at metric (0, 0) → screen (400, 300). dpr=1.
    const cx = 400;
    const cy = 300;
    const pbHalf = PICKBOX_HALF_CSS;
    // Every moveTo / lineTo endpoint MUST sit at cx ± pbHalf or beyond on
    // the X axis (for horizontal arms) OR at cy ± pbHalf or beyond on the
    // Y axis (for vertical arms). In other words: no endpoint may be
    // strictly inside the pickbox square (exclusive boundary).
    const pathCalls = calls.filter((c) => c.method === 'moveTo' || c.method === 'lineTo');
    for (const c of pathCalls) {
      const [x, y] = c.args as [number, number];
      const insidePickbox = Math.abs(x - cx) < pbHalf && Math.abs(y - cy) < pbHalf;
      expect(
        insidePickbox,
        `${c.method}(${x}, ${y}) sits inside the pickbox region [${cx - pbHalf}, ${cx + pbHalf}] × [${cy - pbHalf}, ${cy + pbHalf}]`,
      ).toBe(false);
    }
  });
});
