// paintTransientLabel tests for M1.3d Phase 4.
//
// Verifies (a) screen-space transform reset, (b) tokens are read from
// canvas.transient.* (I-DTP-1), (c) text is rendered via fillText
// (paintTransientLabel is the SOLE source of transient text per
// I-DTP-8 / Gate DTP-T2).

import { dark } from '@portplanner/design-system';
import { describe, expect, it } from 'vitest';

import { paintTransientLabel } from '../src/canvas/painters/paintTransientLabel';
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

interface CtxState {
  font?: unknown;
  fillStyle?: unknown;
  strokeStyle?: unknown;
  textBaseline?: unknown;
  textAlign?: unknown;
}

function makeCtxRecorder(): { ctx: CanvasRenderingContext2D; calls: CtxCall[]; state: CtxState } {
  const calls: CtxCall[] = [];
  const state: CtxState = {};
  const handler: ProxyHandler<object> = {
    get(_t, prop) {
      const k = prop as string;
      if (k === 'measureText') {
        return (text: string) => ({ width: text.length * 7 }) as TextMetrics;
      }
      if (k in state) return (state as Record<string, unknown>)[k];
      return (...args: unknown[]) => {
        calls.push({ method: k, args });
      };
    },
    set(_t, prop, value) {
      (state as Record<string, unknown>)[prop as string] = value;
      calls.push({ method: `set:${String(prop)}`, args: [value] });
      return true;
    },
  };
  const ctx = new Proxy({}, handler) as unknown as CanvasRenderingContext2D;
  return { ctx, calls, state };
}

describe('paintTransientLabel — screen-space + transient.* tokens (I-DTP-8)', () => {
  it('resets transform to identity before drawing (screen-space)', () => {
    const { ctx, calls } = makeCtxRecorder();
    paintTransientLabel(ctx, { metric: { x: 0, y: 0 } }, 'hello', viewport, dark);
    const setT = calls.find((c) => c.method === 'setTransform');
    expect(setT?.args).toEqual([1, 0, 0, 1, 0, 0]);
  });

  it('reads label_text and label_bg from canvas.transient', () => {
    const { ctx, calls } = makeCtxRecorder();
    paintTransientLabel(ctx, { metric: { x: 0, y: 0 } }, 'hi', viewport, dark);
    const fills = calls.filter((c) => c.method === 'set:fillStyle').map((c) => c.args[0]);
    expect(fills).toContain(dark.canvas.transient.label_bg);
    expect(fills).toContain(dark.canvas.transient.label_text);
  });

  it('draws via fillText (the sole sanctioned text path under Gate DTP-T2)', () => {
    const { ctx, calls } = makeCtxRecorder();
    paintTransientLabel(ctx, { metric: { x: 5, y: 5 } }, '12.345 m', viewport, dark);
    const ftCalls = calls.filter((c) => c.method === 'fillText');
    expect(ftCalls).toHaveLength(1);
    expect(ftCalls[0]?.args[0]).toBe('12.345 m');
  });

  it('skips emitting fillText for an empty string', () => {
    const { ctx, calls } = makeCtxRecorder();
    paintTransientLabel(ctx, { metric: { x: 0, y: 0 } }, '', viewport, dark);
    const ftCalls = calls.filter((c) => c.method === 'fillText');
    expect(ftCalls).toHaveLength(0);
  });

  it('honors screenOffset by translating to the anchor in screen px', () => {
    const { ctx, calls } = makeCtxRecorder();
    paintTransientLabel(
      ctx,
      { metric: { x: 5, y: 0 }, screenOffset: { dx: 8, dy: -8 } },
      'X',
      viewport,
      dark,
    );
    const ftCalls = calls.filter((c) => c.method === 'fillText');
    expect(ftCalls).toHaveLength(1);
    // R6 — paint flow now translates to the anchor first, then renders
    // the pill + text at the local origin. The fillText call is at
    // local x = padding (3 px in the new token), local y = 0. The
    // translate call carries the screen-space offset.
    expect(ftCalls[0]?.args[1]).toBe(3); // bgX (0) + padding (3)
    expect(ftCalls[0]?.args[2]).toBe(0);
    const translate = calls.find((c) => c.method === 'translate');
    expect(translate?.args[0]).toBe(458); // screen.x (450) + dx (8)
    expect(translate?.args[1]).toBe(292); // screen.y (300) + dy (-8)
  });

  // M1.3d-Remediation-2 R6 — angleRad rotation tests.

  it('R6: rotates the label by angleRad around its anchor (translate then rotate)', () => {
    const { ctx, calls } = makeCtxRecorder();
    paintTransientLabel(
      ctx,
      { metric: { x: 0, y: 0 } },
      'L',
      viewport,
      dark,
      { angleRad: Math.PI / 4 }, // 45° — in (-π/2, π/2], no flip
    );
    const translate = calls.find((c) => c.method === 'translate');
    const rotate = calls.find((c) => c.method === 'rotate');
    expect(translate).toBeDefined();
    expect(rotate).toBeDefined();
    expect(rotate?.args[0]).toBeCloseTo(Math.PI / 4, 9);
  });

  it('R6: flips upside-down angles 180° to keep text left-to-right (angle in lower half)', () => {
    const { ctx, calls } = makeCtxRecorder();
    paintTransientLabel(
      ctx,
      { metric: { x: 0, y: 0 } },
      'L',
      viewport,
      dark,
      { angleRad: (3 * Math.PI) / 4 }, // 135° — would be upside-down
    );
    const rotate = calls.find((c) => c.method === 'rotate');
    expect(rotate).toBeDefined();
    // Folded into (-π/2, π/2]: 135° - 180° = -45° → -π/4.
    expect(rotate?.args[0]).toBeCloseTo(-Math.PI / 4, 9);
  });

  it('R6: skips rotation when angleRad is unset (back-compat)', () => {
    const { ctx, calls } = makeCtxRecorder();
    paintTransientLabel(ctx, { metric: { x: 0, y: 0 } }, 'L', viewport, dark);
    const rotate = calls.find((c) => c.method === 'rotate');
    expect(rotate).toBeUndefined();
  });
});
