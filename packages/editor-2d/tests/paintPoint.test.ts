// M1.3 snap-engine-extension Phase 3 — paintPoint switches on
// PointPrimitive.displayShape. Three branches:
//   'dot'        — single arc + fill (legacy default).
//   'x'          — two diagonal stroke lines (4 lineTo + 2 moveTo + stroke).
//   'circle-dot' — outline arc + filled centre dot.

import { LayerId, type PointPrimitive, newPrimitiveId } from '@portplanner/domain';
import { describe, expect, it } from 'vitest';

import { paintPoint } from '../src/canvas/painters/paintPoint';
import type { EffectiveStyle } from '../src/canvas/style';

const STYLE: EffectiveStyle = {
  color: '#ffffff',
  lineType: 'continuous',
  lineWeight: 0.18,
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

function makePoint(displayShape: PointPrimitive['displayShape']): PointPrimitive {
  return {
    id: newPrimitiveId(),
    kind: 'point',
    layerId: LayerId.DEFAULT,
    displayOverrides: {} as never,
    position: { x: 0, y: 0 },
    displayShape,
  };
}

describe('paintPoint — displayShape switch (Phase 3)', () => {
  it("'dot' shape: 1 arc + fill, no stroke, no extra primitives", () => {
    const point = makePoint('dot');
    const { ctx, calls } = makeCtxRecorder();
    paintPoint(ctx, point, STYLE, 10);
    const methods = calls.map((c) => c.method);
    expect(methods.filter((m) => m === 'arc')).toHaveLength(1);
    expect(methods).toContain('fill');
    expect(methods).not.toContain('stroke');
    expect(methods).not.toContain('moveTo');
  });

  it("'x' shape: 2 moveTo + 2 lineTo + 1 stroke, no fill, no arc", () => {
    const point = makePoint('x');
    const { ctx, calls } = makeCtxRecorder();
    paintPoint(ctx, point, STYLE, 10);
    const methods = calls.map((c) => c.method);
    expect(methods.filter((m) => m === 'moveTo')).toHaveLength(2);
    expect(methods.filter((m) => m === 'lineTo')).toHaveLength(2);
    expect(methods).toContain('stroke');
    expect(methods).not.toContain('fill');
    expect(methods).not.toContain('arc');
  });

  it("'circle-dot' shape: 2 arcs (outline + centre) + 1 stroke + 1 fill", () => {
    const point = makePoint('circle-dot');
    const { ctx, calls } = makeCtxRecorder();
    paintPoint(ctx, point, STYLE, 10);
    const methods = calls.map((c) => c.method);
    expect(methods.filter((m) => m === 'arc')).toHaveLength(2);
    expect(methods).toContain('stroke');
    expect(methods).toContain('fill');
  });

  it("missing displayShape defaults to 'circle-dot' (defence-in-depth)", () => {
    // Schema parse normally fills the default, but the painter also
    // defends in case a runtime mutator skips the field.
    const point: PointPrimitive = {
      id: newPrimitiveId(),
      kind: 'point',
      layerId: LayerId.DEFAULT,
      displayOverrides: {} as never,
      position: { x: 0, y: 0 },
      // displayShape intentionally omitted.
    };
    const { ctx, calls } = makeCtxRecorder();
    paintPoint(ctx, point, STYLE, 10);
    const methods = calls.map((c) => c.method);
    // circle-dot signature: 2 arcs + stroke + fill.
    expect(methods.filter((m) => m === 'arc')).toHaveLength(2);
    expect(methods).toContain('stroke');
    expect(methods).toContain('fill');
  });
});
