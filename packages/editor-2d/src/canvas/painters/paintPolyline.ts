// Polyline painter — handles bulge-encoded arc segments per ADR-016.
// `bulge === 0` means straight; non-zero bulge encodes tan(θ/4) where
// θ is the included arc angle. Sign indicates direction (positive =
// CCW from start to end, per DXF convention).
//
// M1.3b fillet-chamfer Phase 1: arcParamsFromBulge moved to the shared
// `_polylineGeometry` module so paint-preview / hit-test / osnap all
// reference the same arc math (ADR-016 §170 SSOT). Re-exported here
// for callers that imported via this module.

import type { PolylinePrimitive } from '@portplanner/domain';

import type { EffectiveStyle } from '../style';
import { arcParamsFromBulge } from './_polylineGeometry';

export { arcParamsFromBulge } from './_polylineGeometry';
export type { ArcParams } from './_polylineGeometry';

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
