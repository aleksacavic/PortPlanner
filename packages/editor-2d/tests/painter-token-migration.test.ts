// Gate REM7-P1-PainterTokenMigration — locks the canvas-token sweep
// across every overlay painter. Each test mounts a recorder ctx, feeds
// the dark token bundle + a fixed viewport, performs one paint call,
// and asserts the captured `ctx.lineWidth` (and where applicable
// `ctx.setLineDash` arguments) match the token-derived expected
// numbers. A token rename or value change without a test update
// surfaces as a failure here — refactor-resilient evidence that
// painters consume their constants from `canvas.transient.*` rather
// than module-level literals.

import { dark } from '@portplanner/design-system';
import { type Grid, LayerId, defaultLayer } from '@portplanner/domain';
import { describe, expect, it } from 'vitest';

import { paintCrosshair } from '../src/canvas/painters/paintCrosshair';
import { paintDimensionGuides } from '../src/canvas/painters/paintDimensionGuides';
import { paintGrid } from '../src/canvas/painters/paintGrid';
import { paintHoverHighlight } from '../src/canvas/painters/paintHoverHighlight';
import { paintPreview } from '../src/canvas/painters/paintPreview';
import { paintSelection } from '../src/canvas/painters/paintSelection';
import { paintSelectionRect } from '../src/canvas/painters/paintSelectionRect';
import { paintSnapGlyph } from '../src/canvas/painters/paintSnapGlyph';
import { paintTransientLabel } from '../src/canvas/painters/paintTransientLabel';
import { resolveEffectiveStyle } from '../src/canvas/style';
import type { Viewport } from '../src/canvas/view-transform';

// Fixed viewport: zoom=10, dpr=1 → metricToPx=10. Choosing zoom=10 so
// the metric → CSS-px conversion is the cleanest possible (1 metric =
// 10 CSS px) and the expected numbers are easy to read inline.
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

function lastLineWidth(calls: CtxCall[]): number {
  for (let i = calls.length - 1; i >= 0; i--) {
    const c = calls[i];
    if (c?.method === 'set:lineWidth') return c.args[0] as number;
  }
  throw new Error('no lineWidth set call recorded');
}

