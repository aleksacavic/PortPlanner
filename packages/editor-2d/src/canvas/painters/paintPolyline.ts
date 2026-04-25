// Polyline painter — handles bulge-encoded arc segments per ADR-016.
// `bulge === 0` means straight; non-zero bulge encodes tan(θ/4) where
// θ is the included arc angle. Sign indicates direction (positive =
// CCW from start to end, per DXF convention).

import type { Point2D, PolylinePrimitive } from '@portplanner/domain';

import type { EffectiveStyle } from '../style';

interface ArcParams {
  cx: number;
  cy: number;
  radius: number;
  startAngle: number;
  endAngle: number;
  counterClockwise: boolean;
}

/** Compute arc parameters for a polyline segment with non-zero bulge. */
export function arcParamsFromBulge(p1: Point2D, p2: Point2D, bulge: number): ArcParams {
  const theta = 4 * Math.atan(bulge);
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const chord = Math.hypot(dx, dy);
  const sagitta = (bulge * chord) / 2;
  const radius = (chord / 2) ** 2 / (2 * sagitta) + sagitta / 2;
  const midX = (p1.x + p2.x) / 2;
  const midY = (p1.y + p2.y) / 2;
  // Perpendicular to chord (rotate (dx,dy) by +90°).
  const nx = -dy / chord;
  const ny = dx / chord;
  const sign = bulge >= 0 ? 1 : -1;
  const centerOffset = Math.sqrt(Math.max(radius * radius - (chord / 2) ** 2, 0)) * sign;
  const cx = midX + nx * centerOffset;
  const cy = midY + ny * centerOffset;
  const startAngle = Math.atan2(p1.y - cy, p1.x - cx);
  const endAngle = startAngle + theta;
  return {
    cx,
    cy,
    radius: Math.abs(radius),
    startAngle,
    endAngle,
    counterClockwise: bulge < 0,
  };
}

export function paintPolyline(
  ctx: CanvasRenderingContext2D,
  p: PolylinePrimitive,
  style: EffectiveStyle,
  metricToPx: number,
): void {
  if (p.vertices.length === 0) return;
  ctx.strokeStyle = style.color;
  ctx.lineWidth = 1 / metricToPx;
  ctx.beginPath();
  ctx.moveTo(p.vertices[0]!.x, p.vertices[0]!.y);

  const n = p.vertices.length;
  const segCount = p.closed ? n : n - 1;
  for (let k = 0; k < segCount; k++) {
    const a = p.vertices[k]!;
    const b = p.vertices[(k + 1) % n]!;
    const bulge = p.bulges[k] ?? 0;
    if (bulge === 0) {
      ctx.lineTo(b.x, b.y);
    } else {
      const arc = arcParamsFromBulge(a, b, bulge);
      ctx.arc(arc.cx, arc.cy, arc.radius, arc.startAngle, arc.endAngle, arc.counterClockwise);
    }
  }
  if (p.closed) ctx.closePath();
  ctx.stroke();
}
