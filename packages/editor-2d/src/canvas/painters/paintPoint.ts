import type { PointPrimitive } from '@portplanner/domain';

import type { EffectiveStyle } from '../style';

const POINT_RADIUS_PX = 2;

export function paintPoint(
  ctx: CanvasRenderingContext2D,
  p: PointPrimitive,
  style: EffectiveStyle,
  metricToPx: number,
): void {
  const r = POINT_RADIUS_PX / metricToPx;
  ctx.fillStyle = style.color;
  ctx.beginPath();
  ctx.arc(p.position.x, p.position.y, r, 0, Math.PI * 2);
  ctx.fill();
}
