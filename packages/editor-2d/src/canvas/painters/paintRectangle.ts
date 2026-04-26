import type { RectanglePrimitive } from '@portplanner/domain';

import type { EffectiveStyle } from '../style';

export function paintRectangle(
  ctx: CanvasRenderingContext2D,
  p: RectanglePrimitive,
  style: EffectiveStyle,
  metricToPx: number,
): void {
  ctx.strokeStyle = style.color;
  ctx.lineWidth = 1 / metricToPx;
  const cos = Math.cos(p.localAxisAngle);
  const sin = Math.sin(p.localAxisAngle);
  // Local-frame corners → world via rotation.
  const c0 = { x: p.origin.x, y: p.origin.y };
  const c1 = { x: p.origin.x + p.width * cos, y: p.origin.y + p.width * sin };
  const c2 = {
    x: p.origin.x + p.width * cos - p.height * sin,
    y: p.origin.y + p.width * sin + p.height * cos,
  };
  const c3 = { x: p.origin.x - p.height * sin, y: p.origin.y + p.height * cos };
  ctx.beginPath();
  ctx.moveTo(c0.x, c0.y);
  ctx.lineTo(c1.x, c1.y);
  ctx.lineTo(c2.x, c2.y);
  ctx.lineTo(c3.x, c3.y);
  ctx.closePath();
  ctx.stroke();
}
