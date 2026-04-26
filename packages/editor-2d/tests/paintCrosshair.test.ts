// paintCrosshair tests for M1.3d Phase 8.

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

describe('paintCrosshair — full vs pickbox preset (I-DTP-19)', () => {
  it('renders 2 lines (1 horizontal, 1 vertical) at sizePct=100', () => {
    const { ctx, calls } = makeCtxRecorder();
    paintCrosshair(ctx, { x: 0, y: 0 }, 100, viewport, dark);
    const moveTos = calls.filter((c) => c.method === 'moveTo');
    const lineTos = calls.filter((c) => c.method === 'lineTo');
    expect(moveTos).toHaveLength(2);
    expect(lineTos).toHaveLength(2);
    expect(calls.find((c) => c.method === 'stroke')).toBeDefined();
  });

  it('renders 2 lines at sizePct=5 (pickbox)', () => {
    const { ctx, calls } = makeCtxRecorder();
    paintCrosshair(ctx, { x: 0, y: 0 }, 5, viewport, dark);
    const moveTos = calls.filter((c) => c.method === 'moveTo');
    const lineTos = calls.filter((c) => c.method === 'lineTo');
    expect(moveTos).toHaveLength(2);
    expect(lineTos).toHaveLength(2);
  });

  it('full-canvas extents are larger than pickbox extents', () => {
    const { ctx: fullCtx, calls: fullCalls } = makeCtxRecorder();
    paintCrosshair(fullCtx, { x: 0, y: 0 }, 100, viewport, dark);
    const { ctx: pickCtx, calls: pickCalls } = makeCtxRecorder();
    paintCrosshair(pickCtx, { x: 0, y: 0 }, 5, viewport, dark);

    const horizontalSpan = (calls: CtxCall[]): number => {
      const moveTo = calls.find((c) => c.method === 'moveTo');
      const lineTo = calls.find((c) => c.method === 'lineTo');
      const x1 = moveTo?.args[0] as number;
      const x2 = lineTo?.args[0] as number;
      return Math.abs(x2 - x1);
    };
    const fullSpan = horizontalSpan(fullCalls);
    const pickSpan = horizontalSpan(pickCalls);
    expect(fullSpan).toBeGreaterThan(pickSpan);
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
});
