import type { CirclePrimitive } from '@portplanner/domain';

import type { EffectiveStyle } from '../style';

export function paintCircle(
  ctx: CanvasRenderingContext2D,
  p: CirclePrimitive,
  style: EffectiveStyle,
  metricToPx: number,
): void {
  ctx.strokeStyle = style.color;
  ctx.lineWidth = 1 / metricToPx;
  ctx.beginPath();
  ctx.arc(p.center.x, p.center.y, p.radius, 0, Math.PI * 2);
  ctx.stroke();
}
