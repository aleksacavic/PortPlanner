// Pixel → entity hit-test. Uses spatial index to pre-filter, then
// runs per-kind precise distance check in metric coords.

import type { Point2D, Primitive, PrimitiveId } from '@portplanner/domain';

import { type PrimitiveSpatialIndex } from './spatial-index';
import { type Viewport, screenToMetric } from './view-transform';

const HIT_TOLERANCE_PX = 6;

function distancePointToLineSegment(
  p: Point2D,
  a: Point2D,
  b: Point2D,
): number {
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

function distanceTo(cursor: Point2D, p: Primitive): number {
  switch (p.kind) {
    case 'point':
      return Math.hypot(cursor.x - p.position.x, cursor.y - p.position.y);
    case 'line':
      return distancePointToLineSegment(cursor, p.p1, p.p2);
    case 'polyline': {
      let best = Number.POSITIVE_INFINITY;
      const n = p.vertices.length;
      const segCount = p.closed ? n : n - 1;
      for (let k = 0; k < segCount; k++) {
        const a = p.vertices[k]!;
        const b = p.vertices[(k + 1) % n]!;
        // Approximate with line segment; bulge-arc precise hit deferred.
        const d = distancePointToLineSegment(cursor, a, b);
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
