// paintSnapGlyph tests for M1.3d Phase 3.
//
// Strategy: capture the canvas 2D context method calls in order via a
// proxy, then assert each glyph kind issues the expected sequence.
// This verifies (a) the glyph dispatches by kind, (b) the screen-space
// transform reset (I-DTP-6) happens before drawing, and (c) the
// snap-indicator color is read from canvas.snap_indicator (Phase 3
// step 1 directive).

import { dark } from '@portplanner/design-system';
import { describe, expect, it } from 'vitest';

import { paintSnapGlyph } from '../src/canvas/painters/paintSnapGlyph';
import type { Viewport } from '../src/canvas/view-transform';
import type { SnapHit } from '../src/snap/priority';

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
  strokeStyle?: unknown;
  fillStyle?: unknown;
  lineWidth?: unknown;
  lineCap?: unknown;
  lineJoin?: unknown;
}

function makeCtxRecorder(): { ctx: CanvasRenderingContext2D; calls: CtxCall[]; state: CtxState } {
  const calls: CtxCall[] = [];
  const state: CtxState = {};
  const handler: ProxyHandler<object> = {
    get(_target, prop) {
      const key = prop as string;
      if (key in state) return (state as Record<string, unknown>)[key];
      return (...args: unknown[]) => {
        calls.push({ method: key, args });
      };
    },
    set(_target, prop, value) {
      (state as Record<string, unknown>)[prop as string] = value;
      calls.push({ method: `set:${String(prop)}`, args: [value] });
      return true;
    },
  };
  const ctx = new Proxy({}, handler) as unknown as CanvasRenderingContext2D;
  return { ctx, calls, state };
}

const SNAP_KINDS_NON_GLYPH: SnapHit['kind'][] = ['cursor'];

