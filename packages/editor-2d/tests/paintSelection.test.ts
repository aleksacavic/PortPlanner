// paintSelection tests for M1.3d Phase 5.

import { dark } from '@portplanner/design-system';
import { LayerId, type Primitive, newPrimitiveId } from '@portplanner/domain';
import { describe, expect, it } from 'vitest';

import { gripsOf } from '../src/canvas/grip-positions';
import { paintSelection } from '../src/canvas/painters/paintSelection';
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

describe('paintSelection — outline + grip squares (I-DTP-11)', () => {
  it('strokes the outline using transient.selection_window.stroke (solid, no dash)', () => {
    const p = line();
    const grips = gripsOf(p);
    const { ctx, calls } = makeCtxRecorder();
    paintSelection(ctx, p, grips, viewport, dark);
    const strokeSet = calls.find((c) => c.method === 'set:strokeStyle');
    expect(strokeSet?.args[0]).toBe(dark.canvas.transient.selection_window.stroke);
    const setLineDash = calls.find((c) => c.method === 'setLineDash');
    expect(setLineDash?.args[0]).toEqual([]);
  });

  it('renders one filled square + outlined square per grip on the entity', () => {
    const p = line();
    const grips = gripsOf(p); // 2 grips
    const { ctx, calls } = makeCtxRecorder();
    paintSelection(ctx, p, grips, viewport, dark);
    const fillRectCalls = calls.filter((c) => c.method === 'fillRect');
    const strokeRectCalls = calls.filter((c) => c.method === 'strokeRect');
    expect(fillRectCalls).toHaveLength(2);
    expect(strokeRectCalls).toHaveLength(2);
  });

  it('grip squares use canvas.handle_move + reset transform to identity (screen-space, I-DTP-14)', () => {
    const p = line();
    const grips = gripsOf(p);
    const { ctx, calls } = makeCtxRecorder();
    paintSelection(ctx, p, grips, viewport, dark);
    const handleFill = calls.find(
      (c) => c.method === 'set:fillStyle' && c.args[0] === dark.canvas.handle_move,
    );
    expect(handleFill).toBeDefined();
    const setT = calls.filter((c) => c.method === 'setTransform').map((c) => c.args);
    expect(setT.some((args) => JSON.stringify(args) === JSON.stringify([1, 0, 0, 1, 0, 0]))).toBe(
      true,
    );
  });

  it('skips grips that belong to other entities', () => {
    const p1 = line();
    const p2 = line();
    const grips = [...gripsOf(p1), ...gripsOf(p2)]; // 4 grips, 2 per entity
    const { ctx, calls } = makeCtxRecorder();
    paintSelection(ctx, p1, grips, viewport, dark);
    const fillRects = calls.filter((c) => c.method === 'fillRect');
    expect(fillRects).toHaveLength(2);
  });

  it('does not call ctx.fillText (Gate DTP-T2)', () => {
    const p = line();
    const grips = gripsOf(p);
    const { ctx, calls } = makeCtxRecorder();
    paintSelection(ctx, p, grips, viewport, dark);
    expect(calls.find((c) => c.method === 'fillText')).toBeUndefined();
    expect(calls.find((c) => c.method === 'strokeText')).toBeUndefined();
  });
});
