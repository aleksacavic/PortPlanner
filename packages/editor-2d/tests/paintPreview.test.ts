// @vitest-environment jsdom
// paintPreview tests for M1.3d Phase 4.
//
// Verifies that each PreviewShape arm dispatches the correct path
// commands and that the painter does NOT import projectStore (Gate
// DTP-T6 / I-DTP-9).

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dark } from '@portplanner/design-system';
import { LayerId, newPrimitiveId } from '@portplanner/domain';
import { describe, expect, it } from 'vitest';

import { paintPreview } from '../src/canvas/painters/paintPreview';
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
  fillStyle?: unknown;
  strokeStyle?: unknown;
  lineWidth?: unknown;
  font?: unknown;
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
  return { ctx: new Proxy({}, handler) as unknown as CanvasRenderingContext2D, calls, state };
}

describe('paintPreview — kind dispatch (line / polyline / rectangle / circle / arc / xline)', () => {
  it('line: moveTo + lineTo + stroke (Round 7 backlog B3 — embedded length label removed; DI pills carry the readout)', () => {
    const { ctx, calls } = makeCtxRecorder();
    paintPreview(ctx, { kind: 'line', p1: { x: 0, y: 0 }, cursor: { x: 3, y: 4 } }, viewport, dark);
    const methods = calls.map((c) => c.method);
    expect(methods).toContain('moveTo');
    expect(methods).toContain('lineTo');
    expect(methods).toContain('stroke');
    expect(methods).not.toContain('fillText');
  });

  it('polyline: traces every existing segment + rubber-band to cursor', () => {
    const { ctx, calls } = makeCtxRecorder();
    paintPreview(
      ctx,
      {
        kind: 'polyline',
        vertices: [
          { x: 0, y: 0 },
          { x: 5, y: 0 },
        ],
        cursor: { x: 5, y: 5 },
        closed: false,
      },
      viewport,
      dark,
    );
    const methods = calls.map((c) => c.method);
    // 1 moveTo to first vertex, 2 lineTo (one to second vertex, one to cursor)
    // — plus moveTo/arc/lineTo from the embedded transient label's
    // rounded-pill background. Filter to the FIRST stroke pass only.
    const firstStrokeIdx = methods.indexOf('stroke');
    const beforeFirstStroke = methods.slice(0, firstStrokeIdx);
    expect(beforeFirstStroke.filter((m) => m === 'moveTo')).toHaveLength(1);
    expect(beforeFirstStroke.filter((m) => m === 'lineTo')).toHaveLength(2);
  });

  it('polyline closed=true closes the path before stroking', () => {
    const { ctx, calls } = makeCtxRecorder();
    paintPreview(
      ctx,
      {
        kind: 'polyline',
        vertices: [
          { x: 0, y: 0 },
          { x: 5, y: 0 },
          { x: 5, y: 5 },
        ],
        cursor: { x: 0, y: 5 },
        closed: true,
      },
      viewport,
      dark,
    );
    const closeIdx = calls.findIndex((c) => c.method === 'closePath');
    const firstStrokeIdx = calls.findIndex((c) => c.method === 'stroke');
    expect(closeIdx).toBeGreaterThanOrEqual(0);
    expect(closeIdx).toBeLessThan(firstStrokeIdx);
  });

  it('rectangle: rect + stroke (Round 7 backlog B3 — embedded W×H label removed)', () => {
    const { ctx, calls } = makeCtxRecorder();
    paintPreview(
      ctx,
      { kind: 'rectangle', corner1: { x: 0, y: 0 }, cursor: { x: 4, y: 3 } },
      viewport,
      dark,
    );
    const rect = calls.find((c) => c.method === 'rect');
    expect(rect?.args).toEqual([0, 0, 4, 3]);
    const methods = calls.map((c) => c.method);
    expect(methods).not.toContain('fillText');
  });

  it('circle: full-arc + radius line (Round 7 backlog B3 — embedded R label removed)', () => {
    const { ctx, calls } = makeCtxRecorder();
    paintPreview(
      ctx,
      { kind: 'circle', center: { x: 0, y: 0 }, cursor: { x: 5, y: 0 } },
      viewport,
      dark,
    );
    const arc = calls.find((c) => c.method === 'arc');
    expect(arc?.args[2]).toBeCloseTo(5, 6);
    expect(arc?.args[3]).toBe(0);
    expect(arc?.args[4]).toBeCloseTo(Math.PI * 2, 6);
    const methods = calls.map((c) => c.method);
    expect(methods).not.toContain('fillText');
  });

  it('arc-2pt: first leg only (no arc shape yet) (Round 7 backlog B3 — embedded length label removed)', () => {
    const { ctx, calls } = makeCtxRecorder();
    paintPreview(
      ctx,
      { kind: 'arc-2pt', p1: { x: 0, y: 0 }, cursor: { x: 3, y: 4 } },
      viewport,
      dark,
    );
    const methods = calls.map((c) => c.method);
    expect(methods).toContain('moveTo');
    expect(methods).toContain('lineTo');
    expect(methods).toContain('stroke');
    expect(methods).not.toContain('arc');
    expect(methods).not.toContain('fillText');
  });

  it('arc-3pt: emits arc() through the three points + R label (when not collinear)', () => {
    const { ctx, calls } = makeCtxRecorder();
    paintPreview(
      ctx,
      {
        kind: 'arc-3pt',
        p1: { x: 0, y: 0 },
        p2: { x: 5, y: 5 },
        cursor: { x: 10, y: 0 },
      },
      viewport,
      dark,
    );
    // Look for an arc call where the radius (3rd arg) is the
    // circumcircle radius. With these points, center = (5, 0), r = 5.
    const arcs = calls.filter((c) => c.method === 'arc');
    expect(arcs.length).toBeGreaterThanOrEqual(1);
    const drawingArc = arcs.find((c) => Math.abs((c.args[2] as number) - 5) < 1e-6);
    expect(drawingArc).toBeDefined();
    // Round 7 backlog B3 — embedded R label removed.
    const methods = calls.map((c) => c.method);
    expect(methods).not.toContain('fillText');
  });

  it('xline: extends far past the visible canvas (one moveTo + one lineTo, both far from pivot)', () => {
    const { ctx, calls } = makeCtxRecorder();
    paintPreview(
      ctx,
      { kind: 'xline', pivot: { x: 0, y: 0 }, cursor: { x: 1, y: 0 } },
      viewport,
      dark,
    );
    const moveTo = calls.find((c) => c.method === 'moveTo');
    const lineTo = calls.find((c) => c.method === 'lineTo');
    expect(moveTo).toBeDefined();
    expect(lineTo).toBeDefined();
    // The two endpoints are far past the visible viewport (extent
    // multiplied by 4). Either |x1| or |x2| should easily exceed 100.
    const x1 = Math.abs(moveTo!.args[0] as number);
    const x2 = Math.abs(lineTo!.args[0] as number);
    expect(Math.max(x1, x2)).toBeGreaterThan(100);
  });

  it('selection-rect arm is a no-op (paintSelectionRect handles it in Phase 7)', () => {
    const { ctx, calls } = makeCtxRecorder();
    paintPreview(
      ctx,
      {
        kind: 'selection-rect',
        start: { x: 0, y: 0 },
        end: { x: 10, y: 10 },
        direction: 'window',
      },
      viewport,
      dark,
    );
    expect(calls).toEqual([]);
  });
});