describe('painter-token-migration — every overlay painter consumes numeric chrome from canvas.transient.*', () => {
  it('paintGrid lineWidth = grid_stroke_width / metricToPx (1 / 10 = 0.1)', () => {
    const grid: Grid = {
      id: 'grid-1' as Grid['id'],
      origin: { x: 0, y: 0 },
      angle: 0,
      spacingX: 5,
      spacingY: 5,
      layerId: LayerId.DEFAULT,
      visible: true,
      activeForSnap: true,
    };
    const layer = defaultLayer();
    const style = resolveEffectiveStyle({}, layer);
    const metricToPx = viewport.zoom * viewport.dpr;
    const { ctx, calls } = makeCtxRecorder();
    paintGrid(ctx, grid, style, metricToPx, { minX: -10, minY: -10, maxX: 10, maxY: 10 }, dark);
    expect(lastLineWidth(calls)).toBeCloseTo(0.1, 6);
  });

  it('paintPreview lineWidth = preview_stroke_width / metricToPx (1 / 10 = 0.1)', () => {
    const { ctx, calls } = makeCtxRecorder();
    paintPreview(
      ctx,
      { kind: 'line', p1: { x: 0, y: 0 }, cursor: { x: 5, y: 0 } },
      viewport,
      dark,
      true, // suppressEmbeddedLabels — keep the recorder light
    );
    expect(lastLineWidth(calls)).toBeCloseTo(0.1, 6);
  });

  it('paintHoverHighlight lineWidth = hover_highlight.stroke_width / metricToPx (1 / 10 = 0.1)', () => {
    const { ctx, calls } = makeCtxRecorder();
    paintHoverHighlight(
      ctx,
      {
        id: 'p-1' as never,
        kind: 'line',
        layerId: LayerId.DEFAULT,
        displayOverrides: {},
        p1: { x: 0, y: 0 },
        p2: { x: 5, y: 0 },
      },
      viewport,
      dark,
    );
    expect(lastLineWidth(calls)).toBeCloseTo(0.1, 6);
  });

  it('paintSelectionRect lineWidth = selection_window.stroke_width × dpr (1 × 1 = 1)', () => {
    const { ctx, calls } = makeCtxRecorder();
    paintSelectionRect(
      ctx,
      { start: { x: 0, y: 0 }, end: { x: 5, y: 5 }, direction: 'window' },
      viewport,
      dark,
    );
    expect(lastLineWidth(calls)).toBeCloseTo(1, 6);
  });

  it('paintCrosshair lineWidth = crosshair_stroke_width × dpr (1 × 1 = 1)', () => {
    const { ctx, calls } = makeCtxRecorder();
    paintCrosshair(ctx, { x: 0, y: 0 }, 100, viewport, dark);
    expect(lastLineWidth(calls)).toBeCloseTo(1, 6);
  });

  it('paintTransientLabel font size = label_font_size × dpr (11 × 1 = "11px ...")', () => {
    const { ctx, calls } = makeCtxRecorder();
    paintTransientLabel(ctx, { metric: { x: 0, y: 0 } }, '5.0', viewport, dark);
    const fontCall = calls.find((c) => c.method === 'set:font');
    if (!fontCall) throw new Error('no font set call recorded');
    expect(fontCall.args[0]).toMatch(/^11px /);
  });

  it('paintSelection outline lineWidth = selection_outline_width / metricToPx (1.5 / 10 = 0.15)', () => {
    const { ctx, calls } = makeCtxRecorder();
    paintSelection(
      ctx,
      {
        id: 'p-1' as never,
        kind: 'line',
        layerId: LayerId.DEFAULT,
        displayOverrides: {},
        p1: { x: 0, y: 0 },
        p2: { x: 5, y: 0 },
      },
      [],
      viewport,
      dark,
      null,
    );
    // First lineWidth set is the outline pass (selection_outline_width).
    const lineWidthCalls = calls.filter((c) => c.method === 'set:lineWidth');
    expect(lineWidthCalls[0]).toBeDefined();
    expect(lineWidthCalls[0]?.args[0]).toBeCloseTo(0.15, 6);
  });

  it('paintSnapGlyph lineWidth = snap_glyph.stroke_width × dpr (1.5 × 1 = 1.5)', () => {
    const { ctx, calls } = makeCtxRecorder();
    paintSnapGlyph(
      ctx,
      { kind: 'endpoint', point: { x: 0, y: 0 }, distance: 0, priority: 0 } as never,
      viewport,
      dark,
    );
    expect(lastLineWidth(calls)).toBeCloseTo(1.5, 6);
  });

  it('paintDimensionGuides lineWidth = dim_stroke_width / metricToPx (1 / 10 = 0.1)', () => {
    const { ctx, calls } = makeCtxRecorder();
    paintDimensionGuides(
      ctx,
      [
        {
          kind: 'linear-dim',
          anchorA: { x: 0, y: 0 },
          anchorB: { x: 5, y: 0 },
          offsetCssPx: 40,
        },
      ],
      viewport,
      dark,
    );
    // The outer paintDimensionGuides scope sets lineWidth once at the
    // top before iterating guides; that first set is what we assert.
    const lineWidthCalls = calls.filter((c) => c.method === 'set:lineWidth');
    expect(lineWidthCalls[0]).toBeDefined();
    expect(lineWidthCalls[0]?.args[0]).toBeCloseTo(0.1, 6);
  });

  it('paintDimensionGuides FULL-mode emits dotted dim line per dim_dashed_pattern token ([2,3] → metric [0.2, 0.3])', () => {
    const { ctx, calls } = makeCtxRecorder();
    paintDimensionGuides(
      ctx,
      [
        {
          kind: 'linear-dim',
          anchorA: { x: 0, y: 0 },
          anchorB: { x: 5, y: 0 },
          offsetCssPx: 40,
        },
      ],
      viewport,
      dark,
    );
    const dashCalls = calls.filter((c) => c.method === 'setLineDash');
    // Outer scope sets [], then linear-dim FULL mode sets the dim
    // pattern dash. Locate the non-empty pattern call.
    const dimDash = dashCalls.find(
      (c) => Array.isArray(c.args[0]) && (c.args[0] as number[]).length > 0,
    );
    if (!dimDash) throw new Error('no non-empty setLineDash call recorded');
    const arr = dimDash.args[0] as number[];
    expect(arr).toHaveLength(2);
    expect(arr[0]).toBeCloseTo(0.2, 6);
    expect(arr[1]).toBeCloseTo(0.3, 6);
  });
});
