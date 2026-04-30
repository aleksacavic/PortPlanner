// OSNAP candidate generators per ADR-016. M1.3a subset:
//   - endpoint (per primitive: line p1/p2, polyline ends, rect corners,
//     arc start/end)
//   - midpoint (line, polyline segments, rect edges)
//   - intersection (line/line; line/circle, line/arc, circle/arc deferred
//     — Phase 1 of the snap-engine-extension plan registers lineLine
//     only; circle pairs land in Phase 2)
//   - node (polyline vertices, point primitive position)
// Remaining modes (center, perpendicular, tangent, etc.) → M1.3c.
//
// Phase 1 (snap-engine-extension) refactor: `intersectionsOf` now
// delegates pairwise primitive intersection to the new
// `packages/editor-2d/src/snap/intersection.ts` registry. The inline
// `lineLineIntersection` helper that lived here has moved to that
// module per I-SNAP-3 (intersection dispatcher SSOT). Composite
// decomposition (rectangle, polyline) and self-intersection
// (`selfIntersect`) are owned by the new module.

import type { Point2D, Primitive } from '@portplanner/domain';

import { intersect, selfIntersect } from './intersection';

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

/**
 * Pairwise primitive intersections via the dispatcher registry.
 *
 * Phase 1 refactor: replaces the prior flat-segment S² iteration
 * (which hard-coded `lineLineIntersection` inline) with N + N(N-1)/2
 * calls into the registry — `selfIntersect(p_i)` for composites'
 * internal crossings + `intersect(p_i, p_j)` for distinct-primitive
 * pairs. The dispatcher handles composite decomposition (rectangle,
 * polyline) internally.
 *
 * Phase 1 only registers `lineLine` in the dispatcher table; circle
 * and arc pairs return [] until Phase 2 populates them. Behaviour for
 * line-line pairs (the only currently-supported intersection in
 * `osnap.ts`) is bit-identical — locked by the F1–F4 parity fixtures
 * in `tests/intersection.parity.test.ts`.
 */
function intersectionsOf(primitives: Primitive[]): Point2D[] {
  const out: Point2D[] = [];
  for (let i = 0; i < primitives.length; i++) {
    const p = primitives[i]!;
    out.push(...selfIntersect(p));
    for (let j = i + 1; j < primitives.length; j++) {
      out.push(...intersect(p, primitives[j]!));
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
