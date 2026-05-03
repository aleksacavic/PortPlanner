// paintCrosshair tests for M1.3d Phase 8 + M1.3d-Remediation R2b.
//
// R2b changed the visual model from "two long lines through cursor" to
// "four arms with a center gap around a pickbox square" — these tests
// reflect that contract: 4 moveTo + 4 lineTo per crosshair (was 2/2),
// plus a strokeRect for the pickbox + an assertion that no line segment
// crosses into the pickbox region.

import { dark } from '@portplanner/design-system';
import { describe, expect, it } from 'vitest';

import { paintCrosshair, resolveCrosshairMode } from '../src/canvas/painters/paintCrosshair';
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

describe('paintCrosshair — mode dispatch (full / pickbox / pick-point)', () => {
  it('renders 4 line segments (2 horizontal arms + 2 vertical arms) for mode=full', () => {
    const { ctx, calls } = makeCtxRecorder();
    paintCrosshair(ctx, { x: 0, y: 0 }, 'full', viewport, dark);
    const moveTos = calls.filter((c) => c.method === 'moveTo');
    const lineTos = calls.filter((c) => c.method === 'lineTo');
    expect(moveTos).toHaveLength(4);
    expect(lineTos).toHaveLength(4);
    expect(calls.find((c) => c.method === 'stroke')).toBeDefined();
  });

  it('renders 4 short arms + pickbox for mode=pickbox', () => {
    const { ctx, calls } = makeCtxRecorder();
    paintCrosshair(ctx, { x: 0, y: 0 }, 'pickbox', viewport, dark);
    // Pickbox mode = AC's minimum CURSORSIZE: short arms (sizePct=5) AND
    // the strokeRect pickbox. Regression test for the SSOT-migration bug
    // where pickbox mode was wired to sizePct=0 and lost its arms.
    const moveTos = calls.filter((c) => c.method === 'moveTo');
    const lineTos = calls.filter((c) => c.method === 'lineTo');
    expect(moveTos).toHaveLength(4);
    expect(lineTos).toHaveLength(4);
    expect(calls.find((c) => c.method === 'strokeRect')).toBeDefined();
  });

  it('renders pickbox-only (NO arms) for mode=pick-entity', () => {
    const { ctx, calls } = makeCtxRecorder();
    paintCrosshair(ctx, { x: 0, y: 0 }, 'pick-entity', viewport, dark);
    // Pick-entity: pickbox without arms — visual signal "click an
    // object". No moveTo / lineTo path commands; only the strokeRect
    // for the pickbox.
    const moveTos = calls.filter((c) => c.method === 'moveTo');
    const lineTos = calls.filter((c) => c.method === 'lineTo');
    expect(moveTos).toHaveLength(0);
    expect(lineTos).toHaveLength(0);
    expect(calls.find((c) => c.method === 'strokeRect')).toBeDefined();
  });

  it('pickbox arm length matches pick-point arm length (parity invariant)', () => {
    const { ctx: pbCtx, calls: pbCalls } = makeCtxRecorder();
    paintCrosshair(pbCtx, { x: 0, y: 0 }, 'pickbox', viewport, dark);
    const { ctx: ppCtx, calls: ppCalls } = makeCtxRecorder();
    paintCrosshair(ppCtx, { x: 0, y: 0 }, 'pick-point', viewport, dark);

    // Both modes share sizePct=5; only the pickbox-gap differs. The
    // outer endpoints (max-distance moveTo target on each axis) MUST
    // sit at the same canvas-relative extent for both modes.
    const cxCanvas = (viewport.canvasWidthCss / 2) * viewport.dpr;
    const outerExtent = (calls: CtxCall[]): number => {
      const moveTos = calls.filter((c) => c.method === 'moveTo');
      const xs = moveTos.map((c) => c.args[0] as number);
      return Math.abs(cxCanvas - Math.min(...xs));
    };
    expect(outerExtent(pbCalls)).toBe(outerExtent(ppCalls));
  });

  it('renders 4 short cross arms with NO pickbox for mode=pick-point', () => {
    const { ctx, calls } = makeCtxRecorder();
    paintCrosshair(ctx, { x: 0, y: 0 }, 'pick-point', viewport, dark);
    const moveTos = calls.filter((c) => c.method === 'moveTo');
    const lineTos = calls.filter((c) => c.method === 'lineTo');
    // sizePct=5 → halfH=halfV=15 device px → arms visible.
    expect(moveTos).toHaveLength(4);
    expect(lineTos).toHaveLength(4);
    // No pickbox — that's the whole point of pick-point mode.
    expect(calls.find((c) => c.method === 'strokeRect')).toBeUndefined();
  });

  it('full mode arms span the canvas; pick-point arms are short', () => {
    const { ctx: fullCtx, calls: fullCalls } = makeCtxRecorder();
    paintCrosshair(fullCtx, { x: 0, y: 0 }, 'full', viewport, dark);
    const { ctx: pickCtx, calls: pickCalls } = makeCtxRecorder();
    paintCrosshair(pickCtx, { x: 0, y: 0 }, 'pick-point', viewport, dark);

    const cxCanvas = (viewport.canvasWidthCss / 2) * viewport.dpr;
    const leftmostExtent = (calls: CtxCall[]): number => {
      const moveTos = calls.filter((c) => c.method === 'moveTo');
      const xs = moveTos.map((c) => c.args[0] as number);
      return Math.abs(cxCanvas - Math.min(...xs));
    };
    expect(leftmostExtent(fullCalls)).toBeGreaterThan(leftmostExtent(pickCalls));
  });

  it('reads color from canvas.transient.crosshair', () => {
    const { ctx, calls } = makeCtxRecorder();
    paintCrosshair(ctx, { x: 0, y: 0 }, 'full', viewport, dark);
    const strokeSet = calls.find((c) => c.method === 'set:strokeStyle');
    expect(strokeSet?.args[0]).toBe(dark.canvas.transient.crosshair);
  });

  it('resets transform to identity (screen-space)', () => {
    const { ctx, calls } = makeCtxRecorder();
    paintCrosshair(ctx, { x: 0, y: 0 }, 'full', viewport, dark);
    const setT = calls.find((c) => c.method === 'setTransform');
    expect(setT?.args).toEqual([1, 0, 0, 1, 0, 0]);
  });

  it('"solid" sentinel produces empty dash array (no setLineDash content)', () => {
    const { ctx, calls } = makeCtxRecorder();
    paintCrosshair(ctx, { x: 0, y: 0 }, 'full', viewport, dark);
    const setLineDash = calls.find((c) => c.method === 'setLineDash');
    expect(setLineDash?.args[0]).toEqual([]);
  });

  it('full mode: pickbox at cursor (strokeRect with PICKBOX_HALF_CSS extent)', () => {
    const { ctx, calls } = makeCtxRecorder();
    paintCrosshair(ctx, { x: 5, y: 0 }, 'full', viewport, dark);
    const strokeRect = calls.find((c) => c.method === 'strokeRect');
    expect(strokeRect).toBeDefined();
    const [rx, ry, w, h] = strokeRect!.args as [number, number, number, number];
    expect(rx).toBe(450 - PICKBOX_HALF_CSS);
    expect(ry).toBe(300 - PICKBOX_HALF_CSS);
    expect(w).toBe(PICKBOX_HALF_CSS * 2);
    expect(h).toBe(PICKBOX_HALF_CSS * 2);
  });

  it('full mode: arms skip the pickbox region (cx ± pbHalf gap)', () => {
    const { ctx, calls } = makeCtxRecorder();
    paintCrosshair(ctx, { x: 0, y: 0 }, 'full', viewport, dark);
    const cx = 400;
    const cy = 300;
    const pbHalf = PICKBOX_HALF_CSS;
    const pathCalls = calls.filter((c) => c.method === 'moveTo' || c.method === 'lineTo');
    for (const c of pathCalls) {
      const [x, y] = c.args as [number, number];
      const insidePickbox = Math.abs(x - cx) < pbHalf && Math.abs(y - cy) < pbHalf;
      expect(insidePickbox, `${c.method}(${x}, ${y}) sits inside the pickbox region`).toBe(false);
    }
  });

  it('pick-point mode: arms run continuously through the cursor (no pickbox gap)', () => {
    const { ctx, calls } = makeCtxRecorder();
    paintCrosshair(ctx, { x: 0, y: 0 }, 'pick-point', viewport, dark);
    const cx = 400;
    const cy = 300;
    // Without pickbox, the inner endpoints sit AT the cursor itself
    // (gap=0). Each axis still has 2 segments because the painter writes
    // moveTo(outer) → lineTo(0) twice; assert at least one endpoint
    // touches the cursor center.
    const moveTos = calls.filter((c) => c.method === 'moveTo');
    const lineTos = calls.filter((c) => c.method === 'lineTo');
    const allEndpoints = [...moveTos, ...lineTos].map((c) => c.args as [number, number]);
    const atCenter = allEndpoints.some(([x, y]) => x === cx && y === cy);
    expect(atCenter).toBe(true);
  });
});

