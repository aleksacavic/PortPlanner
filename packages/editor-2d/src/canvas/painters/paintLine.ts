import type { LinePrimitive } from '@portplanner/domain';

import type { EffectiveStyle } from '../style';

export function paintLine(
  ctx: CanvasRenderingContext2D,
  p: LinePrimitive,
  style: EffectiveStyle,
  metricToPx: number,
): void {
  ctx.strokeStyle = style.color;
  ctx.lineWidth = 1 / metricToPx;
  ctx.beginPath();
  ctx.moveTo(p.p1.x, p.p1.y);
  ctx.lineTo(p.p2.x, p.p2.y);
  ctx.stroke();
}