describe('paintSnapGlyph — kind dispatch + screen-space transform (I-DTP-6)', () => {
  it("'cursor' (snap-engine no-match sentinel) is a no-op", () => {
    const { ctx, calls } = makeCtxRecorder();
    paintSnapGlyph(ctx, { kind: 'cursor', point: { x: 0, y: 0 } }, viewport, dark);
    expect(calls).toEqual([]);
  });

  for (const kind of [
    'endpoint',
    'midpoint',
    'intersection',
    'node',
    'grid-node',
    'grid-line',
  ] as const) {
    it(`'${kind}' resets the transform to identity before drawing (screen-space)`, () => {
      const { ctx, calls } = makeCtxRecorder();
      paintSnapGlyph(ctx, { kind, point: { x: 5, y: -3 } }, viewport, dark);

      // Find the setTransform call — it MUST appear and MUST be (1,0,0,1,0,0).
      const setT = calls.find((c) => c.method === 'setTransform');
      expect(setT, `${kind}: setTransform must be called to reset to identity`).toBeDefined();
      expect(setT?.args).toEqual([1, 0, 0, 1, 0, 0]);

      // save before, restore after — the painter takes its own snapshot.
      const firstSave = calls.findIndex((c) => c.method === 'save');
      const lastRestore = calls.map((c) => c.method).lastIndexOf('restore');
      expect(firstSave).toBeGreaterThanOrEqual(0);
      expect(lastRestore).toBeGreaterThan(firstSave);
    });

    it(`'${kind}' reads color from canvas.snap_indicator (Phase 3 step 1)`, () => {
      const { ctx, calls } = makeCtxRecorder();
      paintSnapGlyph(ctx, { kind, point: { x: 0, y: 0 } }, viewport, dark);
      const strokeSet = calls.find((c) => c.method === 'set:strokeStyle');
      expect(strokeSet?.args[0]).toBe(dark.canvas.snap_indicator);
    });
  }

  it("'endpoint' draws an OUTLINE-ONLY square (rect + stroke, no fill — Round 7 backlog B1, AC parity)", () => {
    const { ctx, calls } = makeCtxRecorder();
    paintSnapGlyph(ctx, { kind: 'endpoint', point: { x: 0, y: 0 } }, viewport, dark);
    const methods = calls.map((c) => c.method);
    expect(methods).toContain('rect');
    expect(methods).toContain('stroke');
    expect(methods).not.toContain('fill');
  });

  it("'midpoint' draws an OUTLINE-ONLY triangle (3 line segments closing back to start, no fill — Round 7 backlog B1, AC parity)", () => {
    const { ctx, calls } = makeCtxRecorder();
    paintSnapGlyph(ctx, { kind: 'midpoint', point: { x: 0, y: 0 } }, viewport, dark);
    const methods = calls.map((c) => c.method);
    expect(methods.filter((m) => m === 'lineTo')).toHaveLength(2);
    expect(methods).toContain('moveTo');
    expect(methods).toContain('closePath');
    expect(methods).toContain('stroke');
    expect(methods).not.toContain('fill');
  });

  it("'intersection' draws an X (two diagonal strokes — no fill)", () => {
    const { ctx, calls } = makeCtxRecorder();
    paintSnapGlyph(ctx, { kind: 'intersection', point: { x: 0, y: 0 } }, viewport, dark);
    const methods = calls.map((c) => c.method);
    expect(methods.filter((m) => m === 'moveTo')).toHaveLength(2);
    expect(methods.filter((m) => m === 'lineTo')).toHaveLength(2);
    expect(methods).toContain('stroke');
    expect(methods).not.toContain('fill');
  });

  it("'node' draws an OUTLINE-ONLY circle (arc with full sweep, no fill — Round 7 backlog B1, AC parity)", () => {
    const { ctx, calls } = makeCtxRecorder();
    paintSnapGlyph(ctx, { kind: 'node', point: { x: 0, y: 0 } }, viewport, dark);
    const arc = calls.find((c) => c.method === 'arc');
    expect(arc).toBeDefined();
    // arc(cx, cy, r, 0, 2π) — sweep is the full circle.
    expect(arc?.args[3]).toBe(0);
    expect(arc?.args[4]).toBeCloseTo(Math.PI * 2, 6);
    const methods = calls.map((c) => c.method);
    expect(methods).toContain('stroke');
    expect(methods).not.toContain('fill');
  });

  it("'grid-node' and 'grid-line' both draw a + with 2 moveTo + 2 lineTo (grid-line is smaller)", () => {
    const { ctx: ctxN, calls: callsN } = makeCtxRecorder();
    paintSnapGlyph(ctxN, { kind: 'grid-node', point: { x: 0, y: 0 } }, viewport, dark);
    const { ctx: ctxL, calls: callsL } = makeCtxRecorder();
    paintSnapGlyph(ctxL, { kind: 'grid-line', point: { x: 0, y: 0 } }, viewport, dark);
    for (const calls of [callsN, callsL]) {
      const methods = calls.map((c) => c.method);
      expect(methods.filter((m) => m === 'moveTo')).toHaveLength(2);
      expect(methods.filter((m) => m === 'lineTo')).toHaveLength(2);
      expect(methods).toContain('stroke');
    }

    // grid-line tick should be smaller. The horizontal segment of the +
    // is moveTo(cx-half, cy) → lineTo(cx+half, cy); pull the first
    // moveTo and compare its half-extent (cx - args[0]).
    const cxCanvas = viewport.canvasWidthCss / 2; // dpr=1
    const horizontalHalf = (calls: CtxCall[]): number => {
      const firstMoveTo = calls.find((c) => c.method === 'moveTo');
      const x = firstMoveTo?.args[0] as number;
      return Math.abs(cxCanvas - x);
    };
    expect(horizontalHalf(callsL)).toBeLessThan(horizontalHalf(callsN));
  });

  it('places the glyph at metricToScreen(point, viewport)', () => {
    // viewport: 800×600 CSS, zoom 10, pan (0,0). Metric (5, 0) →
    // screen (400 + 50, 300) = (450, 300). With dpr=1, device px is
    // the same. Use 'endpoint' which calls rect(cx-half, cy-half, ...).
    const { ctx, calls } = makeCtxRecorder();
    paintSnapGlyph(ctx, { kind: 'endpoint', point: { x: 5, y: 0 } }, viewport, dark);
    const rect = calls.find((c) => c.method === 'rect');
    expect(rect).toBeDefined();
    const [rx, ry, w, h] = rect!.args as [number, number, number, number];
    // Square is centered at (450, 300). half = 4. Top-left = (446, 296).
    expect(rx).toBe(446);
    expect(ry).toBe(296);
    expect(w).toBe(8);
    expect(h).toBe(8);
  });

  it('honours dpr by scaling glyph extents (I-DTP-6: visual size constant in CSS px)', () => {
    const v2: Viewport = { ...viewport, dpr: 2 };
    const { ctx, calls } = makeCtxRecorder();
    paintSnapGlyph(ctx, { kind: 'endpoint', point: { x: 0, y: 0 } }, v2, dark);
    const rect = calls.find((c) => c.method === 'rect');
    expect(rect).toBeDefined();
    // half = 4 CSS px × 2 dpr = 8 device px → 16-device-px square.
    const [, , w, h] = rect!.args as [number, number, number, number];
    expect(w).toBe(16);
    expect(h).toBe(16);
  });
});

// Pull SNAP_KINDS_NON_GLYPH into scope so a future regression on the
// 'cursor' no-op test references the canonical list.
void SNAP_KINDS_NON_GLYPH;