describe('resolveCrosshairMode — SSOT precedence rule', () => {
  it('point-pick wins over user toggle (full)', () => {
    expect(resolveCrosshairMode({ pointPickActive: true, userSizePct: 100 })).toBe('pick-point');
  });
  it('point-pick wins over user toggle (pickbox)', () => {
    expect(resolveCrosshairMode({ pointPickActive: true, userSizePct: 5 })).toBe('pick-point');
  });
  it('no point-pick + sizePct >= 50 → full', () => {
    expect(resolveCrosshairMode({ pointPickActive: false, userSizePct: 100 })).toBe('full');
    expect(resolveCrosshairMode({ pointPickActive: false, userSizePct: 50 })).toBe('full');
  });
  it('no point-pick + sizePct < 50 → pickbox', () => {
    expect(resolveCrosshairMode({ pointPickActive: false, userSizePct: 5 })).toBe('pickbox');
    expect(resolveCrosshairMode({ pointPickActive: false, userSizePct: 0 })).toBe('pickbox');
  });
  it('entity-pick wins over point-pick AND user toggle', () => {
    expect(
      resolveCrosshairMode({ entityPickActive: true, pointPickActive: false, userSizePct: 100 }),
    ).toBe('pick-entity');
    expect(
      resolveCrosshairMode({ entityPickActive: true, pointPickActive: true, userSizePct: 5 }),
    ).toBe('pick-entity');
  });
  it('entity-pick omitted (back-compat) → resolver behaves as before', () => {
    expect(resolveCrosshairMode({ pointPickActive: true, userSizePct: 100 })).toBe('pick-point');
    expect(resolveCrosshairMode({ pointPickActive: false, userSizePct: 100 })).toBe('full');
  });
});
