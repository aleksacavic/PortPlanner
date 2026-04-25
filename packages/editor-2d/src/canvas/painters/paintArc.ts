import type { ArcPrimitive } from '@portplanner/domain';

import type { EffectiveStyle } from '../style';

export function paintArc(
  ctx: CanvasRenderingContext2D,
  p: ArcPrimitive,
  style: EffectiveStyle,
  metricToPx: number,
): void {
  ctx.strokeStyle = style.color;
  ctx.lineWidth = 1 / metricToPx;
  ctx.beginPath();
  ctx.arc(p.center.x, p.center.y, p.radius, p.startAngle, p.endAngle);
  ctx.stroke();
}
