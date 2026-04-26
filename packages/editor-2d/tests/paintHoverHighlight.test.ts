// paintHoverHighlight tests for M1.3d Phase 5.

import { dark } from '@portplanner/design-system';
import { LayerId, type Primitive, newPrimitiveId } from '@portplanner/domain';
import { describe, expect, it } from 'vitest';

import { paintHoverHighlight } from '../src/canvas/painters/paintHoverHighlight';
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

describe('paintHoverHighlight — uses canvas.transient.hover_highlight (I-DTP-1)', () => {
  it('strokes the entity outline using transient.hover_highlight.stroke', () => {
    const { ctx, calls } = makeCtxRecorder();
    paintHoverHighlight(ctx, line(), viewport, dark);
    const strokeSet = calls.find((c) => c.method === 'set:strokeStyle');
    expect(strokeSet?.args[0]).toBe(dark.canvas.transient.hover_highlight.stroke);
    const strokeCall = calls.find((c) => c.method === 'stroke');
    expect(strokeCall).toBeDefined();
  });

  it('applies a dash pattern parsed from transient.hover_highlight.dash', () => {
    const { ctx, calls } = makeCtxRecorder();
    paintHoverHighlight(ctx, line(), viewport, dark);
    const setLineDash = calls.find((c) => c.method === 'setLineDash');
    expect(setLineDash).toBeDefined();
    const dashArg = setLineDash?.args[0] as number[];
    expect(Array.isArray(dashArg)).toBe(true);
    // hover_highlight.dash = '4 2' → 2 entries, both > 0 (after dpr/zoom scaling).
    expect(dashArg).toHaveLength(2);
  });

  it('does not call ctx.fillText (Gate DTP-T2: only paintTransientLabel does that)', () => {
    const { ctx, calls } = makeCtxRecorder();
    paintHoverHighlight(ctx, line(), viewport, dark);
    expect(calls.find((c) => c.method === 'fillText')).toBeUndefined();
    expect(calls.find((c) => c.method === 'strokeText')).toBeUndefined();
  });
});
