// paintSelectionRect tests for M1.3d Phase 7.

import { dark } from '@portplanner/design-system';
import { describe, expect, it } from 'vitest';

import { paintSelectionRect } from '../src/canvas/painters/paintSelectionRect';
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

describe('paintSelectionRect — window vs crossing styling (I-DTP-15)', () => {
  it("'window' direction uses canvas.transient.selection_window styling", () => {
    const { ctx, calls } = makeCtxRecorder();
    paintSelectionRect(
      ctx,
      {
        kind: 'selection-rect',
        start: { x: 0, y: 0 },
        end: { x: 5, y: 5 },
        direction: 'window',
      },
      viewport,
      dark,
    );
    const fills = calls.filter((c) => c.method === 'set:fillStyle').map((c) => c.args[0]);
    const strokes = calls.filter((c) => c.method === 'set:strokeStyle').map((c) => c.args[0]);
    expect(fills).toContain(dark.canvas.transient.selection_window.fill);
    expect(strokes).toContain(dark.canvas.transient.selection_window.stroke);
  });

  it("'crossing' direction uses canvas.transient.selection_crossing styling", () => {
    const { ctx, calls } = makeCtxRecorder();
    paintSelectionRect(
      ctx,
      {
        kind: 'selection-rect',
        start: { x: 5, y: 5 },
        end: { x: 0, y: 0 },
        direction: 'crossing',
      },
      viewport,
      dark,
    );
    const fills = calls.filter((c) => c.method === 'set:fillStyle').map((c) => c.args[0]);
    const strokes = calls.filter((c) => c.method === 'set:strokeStyle').map((c) => c.args[0]);
    expect(fills).toContain(dark.canvas.transient.selection_crossing.fill);
    expect(strokes).toContain(dark.canvas.transient.selection_crossing.stroke);
  });

  it('renders fillRect + strokeRect with positive width/height (start/end agnostic)', () => {
    const { ctx, calls } = makeCtxRecorder();
    paintSelectionRect(
      ctx,
      {
        kind: 'selection-rect',
        start: { x: 5, y: 5 },
        end: { x: 0, y: 0 },
        direction: 'crossing',
      },
      viewport,
      dark,
    );
    const fillRect = calls.find((c) => c.method === 'fillRect');
    const strokeRect = calls.find((c) => c.method === 'strokeRect');
    expect(fillRect).toBeDefined();
    expect(strokeRect).toBeDefined();
    const [, , w, h] = fillRect!.args as [number, number, number, number];
    expect(w).toBeGreaterThan(0);
    expect(h).toBeGreaterThan(0);
  });

  it('does not call ctx.fillText (Gate DTP-T2)', () => {
    const { ctx, calls } = makeCtxRecorder();
    paintSelectionRect(
      ctx,
      {
        kind: 'selection-rect',
        start: { x: 0, y: 0 },
        end: { x: 5, y: 5 },
        direction: 'window',
      },
      viewport,
      dark,
    );
    expect(calls.find((c) => c.method === 'fillText')).toBeUndefined();
    expect(calls.find((c) => c.method === 'strokeText')).toBeUndefined();
  });
});
