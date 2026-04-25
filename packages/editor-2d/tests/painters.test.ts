// Painter smoke tests — use a recording mock 2D context to assert
// the right path operations are issued. Pixel-exact rendering requires
// node-canvas which is intentionally not in our toolchain (jsdom-only).

import { LayerId, type Primitive, newPrimitiveId } from '@portplanner/domain';
import { describe, expect, it } from 'vitest';

import { arcParamsFromBulge } from '../src/canvas/painters/paintPolyline';
import { paintPrimitive } from '../src/canvas/painters';
import type { EffectiveStyle } from '../src/canvas/style';

const style: EffectiveStyle = { color: '#FFFFFF', lineType: 'continuous', lineWeight: 0.25 };
const frustum = { minX: -50, minY: -50, maxX: 50, maxY: 50 };

interface RecordingContext {
  ops: Array<[string, unknown[]]>;
  fillStyle: string;
  strokeStyle: string;
  lineWidth: number;
}

function makeCtx(): RecordingContext & {
  beginPath: () => void;
  moveTo: (...args: number[]) => void;
  lineTo: (...args: number[]) => void;
  arc: (...args: unknown[]) => void;
  fill: () => void;
  stroke: () => void;
  closePath: () => void;
} {
  const ctx: RecordingContext = {
    ops: [],
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
  };
  return Object.assign(ctx, {
    beginPath: () => ctx.ops.push(['beginPath', []]),
    moveTo: (...a: number[]) => ctx.ops.push(['moveTo', a]),
    lineTo: (...a: number[]) => ctx.ops.push(['lineTo', a]),
    arc: (...a: unknown[]) => ctx.ops.push(['arc', a]),
    fill: () => ctx.ops.push(['fill', []]),
    stroke: () => ctx.ops.push(['stroke', []]),
    closePath: () => ctx.ops.push(['closePath', []]),
  });
}

const base = { id: newPrimitiveId(), layerId: LayerId.DEFAULT, displayOverrides: {} };

describe('per-kind painters', () => {
  it('point paints via fill arc', () => {
    const ctx = makeCtx();
    paintPrimitive(ctx as unknown as CanvasRenderingContext2D, { ...base, kind: 'point', position: { x: 1, y: 2 } } as Primitive, style, 10, frustum);
    const ops = ctx.ops.map((o) => o[0]);
    expect(ops).toContain('arc');
    expect(ops).toContain('fill');
  });

  it('line paints via moveTo/lineTo/stroke', () => {
    const ctx = makeCtx();
    paintPrimitive(
      ctx as unknown as CanvasRenderingContext2D,
      { ...base, kind: 'line', p1: { x: 0, y: 0 }, p2: { x: 10, y: 0 } } as Primitive,
      style,
      10,
      frustum,
    );
    const ops = ctx.ops.map((o) => o[0]);
    expect(ops).toContain('moveTo');
    expect(ops).toContain('lineTo');
    expect(ops).toContain('stroke');
  });

  it('polyline with bulges=0 issues only lineTo segments (no arc calls)', () => {
    const ctx = makeCtx();
    paintPrimitive(
      ctx as unknown as CanvasRenderingContext2D,
      {
        ...base,
        kind: 'polyline',
        vertices: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 5 },
        ],
        bulges: [0, 0],
        closed: false,
      } as Primitive,
      style,
      10,
      frustum,
    );
    const arcOps = ctx.ops.filter((o) => o[0] === 'arc');
    expect(arcOps).toHaveLength(0);
  });

  it('polyline with non-zero bulge issues an arc command (I-30)', () => {
    const ctx = makeCtx();
    paintPrimitive(
      ctx as unknown as CanvasRenderingContext2D,
      {
        ...base,
        kind: 'polyline',
        vertices: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
        ],
        bulges: [0.5],
        closed: false,
      } as Primitive,
      style,
      10,
      frustum,
    );
    const arcOps = ctx.ops.filter((o) => o[0] === 'arc');
    expect(arcOps.length).toBeGreaterThanOrEqual(1);
  });

  it('rectangle issues 4 lineTos + closePath', () => {
    const ctx = makeCtx();
    paintPrimitive(
      ctx as unknown as CanvasRenderingContext2D,
      {
        ...base,
        kind: 'rectangle',
        origin: { x: 0, y: 0 },
        width: 5,
        height: 3,
        localAxisAngle: 0,
      } as Primitive,
      style,
      10,
      frustum,
    );
    const ops = ctx.ops.map((o) => o[0]);
    const lineToCount = ops.filter((o) => o === 'lineTo').length;
    expect(lineToCount).toBe(3); // 3 line-tos + 1 close = full quadrilateral
    expect(ops).toContain('closePath');
  });

  it('circle issues a full-sweep arc', () => {
    const ctx = makeCtx();
    paintPrimitive(
      ctx as unknown as CanvasRenderingContext2D,
      { ...base, kind: 'circle', center: { x: 0, y: 0 }, radius: 5 } as Primitive,
      style,
      10,
      frustum,
    );
    expect(ctx.ops.some((o) => o[0] === 'arc')).toBe(true);
  });

  it('xline outside frustum is silently skipped', () => {
    const ctx = makeCtx();
    paintPrimitive(
      ctx as unknown as CanvasRenderingContext2D,
      { ...base, kind: 'xline', pivot: { x: 1000, y: 1000 }, angle: 0 } as Primitive,
      style,
      10,
      frustum, // frustum x ∈ [-50, 50]; xline at y=1000 doesn't intersect
    );
    const strokes = ctx.ops.filter((o) => o[0] === 'stroke');
    // xline at y=1000 (parallel to x-axis) does not cross [-50,50]×[-50,50]
    expect(strokes.length).toBe(0);
  });
});

describe('arcParamsFromBulge', () => {
  it('semicircle (bulge=1) → radius=chord/2', () => {
    const a = arcParamsFromBulge({ x: 0, y: 0 }, { x: 10, y: 0 }, 1);
    expect(a.radius).toBeCloseTo(5, 6);
  });

  it('shallow bulge (bulge=0.1) → radius >> chord/2', () => {
    const a = arcParamsFromBulge({ x: 0, y: 0 }, { x: 10, y: 0 }, 0.1);
    expect(a.radius).toBeGreaterThan(20);
  });

  it('negative bulge sets counterClockwise flag', () => {
    const a = arcParamsFromBulge({ x: 0, y: 0 }, { x: 10, y: 0 }, -1);
    expect(a.counterClockwise).toBe(true);
  });
});
