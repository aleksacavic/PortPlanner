// Pixel → entity hit-test. Uses spatial index to pre-filter, then
// runs per-kind precise distance check in metric coords.

import type { Point2D, Primitive, PrimitiveId } from '@portplanner/domain';

import { type ArcParams, arcParamsFromBulge } from './painters/_polylineGeometry';
import type { PrimitiveSpatialIndex } from './spatial-index';
import { type Viewport, screenToMetric } from './view-transform';

const HIT_TOLERANCE_PX = 6;

function distancePointToLineSegment(p: Point2D, a: Point2D, b: Point2D): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function distancePointToCircle(p: Point2D, center: Point2D, radius: number): number {
  return Math.abs(Math.hypot(p.x - center.x, p.y - center.y) - radius);
}

/** Distance from a point to a circular arc segment. If the point's
 *  angular projection (from arc center) falls inside [startAngle, endAngle],
 *  returns the radial distance |dist - radius|. Otherwise returns the
 *  smaller of the distances to the two arc endpoints.
 *
 *  M1.3b fillet-chamfer Phase 1 — closes ADR-016 §170 hit-test bulge gap. */
function distancePointToArcSegment(p: Point2D, arc: ArcParams): number {
  const dx = p.x - arc.cx;
  const dy = p.y - arc.cy;
  const dist = Math.hypot(dx, dy);
  let theta = Math.atan2(dy, dx);

  // Normalize sweep range. arcParamsFromBulge produces endAngle = startAngle + 4·atan(bulge);
  // sweep is signed (positive for CCW, negative for CW per `counterClockwise`).
  // We need to test whether `theta` falls within the actual swept range.
  const start = arc.startAngle;
  const end = arc.endAngle;
  // Bring theta into [start - 2π, start + 2π] so a single normalization
  // cycle suffices.
  while (theta < start - Math.PI) theta += 2 * Math.PI;
  while (theta > start + Math.PI) theta -= 2 * Math.PI;

  let inSweep: boolean;
  if (end >= start) {
    // CCW sweep from start to end.
    inSweep = theta >= start && theta <= end;
  } else {
    // CW sweep (end < start).
    inSweep = theta <= start && theta >= end;
  }

  if (inSweep) return Math.abs(dist - arc.radius);

  // Outside sweep: distance to closer arc endpoint.
  const startPt = {
    x: arc.cx + arc.radius * Math.cos(start),
    y: arc.cy + arc.radius * Math.sin(start),
  };
  const endPt = {
    x: arc.cx + arc.radius * Math.cos(end),
    y: arc.cy + arc.radius * Math.sin(end),
  };
  const dStart = Math.hypot(p.x - startPt.x, p.y - startPt.y);
  const dEnd = Math.hypot(p.x - endPt.x, p.y - endPt.y);
  return Math.min(dStart, dEnd);
}

export function hitTest(
  cursorScreen: { x: number; y: number },
  viewport: Viewport,
  spatialIndex: PrimitiveSpatialIndex,
  primitives: Record<PrimitiveId, Primitive>,
): PrimitiveId | null {
  const cursor = screenToMetric(cursorScreen, viewport);
  const tolerance = HIT_TOLERANCE_PX / viewport.zoom;

  const ids = spatialIndex.searchFrustum({
    minX: cursor.x - tolerance,
    maxX: cursor.x + tolerance,
    minY: cursor.y - tolerance,
    maxY: cursor.y + tolerance,
  });

  let bestId: PrimitiveId | null = null;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const id of ids) {
    const p = primitives[id];
    if (!p) continue;
    const d = distanceTo(cursor, p);
    if (d <= tolerance && d < bestDist) {
      bestDist = d;
      bestId = id;
    }
  }
  return bestId;
}

/** Find the closest primitive to a metric-space point within `tolerance`,
 *  or null. Used by interactive tools (Fillet, Chamfer) that receive
 *  'point' inputs from canvas clicks and need to identify which entity
 *  the user clicked AND retain the click coordinate as a pickHint for
 *  downstream domain helpers. */
export function findEntityAtMetricPoint(
  cursor: Point2D,
  primitives: Record<PrimitiveId, Primitive>,
  tolerance: number,
): { id: PrimitiveId; primitive: Primitive } | null {
  let bestId: PrimitiveId | null = null;
  let bestPrim: Primitive | null = null;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const id in primitives) {
    const p = primitives[id as PrimitiveId];
    if (!p) continue;
    const d = distanceTo(cursor, p);
    if (d <= tolerance && d < bestDist) {
      bestId = id as PrimitiveId;
      bestPrim = p;
      bestDist = d;
    }
  }
  return bestId && bestPrim ? { id: bestId, primitive: bestPrim } : null;
}

function distanceTo(cursor: Point2D, p: Primitive): number {
  switch (p.kind) {
    case 'point':
      return Math.hypot(cursor.x - p.position.x, cursor.y - p.position.y);
    case 'line':
      return distancePointToLineSegment(cursor, p.p1, p.p2);
    case 'polyline': {
      // M1.3b fillet-chamfer Phase 1 — bulge-aware polyline hit-test
      // closes ADR-016 §170 hit-test gap. Straight segments use the
      // existing line-segment helper; bulged segments route through
      // `arcParamsFromBulge` + `distancePointToArcSegment`.
      let best = Number.POSITIVE_INFINITY;
      const n = p.vertices.length;
      const segCount = p.closed ? n : n - 1;
      for (let k = 0; k < segCount; k++) {
        const a = p.vertices[k]!;
        const b = p.vertices[(k + 1) % n]!;
        const bulge = p.bulges[k] ?? 0;
        const d =
          bulge === 0
            ? distancePointToLineSegment(cursor, a, b)
            : distancePointToArcSegment(cursor, arcParamsFromBulge(a, b, bulge));
        if (d < best) best = d;
      }
      return best;
    }
    case 'rectangle': {
      const cos = Math.cos(p.localAxisAngle);
      const sin = Math.sin(p.localAxisAngle);
      const c0 = { x: p.origin.x, y: p.origin.y };
      const c1 = { x: p.origin.x + p.width * cos, y: p.origin.y + p.width * sin };
      const c2 = {
        x: p.origin.x + p.width * cos - p.height * sin,
        y: p.origin.y + p.width * sin + p.height * cos,
      };
      const c3 = { x: p.origin.x - p.height * sin, y: p.origin.y + p.height * cos };
      return Math.min(
        distancePointToLineSegment(cursor, c0, c1),
        distancePointToLineSegment(cursor, c1, c2),
        distancePointToLineSegment(cursor, c2, c3),
        distancePointToLineSegment(cursor, c3, c0),
      );
    }
    case 'circle':
      return distancePointToCircle(cursor, p.center, p.radius);
    case 'arc':
      // Approximate with circle; precise arc-span check deferred.
      return distancePointToCircle(cursor, p.center, p.radius);
    case 'xline': {
      // Distance from cursor to infinite line.
      const dx = Math.cos(p.angle);
      const dy = Math.sin(p.angle);
      const ex = cursor.x - p.pivot.x;
      const ey = cursor.y - p.pivot.y;
      // Perpendicular component magnitude
      return Math.abs(ex * -dy + ey * dx);
    }
  }
}
