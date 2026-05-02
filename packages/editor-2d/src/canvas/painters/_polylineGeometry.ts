// Polyline arc-segment geometry SSOT — shared between paintPolyline
// (entity painter), paintPreview (preview painter, drawShiftedPrimitiveOutline
// polyline branch), hit-test (polyline distance), and osnap (polyline MID).
// Bulge encoding per ADR-016: `bulge === 0` means straight; non-zero
// encodes `tan(θ/4)` where θ is the included arc angle (signed: positive
// CCW, DXF convention).
//
// M1.3b fillet-chamfer Phase 1: extracted from paintPolyline.ts so all
// downstream consumers (renderer / hit-test / extractor / snap) reference
// the same arc math per ADR-016 §170 ("straight-only shortcuts are
// Blockers"). Closes Codex Round-2 quality gap #2 from the prior
// simple-transforms cluster (preview painter ignored bulges).

import type { Point2D } from '@portplanner/domain';

export interface ArcParams {
  cx: number;
  cy: number;
  radius: number;
  startAngle: number;
  endAngle: number;
  counterClockwise: boolean;
}

/** Compute arc parameters for a polyline segment with non-zero bulge.
 *  Identical math to the original paintPolyline.ts implementation —
 *  re-exported from there for back-compat. */
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

/** Returns the point on the arc at the midway angle between startAngle
 *  and endAngle. Used by osnap MID for bulged polyline segments. */
export function pointOnArcAtMidAngle(arc: ArcParams): Point2D {
  const midAngle = (arc.startAngle + arc.endAngle) / 2;
  return {
    x: arc.cx + arc.radius * Math.cos(midAngle),
    y: arc.cy + arc.radius * Math.sin(midAngle),
  };
}