// M1.3d-Remediation-3 F4 — modified-entities arm. Per-kind sub-tests
// because each Primitive kind dispatches to its own ctx primitive set.
// Lesson from Rem-2 wire-intersect: count `case` branches in the
// implementation switch (point/line/polyline/rectangle/circle/arc/xline
// = 7) and ensure each has an `it()`.
describe('paintPreview — modified-entities arm (F4)', () => {
  const layerId = LayerId.DEFAULT;

  it('line: stroked at the offset position (moveTo + lineTo + stroke)', () => {
    const { ctx, calls } = makeCtxRecorder();
    paintPreview(
      ctx,
      {
        kind: 'modified-entities',
        primitives: [
          {
            id: newPrimitiveId(),
            kind: 'line',
            layerId,
            displayOverrides: {},
            p1: { x: 0, y: 0 },
            p2: { x: 5, y: 0 },
          },
        ],
        offsetMetric: { x: 10, y: 20 },
      },
      viewport,
      dark,
    );
    const moveTo = calls.find((c) => c.method === 'moveTo');
    const lineTo = calls.find((c) => c.method === 'lineTo');
    expect(moveTo?.args).toEqual([10, 20]);
    expect(lineTo?.args).toEqual([15, 20]);
    expect(calls.some((c) => c.method === 'stroke')).toBe(true);
  });

  it('polyline closed: rect-like outline + closePath', () => {
    const { ctx, calls } = makeCtxRecorder();
    paintPreview(
      ctx,
      {
        kind: 'modified-entities',
        primitives: [
          {
            id: newPrimitiveId(),
            kind: 'polyline',
            layerId,
            displayOverrides: {},
            vertices: [
              { x: 0, y: 0 },
              { x: 5, y: 0 },
              { x: 5, y: 3 },
            ],
            bulges: [0, 0, 0],
            closed: true,
          },
        ],
        offsetMetric: { x: 1, y: 1 },
      },
      viewport,
      dark,
    );
    expect(calls.find((c) => c.method === 'moveTo')?.args).toEqual([1, 1]);
    const lineTos = calls.filter((c) => c.method === 'lineTo');
    expect(lineTos.length).toBeGreaterThanOrEqual(2);
    expect(calls.some((c) => c.method === 'closePath')).toBe(true);
  });

  it('rectangle: 4-corner walk at offset origin (axis-aligned case)', () => {
    const { ctx, calls } = makeCtxRecorder();
    paintPreview(
      ctx,
      {
        kind: 'modified-entities',
        primitives: [
          {
            id: newPrimitiveId(),
            kind: 'rectangle',
            layerId,
            displayOverrides: {},
            origin: { x: 0, y: 0 },
            width: 8,
            height: 4,
            localAxisAngle: 0,
          },
        ],
        offsetMetric: { x: 10, y: 5 },
      },
      viewport,
      dark,
    );
    const moveTos = calls.filter((c) => c.method === 'moveTo');
    const lineTos = calls.filter((c) => c.method === 'lineTo');
    expect(moveTos[0]?.args).toEqual([10, 5]);
    // Walks SW → SE → NE → NW for an axis-aligned rect (cos=1, sin=0).
    expect(lineTos[0]?.args).toEqual([18, 5]);
    expect(lineTos[1]?.args).toEqual([18, 9]);
    expect(lineTos[2]?.args).toEqual([10, 9]);
    expect(calls.some((c) => c.method === 'closePath')).toBe(true);
  });

  it('rectangle: localAxisAngle=π/2 walks the rotated frame (preview painter respects rotation)', () => {
    const { ctx, calls } = makeCtxRecorder();
    paintPreview(
      ctx,
      {
        kind: 'modified-entities',
        primitives: [
          {
            id: newPrimitiveId(),
            kind: 'rectangle',
            layerId,
            displayOverrides: {},
            origin: { x: 0, y: 0 },
            width: 10,
            height: 4,
            localAxisAngle: Math.PI / 2,
          },
        ],
        offsetMetric: { x: 0, y: 0 },
      },
      viewport,
      dark,
    );
    const moveTos = calls.filter((c) => c.method === 'moveTo');
    const lineTos = calls.filter((c) => c.method === 'lineTo');
    // SW=(0,0); SE rotated 90°CCW → (0, 10); NE → (-4, 10); NW → (-4, 0).
    expect(moveTos[0]?.args[0]).toBeCloseTo(0, 6);
    expect(moveTos[0]?.args[1]).toBeCloseTo(0, 6);
    expect(lineTos[0]?.args[0]).toBeCloseTo(0, 6);
    expect(lineTos[0]?.args[1]).toBeCloseTo(10, 6);
    expect(lineTos[1]?.args[0]).toBeCloseTo(-4, 6);
    expect(lineTos[1]?.args[1]).toBeCloseTo(10, 6);
    expect(lineTos[2]?.args[0]).toBeCloseTo(-4, 6);
    expect(lineTos[2]?.args[1]).toBeCloseTo(0, 6);
  });

  it('circle: ctx.arc full sweep at offset center, original radius', () => {
    const { ctx, calls } = makeCtxRecorder();
    paintPreview(
      ctx,
      {
        kind: 'modified-entities',
        primitives: [
          {
            id: newPrimitiveId(),
            kind: 'circle',
            layerId,
            displayOverrides: {},
            center: { x: 0, y: 0 },
            radius: 7,
          },
        ],
        offsetMetric: { x: 3, y: -2 },
      },
      viewport,
      dark,
    );
    const arc = calls.find((c) => c.method === 'arc');
    expect(arc?.args[0]).toBe(3);
    expect(arc?.args[1]).toBe(-2);
    expect(arc?.args[2]).toBe(7);
    expect(arc?.args[3]).toBe(0);
    expect(arc?.args[4]).toBeCloseTo(Math.PI * 2, 9);
  });

  it('arc: ctx.arc at offset center with original startAngle/endAngle', () => {
    const { ctx, calls } = makeCtxRecorder();
    paintPreview(
      ctx,
      {
        kind: 'modified-entities',
        primitives: [
          {
            id: newPrimitiveId(),
            kind: 'arc',
            layerId,
            displayOverrides: {},
            center: { x: 0, y: 0 },
            radius: 5,
            startAngle: 0,
            endAngle: Math.PI / 2,
          },
        ],
        offsetMetric: { x: 1, y: 1 },
      },
      viewport,
      dark,
    );
    const arc = calls.find((c) => c.method === 'arc');
    expect(arc?.args[0]).toBe(1);
    expect(arc?.args[1]).toBe(1);
    expect(arc?.args[2]).toBe(5);
    expect(arc?.args[3]).toBe(0);
    expect(arc?.args[4]).toBeCloseTo(Math.PI / 2, 9);
  });

  it('xline: long segment through the offset pivot in its angle', () => {
    const { ctx, calls } = makeCtxRecorder();
    paintPreview(
      ctx,
      {
        kind: 'modified-entities',
        primitives: [
          {
            id: newPrimitiveId(),
            kind: 'xline',
            layerId,
            displayOverrides: {},
            pivot: { x: 0, y: 0 },
            angle: 0,
          },
        ],
        offsetMetric: { x: 5, y: 5 },
      },
      viewport,
      dark,
    );
    const moveTo = calls.find((c) => c.method === 'moveTo');
    const lineTo = calls.find((c) => c.method === 'lineTo');
    expect(moveTo).toBeDefined();
    expect(lineTo).toBeDefined();
    // Far-extent endpoints (1e6 in helper) — magnitude well above 100.
    expect(Math.abs(moveTo!.args[0] as number)).toBeGreaterThan(1e5);
    expect(Math.abs(lineTo!.args[0] as number)).toBeGreaterThan(1e5);
  });

  it('point: degenerate — emits a stroke at the offset position', () => {
    const { ctx, calls } = makeCtxRecorder();
    paintPreview(
      ctx,
      {
        kind: 'modified-entities',
        primitives: [
          {
            id: newPrimitiveId(),
            kind: 'point',
            layerId,
            displayOverrides: {},
            position: { x: 0, y: 0 },
          },
        ],
        offsetMetric: { x: 7, y: 8 },
      },
      viewport,
      dark,
    );
    const moveTo = calls.find((c) => c.method === 'moveTo');
    expect(moveTo?.args).toEqual([7, 8]);
    expect(calls.some((c) => c.method === 'stroke')).toBe(true);
  });

  it('multiple primitives: each gets its own draw pass at the same offset', () => {
    const { ctx, calls } = makeCtxRecorder();
    paintPreview(
      ctx,
      {
        kind: 'modified-entities',
        primitives: [
          {
            id: newPrimitiveId(),
            kind: 'line',
            layerId,
            displayOverrides: {},
            p1: { x: 0, y: 0 },
            p2: { x: 1, y: 0 },
          },
          {
            id: newPrimitiveId(),
            kind: 'circle',
            layerId,
            displayOverrides: {},
            center: { x: 0, y: 0 },
            radius: 1,
          },
        ],
        offsetMetric: { x: 10, y: 0 },
      },
      viewport,
      dark,
    );
    // Two strokes — one per primitive.
    expect(calls.filter((c) => c.method === 'stroke').length).toBeGreaterThanOrEqual(2);
  });
});

