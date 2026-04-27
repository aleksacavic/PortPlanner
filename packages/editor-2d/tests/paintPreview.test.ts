// paintPreview tests for M1.3d Phase 4.
//
// Verifies that each PreviewShape arm dispatches the correct path
// commands and that the painter does NOT import projectStore (Gate
// DTP-T6 / I-DTP-9).

import { readFileSync } from 'node:fs';
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
  it('line: moveTo + lineTo + stroke + embedded length label', () => {
    const { ctx, calls } = makeCtxRecorder();
    paintPreview(ctx, { kind: 'line', p1: { x: 0, y: 0 }, cursor: { x: 3, y: 4 } }, viewport, dark);
    const methods = calls.map((c) => c.method);
    expect(methods).toContain('moveTo');
    expect(methods).toContain('lineTo');
    expect(methods).toContain('stroke');
    const fillText = calls.find((c) => c.method === 'fillText');
    expect(fillText?.args[0]).toBe('5.000 m');
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

  it('rectangle: rect + stroke + W×H label', () => {
    const { ctx, calls } = makeCtxRecorder();
    paintPreview(
      ctx,
      { kind: 'rectangle', corner1: { x: 0, y: 0 }, cursor: { x: 4, y: 3 } },
      viewport,
      dark,
    );
    const rect = calls.find((c) => c.method === 'rect');
    expect(rect?.args).toEqual([0, 0, 4, 3]);
    const fillText = calls.find((c) => c.method === 'fillText');
    expect(fillText?.args[0]).toBe('4.000 × 3.000 m');
  });

  it('circle: full-arc + radius line + R label', () => {
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
    const fillText = calls.find((c) => c.method === 'fillText');
    expect(fillText?.args[0]).toBe('R 5.000 m');
  });

  it('arc-2pt: first leg only (no arc shape yet) + length label', () => {
    const { ctx, calls } = makeCtxRecorder();
    paintPreview(
      ctx,
      { kind: 'arc-2pt', p1: { x: 0, y: 0 }, cursor: { x: 3, y: 4 } },
      viewport,
      dark,
    );
    const methods = calls.map((c) => c.method);
    // Verify the leg was drawn (moveTo + lineTo + stroke). The label
    // pill background uses arc() for its rounded corners, so we can't
    // assert arc-absence here — but no arc call should appear before
    // the FIRST stroke (which terminates the leg-line draw).
    const firstStrokeIdx = methods.indexOf('stroke');
    const beforeFirstStroke = methods.slice(0, firstStrokeIdx);
    expect(beforeFirstStroke).toContain('moveTo');
    expect(beforeFirstStroke).toContain('lineTo');
    expect(beforeFirstStroke).not.toContain('arc');
    const ft = calls.find((c) => c.method === 'fillText');
    expect(ft?.args[0]).toBe('5.000 m');
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
    const ft = calls.find((c) => c.method === 'fillText');
    expect(ft?.args[0]).toBe('R 5.000 m');
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

  it('rectangle: ctx.rect at offset origin with the original dimensions', () => {
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
    const rect = calls.find((c) => c.method === 'rect');
    expect(rect?.args).toEqual([10, 5, 8, 4]);
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

describe('paintPreview — Gate DTP-T6 source-import isolation (I-DTP-9)', () => {
  it('paintPreview.ts does NOT import @portplanner/project-store', () => {
    const src = readFileSync('src/canvas/painters/paintPreview.ts', 'utf8');
    expect(src).not.toMatch(/from\s+['"]@portplanner\/project-store['"]/);
  });
});

// M1.3d-Remediation-2 R6 — per-arm angleRad assertions. paintPreview
// rotates the embedded transient label to align with the element
// direction. line / polyline / circle / arc-2pt rotate; rectangle /
// arc-3pt stay horizontal. The rotation is applied via ctx.rotate
// inside paintTransientLabel, so we capture rotate calls in the proxy
// and verify the angle.
describe('paintPreview — per-arm element-aligned label rotation (R6)', () => {
  it('line preview rotates label to align with p1 → cursor', () => {
    const { ctx, calls } = makeCtxRecorder();
    paintPreview(ctx, { kind: 'line', p1: { x: 0, y: 0 }, cursor: { x: 3, y: 4 } }, viewport, dark);
    const rotate = calls.find((c) => c.method === 'rotate');
    expect(rotate).toBeDefined();
    // angleRad = -atan2(4, 3) ≈ -0.927; in (-π/2, π/2], no flip.
    expect(rotate?.args[0]).toBeCloseTo(-Math.atan2(4, 3), 9);
  });

  it('polyline preview rotates label along last → cursor (rubber-band)', () => {
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
    const rotate = calls.find((c) => c.method === 'rotate');
    expect(rotate).toBeDefined();
    // last = (5, 0); cursor = (5, 5); angle = -atan2(5, 0) = -π/2 (vertical).
    // In (-π/2, π/2]: -π/2 itself is at the boundary — normalizeReadable
    // folds (-π/2 condition is `<=`) so it gets +π → π/2.
    expect(Math.abs(Math.abs(rotate?.args[0] as number) - Math.PI / 2)).toBeLessThan(1e-9);
  });

  it('circle preview rotates label along radius (center → cursor)', () => {
    const { ctx, calls } = makeCtxRecorder();
    paintPreview(
      ctx,
      { kind: 'circle', center: { x: 0, y: 0 }, cursor: { x: 5, y: 0 } },
      viewport,
      dark,
    );
    const rotate = calls.find((c) => c.method === 'rotate');
    expect(rotate).toBeDefined();
    // angle = -atan2(0, 5) = 0 → no visible rotation.
    expect(rotate?.args[0]).toBe(-0); // -atan2(0, 5) is -0 in IEEE 754
  });

  it('arc-2pt preview rotates label along p1 → cursor (same shape as line)', () => {
    const { ctx, calls } = makeCtxRecorder();
    paintPreview(
      ctx,
      { kind: 'arc-2pt', p1: { x: 0, y: 0 }, cursor: { x: 3, y: 4 } },
      viewport,
      dark,
    );
    const rotate = calls.find((c) => c.method === 'rotate');
    expect(rotate).toBeDefined();
    expect(rotate?.args[0]).toBeCloseTo(-Math.atan2(4, 3), 9);
  });

  it('rectangle preview does NOT rotate the label (W×H reads horizontally)', () => {
    const { ctx, calls } = makeCtxRecorder();
    paintPreview(
      ctx,
      { kind: 'rectangle', corner1: { x: 0, y: 0 }, cursor: { x: 4, y: 3 } },
      viewport,
      dark,
    );
    const rotate = calls.find((c) => c.method === 'rotate');
    expect(rotate).toBeUndefined();
  });

  it('arc-3pt preview does NOT rotate the label (chord direction ambiguous)', () => {
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
    const rotate = calls.find((c) => c.method === 'rotate');
    expect(rotate).toBeUndefined();
  });
});
