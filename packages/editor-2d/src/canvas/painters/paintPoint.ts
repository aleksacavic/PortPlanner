// Point primitive painter. M1.3 snap-engine-extension Phase 3 added
// the `displayShape` switch — three options:
//   'dot'        — filled 2-px circle (legacy default).
//   'x'          — two diagonal stroke lines forming ×.
//   'circle-dot' — outline circle (radius 4) + filled 1-px center dot.
//                  This is the new default, locked by the
//                  PointPrimitiveSchema's `.default('circle-dot')`.

import type { PointDisplayShape, PointPrimitive } from '@portplanner/domain';

import type { EffectiveStyle } from '../style';

const POINT_RADIUS_PX = 2;
const CIRCLE_DOT_OUTLINE_RADIUS_PX = 4;
const CIRCLE_DOT_CENTER_RADIUS_PX = 1;
const X_HALF_PX = 4;
const STROKE_WIDTH_PX = 1;

export function paintPoint(
  ctx: CanvasRenderingContext2D,
  p: PointPrimitive,
  style: EffectiveStyle,
  metricToPx: number,
): void {
  // Default to 'circle-dot' if the field is absent (defence-in-depth;
  // PointPrimitiveSchema.default already fills it on parse).
  const shape: PointDisplayShape = p.displayShape ?? 'circle-dot';

  const cx = p.position.x;
  const cy = p.position.y;

  switch (shape) {
    case 'dot': {
      const r = POINT_RADIUS_PX / metricToPx;
      ctx.fillStyle = style.color;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    case 'x': {
      const half = X_HALF_PX / metricToPx;
      ctx.strokeStyle = style.color;
      ctx.lineWidth = STROKE_WIDTH_PX / metricToPx;
      ctx.beginPath();
      ctx.moveTo(cx - half, cy - half);
      ctx.lineTo(cx + half, cy + half);
      ctx.moveTo(cx - half, cy + half);
      ctx.lineTo(cx + half, cy - half);
      ctx.stroke();
      return;
    }
    case 'circle-dot': {
      const outlineR = CIRCLE_DOT_OUTLINE_RADIUS_PX / metricToPx;
      const centerR = CIRCLE_DOT_CENTER_RADIUS_PX / metricToPx;
      ctx.strokeStyle = style.color;
      ctx.fillStyle = style.color;
      ctx.lineWidth = STROKE_WIDTH_PX / metricToPx;
      // Outline circle.
      ctx.beginPath();
      ctx.arc(cx, cy, outlineR, 0, Math.PI * 2);
      ctx.stroke();
      // Centre dot (filled).
      ctx.beginPath();
      ctx.arc(cx, cy, centerR, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
  }
}
