// Xline (infinite construction line) painter — clip to viewport edges
// using parametric line-rectangle intersection.

import type { XlinePrimitive } from '@portplanner/domain';

import type { EffectiveStyle } from '../style';

interface Frustum {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Compute the two viewport-edge intersections of an infinite line. */
export function clipXlineToFrustum(
  pivot: { x: number; y: number },
  angle: number,
  frustum: Frustum,
): [{ x: number; y: number }, { x: number; y: number }] | null {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  // Liang-Barsky-ish: solve t for x = pivot.x + t·dx, y = pivot.y + t·dy
  // crossing each edge. Collect candidate t's, take min and max within
  // the rectangle.
  const tValues: number[] = [];
  if (dx !== 0) {
    tValues.push((frustum.minX - pivot.x) / dx);
    tValues.push((frustum.maxX - pivot.x) / dx);
  }
  if (dy !== 0) {
    tValues.push((frustum.minY - pivot.y) / dy);
    tValues.push((frustum.maxY - pivot.y) / dy);
  }
  // For each candidate t, compute the point and check if it lies on the
  // rectangle boundary (within tolerance).
  const inside: number[] = [];
  for (const t of tValues) {
    const x = pivot.x + t * dx;
    const y = pivot.y + t * dy;
    if (
      x >= frustum.minX - 1e-9 &&
      x <= frustum.maxX + 1e-9 &&
      y >= frustum.minY - 1e-9 &&
      y <= frustum.maxY + 1e-9
    ) {
      inside.push(t);
    }
  }
  if (inside.length < 2) return null;
  inside.sort((a, b) => a - b);
  const t0 = inside[0]!;
  const t1 = inside[inside.length - 1]!;
  return [
    { x: pivot.x + t0 * dx, y: pivot.y + t0 * dy },
    { x: pivot.x + t1 * dx, y: pivot.y + t1 * dy },
  ];
}

export function paintXline(
  ctx: CanvasRenderingContext2D,
  p: XlinePrimitive,
  style: EffectiveStyle,
  metricToPx: number,
  frustum: Frustum,
): void {
  const clipped = clipXlineToFrustum(p.pivot, p.angle, frustum);
  if (!clipped) return;
  ctx.strokeStyle = style.color;
  ctx.lineWidth = 1 / metricToPx;
  ctx.beginPath();
  ctx.moveTo(clipped[0].x, clipped[0].y);
  ctx.lineTo(clipped[1].x, clipped[1].y);
  ctx.stroke();
}
