// OSNAP candidate generators per ADR-016. M1.3a subset:
//   - endpoint (per primitive: line p1/p2, polyline ends, rect corners,
//     arc start/end)
//   - midpoint (line, polyline segments, rect edges)
//   - intersection (line/line; line/circle, line/arc, circle/arc deferred)
//   - node (polyline vertices, point primitive position)
// Remaining modes (center, perpendicular, tangent, etc.) → M1.3c.

import type { Point2D, Primitive } from '@portplanner/domain';

export type OsnapKind = 'endpoint' | 'midpoint' | 'intersection' | 'node';

export interface OsnapCandidate {
  kind: OsnapKind;
  point: Point2D;
}

function midpoint(a: Point2D, b: Point2D): Point2D {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/** Endpoints of a primitive (excluding closed polylines, which loop). */
function endpointsOf(p: Primitive): Point2D[] {
  switch (p.kind) {
    case 'point':
      return [p.position];
    case 'line':
      return [p.p1, p.p2];
    case 'polyline':
      if (p.closed) return [];
      return [p.vertices[0]!, p.vertices[p.vertices.length - 1]!];
    case 'rectangle': {
      const cos = Math.cos(p.localAxisAngle);
      const sin = Math.sin(p.localAxisAngle);
      return [
        { x: p.origin.x, y: p.origin.y },
        { x: p.origin.x + p.width * cos, y: p.origin.y + p.width * sin },
        {
          x: p.origin.x + p.width * cos - p.height * sin,
          y: p.origin.y + p.width * sin + p.height * cos,
        },
        { x: p.origin.x - p.height * sin, y: p.origin.y + p.height * cos },
      ];
    }
    case 'arc': {
      const startX = p.center.x + p.radius * Math.cos(p.startAngle);
      const startY = p.center.y + p.radius * Math.sin(p.startAngle);
      const endX = p.center.x + p.radius * Math.cos(p.endAngle);
      const endY = p.center.y + p.radius * Math.sin(p.endAngle);
      return [
        { x: startX, y: startY },
        { x: endX, y: endY },
      ];
    }
    case 'circle':
    case 'xline':
      return [];
  }
}

/** Midpoints of bounded segments. Polyline yields per-segment midpoints. */
function midpointsOf(p: Primitive): Point2D[] {
  switch (p.kind) {
    case 'line':
      return [midpoint(p.p1, p.p2)];
    case 'polyline': {
      const out: Point2D[] = [];
      const n = p.vertices.length;
      const segCount = p.closed ? n : n - 1;
      for (let k = 0; k < segCount; k++) {
        out.push(midpoint(p.vertices[k]!, p.vertices[(k + 1) % n]!));
      }
      return out;
    }
    case 'rectangle': {
      const corners = endpointsOf(p);
      return [
        midpoint(corners[0]!, corners[1]!),
        midpoint(corners[1]!, corners[2]!),
        midpoint(corners[2]!, corners[3]!),
        midpoint(corners[3]!, corners[0]!),
      ];
    }
    default:
      return [];
  }
}

/** Polyline vertices (node osnap) + standalone point primitives. */
function nodesOf(p: Primitive): Point2D[] {
  if (p.kind === 'polyline') return p.vertices.slice();
  if (p.kind === 'point') return [p.position];
  return [];
}

/** Line-line intersection in metric, or null if parallel / coincident. */
function lineLineIntersection(a1: Point2D, a2: Point2D, b1: Point2D, b2: Point2D): Point2D | null {
  const denom = (a1.x - a2.x) * (b1.y - b2.y) - (a1.y - a2.y) * (b1.x - b2.x);
  if (Math.abs(denom) < 1e-12) return null;
  const t = ((a1.x - b1.x) * (b1.y - b2.y) - (a1.y - b1.y) * (b1.x - b2.x)) / denom;
  const u = -((a1.x - a2.x) * (a1.y - b1.y) - (a1.y - a2.y) * (a1.x - b1.x)) / denom;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return { x: a1.x + t * (a2.x - a1.x), y: a1.y + t * (a2.y - a1.y) };
}

/** Pairwise line/line intersections within a candidate primitive list. */
function intersectionsOf(primitives: Primitive[]): Point2D[] {
  const segments: Array<[Point2D, Point2D]> = [];
  for (const p of primitives) {
    if (p.kind === 'line') segments.push([p.p1, p.p2]);
    else if (p.kind === 'polyline') {
      const n = p.vertices.length;
      const segCount = p.closed ? n : n - 1;
      for (let k = 0; k < segCount; k++) {
        // Bulge-arc intersections deferred to M1.3c.
        if ((p.bulges[k] ?? 0) === 0) {
          segments.push([p.vertices[k]!, p.vertices[(k + 1) % n]!]);
        }
      }
    }
  }
  const out: Point2D[] = [];
  for (let i = 0; i < segments.length; i++) {
    for (let j = i + 1; j < segments.length; j++) {
      const ix = lineLineIntersection(
        segments[i]![0],
        segments[i]![1],
        segments[j]![0],
        segments[j]![1],
      );
      if (ix) out.push(ix);
    }
  }
  return out;
}

/** Returns all OSNAP candidates for the given primitive list (M1.3a subset). */
export function gatherOsnapCandidates(primitives: Primitive[]): OsnapCandidate[] {
  const out: OsnapCandidate[] = [];
  for (const p of primitives) {
    for (const pt of endpointsOf(p)) out.push({ kind: 'endpoint', point: pt });
    for (const pt of midpointsOf(p)) out.push({ kind: 'midpoint', point: pt });
    for (const pt of nodesOf(p)) out.push({ kind: 'node', point: pt });
  }
  for (const pt of intersectionsOf(primitives)) {
    out.push({ kind: 'intersection', point: pt });
  }
  return out;
}
