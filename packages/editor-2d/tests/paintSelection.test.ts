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

  // M1.3d-Remediation-2 R7 — hovered-grip differential rendering.

  it('R7: hovered grip paints amber + 9×9, others stay blue + 7×7', () => {
    const p = line(); // 2 grips: p1 + p2
    const grips = gripsOf(p);
    const hoveredGripKey = { entityId: p.id, gripKind: 'p1' };
    const { ctx, calls } = makeCtxRecorder();
    paintSelection(ctx, p, grips, viewport, dark, hoveredGripKey);
    const fillRects = calls.filter((c) => c.method === 'fillRect');
    expect(fillRects).toHaveLength(2);
    // Find the hovered (p1) and non-hovered (p2) fillRect calls.
    // p1 is at (0, 0) → screen (400, 300); 9×9 means half = 4.5 → top-left
    // (395.5, 295.5), w/h = 9.
    const hoveredFR = fillRects.find((c) => (c.args[2] as number) === 9);
    expect(hoveredFR).toBeDefined();
    // p2 is at (10, 0) → screen (500, 300); 7×7 → top-left (496.5, 296.5),
    // w/h = 7.
    const defaultFR = fillRects.find((c) => (c.args[2] as number) === 7);
    expect(defaultFR).toBeDefined();
    // Verify fill colors: hovered uses canvas.handle_rotate (amber);
    // default uses canvas.handle_move (blue).
    const fillSetCalls = calls.filter((c) => c.method === 'set:fillStyle');
    const colors = fillSetCalls.map((c) => c.args[0]);
    expect(colors).toContain(dark.canvas.handle_rotate);
    expect(colors).toContain(dark.canvas.handle_move);
  });

  it('R7: when hoveredGripKey is null, all grips paint default (blue + 7×7)', () => {
    const p = line();
    const grips = gripsOf(p);
    const { ctx, calls } = makeCtxRecorder();
    paintSelection(ctx, p, grips, viewport, dark, null);
    const fillRects = calls.filter((c) => c.method === 'fillRect');
    expect(fillRects).toHaveLength(2);
    // Both grips should have w/h = 7 (default).
    expect(fillRects.every((c) => (c.args[2] as number) === 7)).toBe(true);
    // No amber fillStyle should be set.
    const fillSetCalls = calls.filter((c) => c.method === 'set:fillStyle');
    const colors = fillSetCalls.map((c) => c.args[0]);
    expect(colors).not.toContain(dark.canvas.handle_rotate);
  });

  it('R7: hoveredGripKey for a different entityId does not affect rendering', () => {
    const p1 = line();
    const grips = gripsOf(p1);
    const hoveredGripKey = { entityId: 'some-other-id' as never, gripKind: 'p1' };
    const { ctx, calls } = makeCtxRecorder();
    paintSelection(ctx, p1, grips, viewport, dark, hoveredGripKey);
    const fillRects = calls.filter((c) => c.method === 'fillRect');
    // Both grips paint as default (none hovered, since entityId mismatches).
    expect(fillRects.every((c) => (c.args[2] as number) === 7)).toBe(true);
  });
});
