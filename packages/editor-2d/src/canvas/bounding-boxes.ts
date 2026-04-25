// Per-kind bounding-box calculator for primitives + grid.
// Bboxes feed rbush for frustum culling + hit-test pre-filtering.
// Xlines are infinite — they are NOT inserted into rbush; spatial-index
// returns them via a separate per-frame pass.

import type { ArcPrimitive, Grid, Point2D, Primitive } from '@portplanner/domain';

export interface BBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function envelope(points: Point2D[]): BBox {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
}

/** Bbox of an arc accounting for ±X/±Y extremes within its angular span. */
function bboxOfArc(arc: { center: Point2D; radius: number; startAngle: number; endAngle: number }): BBox {
  const { center, radius, startAngle, endAngle } = arc;
  // Normalize so end > start (arcs convention: CCW sweep).
  let s = startAngle;
  let e = endAngle;
  while (e < s) e += Math.PI * 2;
  // Endpoints
  const points: Point2D[] = [
    { x: center.x + radius * Math.cos(s), y: center.y + radius * Math.sin(s) },
    { x: center.x + radius * Math.cos(e), y: center.y + radius * Math.sin(e) },
  ];
  // Cardinal extrema (0, π/2, π, 3π/2 + 2πk) inside the span widen the bbox.
  const candidates = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];
  for (const c of candidates) {
    for (let k = -2; k <= 2; k++) {
      const a = c + k * Math.PI * 2;
      if (a >= s && a <= e) {
        points.push({ x: center.x + radius * Math.cos(a), y: center.y + radius * Math.sin(a) });
      }
    }
  }
  return envelope(points);
}

function bboxOfRotatedRectangle(r: {
  origin: Point2D;
  width: number;
  height: number;
  localAxisAngle: number;
}): BBox {
  const cos = Math.cos(r.localAxisAngle);
  const sin = Math.sin(r.localAxisAngle);
  // Four corners in local frame: (0,0), (w,0), (w,h), (0,h)
  const corners: Point2D[] = [
    { x: r.origin.x, y: r.origin.y },
    { x: r.origin.x + r.width * cos, y: r.origin.y + r.width * sin },
    {
      x: r.origin.x + r.width * cos - r.height * sin,
      y: r.origin.y + r.width * sin + r.height * cos,
    },
    { x: r.origin.x - r.height * sin, y: r.origin.y + r.height * cos },
  ];
  return envelope(corners);
}

/**
 * Bbox of a polyline segment between vertex K and K+1. Straight when
 * `bulge === 0`; arc-segment when bulge ≠ 0 (we expand to include the
 * arc's metric extent).
 */
function bboxOfPolylineSegment(p1: Point2D, p2: Point2D, bulge: number): BBox {
  if (bulge === 0) return envelope([p1, p2]);
  // Arc from p1 to p2 with included angle θ = 4·atan(bulge).
  const theta = 4 * Math.atan(bulge);
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const chord = Math.hypot(dx, dy);
  if (chord === 0) return envelope([p1, p2]);
  const sagitta = (bulge * chord) / 2;
  const radius = (chord / 2) ** 2 / (2 * sagitta) + sagitta / 2;
  // Center perpendicular to chord, offset on bulge side.
  const midX = (p1.x + p2.x) / 2;
  const midY = (p1.y + p2.y) / 2;
  const nx = -dy / chord;
  const ny = dx / chord;
  const sign = bulge >= 0 ? 1 : -1;
  const centerOffset = Math.sqrt(Math.max(radius * radius - (chord / 2) ** 2, 0)) * sign;
  const cx = midX + nx * centerOffset;
  const cy = midY + ny * centerOffset;
  // Compute start / end angles
  const startAngle = Math.atan2(p1.y - cy, p1.x - cx);
  const endAngle = startAngle + theta;
  return bboxOfArc({ center: { x: cx, y: cy }, radius: Math.abs(radius), startAngle, endAngle });
}

export function bboxOfPrimitive(p: Primitive): BBox | null {
  switch (p.kind) {
    case 'point':
      return { minX: p.position.x, minY: p.position.y, maxX: p.position.x, maxY: p.position.y };
    case 'line':
      return envelope([p.p1, p.p2]);
    case 'polyline': {
      // Walk segments, union their bboxes.
      let acc: BBox | null = null;
      const n = p.vertices.length;
      const segCount = p.closed ? n : n - 1;
      for (let k = 0; k < segCount; k++) {
        const a = p.vertices[k]!;
        const b = p.vertices[(k + 1) % n]!;
        const bulge = p.bulges[k] ?? 0;
        const bb = bboxOfPolylineSegment(a, b, bulge);
        if (!acc) acc = bb;
        else
          acc = {
            minX: Math.min(acc.minX, bb.minX),
            minY: Math.min(acc.minY, bb.minY),
            maxX: Math.max(acc.maxX, bb.maxX),
            maxY: Math.max(acc.maxY, bb.maxY),
          };
      }
      return acc ?? envelope(p.vertices);
    }
    case 'rectangle':
      return bboxOfRotatedRectangle(p);
    case 'circle':
      return {
        minX: p.center.x - p.radius,
        minY: p.center.y - p.radius,
        maxX: p.center.x + p.radius,
        maxY: p.center.y + p.radius,
      };
    case 'arc':
      return bboxOfArc(p as ArcPrimitive);
    case 'xline':
      // Infinite extent — not insertable into rbush.
      return null;
  }
}

/** Grids tile the viewport — they are not inserted into rbush. */
export function bboxOfGrid(_g: Grid): null {
  return null;
}