// M1.3b simple-transforms Phase 1 — 4 new PreviewShape arms.
// Per plan §3.0 walkthrough rows: each arm produces the visibly-correct
// transformed geometry via drawPrimitiveOutline.
describe('paintPreview — M1.3b transform arms', () => {
  const layerId = LayerId.DEFAULT;

  it('rotated-entities arm: line rotated 90° about origin → swaps x/y', () => {
    const { ctx, calls } = makeCtxRecorder();
    paintPreview(
      ctx,
      {
        kind: 'rotated-entities',
        primitives: [
          {
            id: newPrimitiveId(),
            kind: 'line',
            layerId,
            displayOverrides: {},
            p1: { x: 0, y: 0 },
            p2: { x: 10, y: 0 },
          },
        ],
        base: { x: 0, y: 0 },
        angleRad: Math.PI / 2,
      },
      viewport,
      dark,
    );
    const moveTo = calls.find((c) => c.method === 'moveTo');
    const lineTo = calls.find((c) => c.method === 'lineTo');
    expect(moveTo!.args[0]).toBeCloseTo(0, 6);
    expect(moveTo!.args[1]).toBeCloseTo(0, 6);
    expect(lineTo!.args[0]).toBeCloseTo(0, 6);
    expect(lineTo!.args[1]).toBeCloseTo(10, 6);
    expect(calls.some((c) => c.method === 'stroke')).toBe(true);
  });

  it('scaled-entities arm: circle radius × factor at base', () => {
    const { ctx, calls } = makeCtxRecorder();
    paintPreview(
      ctx,
      {
        kind: 'scaled-entities',
        primitives: [
          {
            id: newPrimitiveId(),
            kind: 'circle',
            layerId,
            displayOverrides: {},
            center: { x: 0, y: 0 },
            radius: 5,
          },
        ],
        base: { x: 0, y: 0 },
        factor: 2,
      },
      viewport,
      dark,
    );
    const arc = calls.find((c) => c.method === 'arc');
    expect(arc!.args[2]).toBeCloseTo(10, 6);
  });

  it('mirrored-entities arm: line reflected across x-axis flips y', () => {
    const { ctx, calls } = makeCtxRecorder();
    paintPreview(
      ctx,
      {
        kind: 'mirrored-entities',
        primitives: [
          {
            id: newPrimitiveId(),
            kind: 'line',
            layerId,
            displayOverrides: {},
            p1: { x: 0, y: 5 },
            p2: { x: 10, y: 5 },
          },
        ],
        line: { p1: { x: 0, y: 0 }, p2: { x: 1, y: 0 } },
      },
      viewport,
      dark,
    );
    const moveTo = calls.find((c) => c.method === 'moveTo');
    const lineTo = calls.find((c) => c.method === 'lineTo');
    expect(moveTo!.args[1]).toBeCloseTo(-5, 6);
    expect(lineTo!.args[1]).toBeCloseTo(-5, 6);
  });

  it('offset-preview arm: line offset by +distance perpendicular', () => {
    const { ctx, calls } = makeCtxRecorder();
    paintPreview(
      ctx,
      {
        kind: 'offset-preview',
        primitive: {
          id: newPrimitiveId(),
          kind: 'line',
          layerId,
          displayOverrides: {},
          p1: { x: 0, y: 0 },
          p2: { x: 10, y: 0 },
        },
        distance: 3,
        side: 1,
      },
      viewport,
      dark,
    );
    const moveTo = calls.find((c) => c.method === 'moveTo');
    const lineTo = calls.find((c) => c.method === 'lineTo');
    expect(moveTo!.args[1]).toBeCloseTo(3, 6);
    expect(lineTo!.args[1]).toBeCloseTo(3, 6);
  });
});

describe('paintPreview — Gate DTP-T6 source-import isolation (I-DTP-9)', () => {
  it('paintPreview.ts does NOT import @portplanner/project-store', () => {
    // Resolve the source path relative to this test file so the assertion
    // works regardless of the cwd vitest is invoked from (package vs
    // repo root vs CI shells).
    const here = dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(
      resolve(here, '..', 'src', 'canvas', 'painters', 'paintPreview.ts'),
      'utf8',
    );
    expect(src).not.toMatch(/from\s+['"]@portplanner\/project-store['"]/);
  });
});

// Round 7 backlog B3 — paintPreview no longer renders embedded
// transient labels (paintTransientLabel was wiped wholesale). The
// per-arm angleRad rotation assertions are obsolete and removed; DI
// pills (DOM chrome) carry the readouts on top of dimensionGuides.
