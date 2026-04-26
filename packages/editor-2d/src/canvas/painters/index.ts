// Painter dispatch — kind-discriminated per ADR-021. The paint loop
// (paint.ts) calls into this module; per-kind painters are pure
// functions that consume an entity + effective style.

import type { Primitive } from '@portplanner/domain';

import type { EffectiveStyle } from '../style';
import { paintArc } from './paintArc';
import { paintCircle } from './paintCircle';
import { paintLine } from './paintLine';
import { paintPoint } from './paintPoint';
import { paintPolyline } from './paintPolyline';
import { paintRectangle } from './paintRectangle';
import { paintXline } from './paintXline';

interface Frustum {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function paintPrimitive(
  ctx: CanvasRenderingContext2D,
  primitive: Primitive,
  style: EffectiveStyle,
  metricToPx: number,
  frustum: Frustum,
): void {
  switch (primitive.kind) {
    case 'point':
      paintPoint(ctx, primitive, style, metricToPx);
      return;
    case 'line':
      paintLine(ctx, primitive, style, metricToPx);
      return;
    case 'polyline':
      paintPolyline(ctx, primitive, style, metricToPx);
      return;
    case 'rectangle':
      paintRectangle(ctx, primitive, style, metricToPx);
      return;
    case 'circle':
      paintCircle(ctx, primitive, style, metricToPx);
      return;
    case 'arc':
      paintArc(ctx, primitive, style, metricToPx);
      return;
    case 'xline':
      paintXline(ctx, primitive, style, metricToPx, frustum);
      return;
  }
}

export { paintArc, paintCircle, paintLine, paintPoint, paintPolyline, paintRectangle, paintXline };
export { paintGrid } from './paintGrid';
