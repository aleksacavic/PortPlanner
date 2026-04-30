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

import { gripsOf } from '../canvas/grip-positions';
import { intersect, selfIntersect } from './intersection';

export type OsnapKind = 'endpoint' | 'midpoint' | 'intersection' | 'node' | 'quadrant';

export interface OsnapCandidate {
  kind: OsnapKind;
  point: Point2D;
}

function midpoint(a: Point2D, b: Point2D): Point2D {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/**
 * Phase 2 SSOT (I-SNAP-1): map a `gripsOf(primitive)` entry's
 * `gripKind` string to its OSNAP kind. Returns null for grip kinds
 * that are not snap targets (e.g. xline `'pivot'`/`'direction'` per
 * A2). The Rev-3 / Codex Round-1 B2 fix: point primitive's
 * `'position'` maps to `'endpoint'` (preserves the prior osnap.ts
 * behaviour where `endpointsOf(point)` returned the position; locked
 * by REM8-P2-PointKindPreserved + I-SNAP-5).
 */
function gripKindToOsnapKind(
  primitiveKind: Primitive['kind'],
  gripKind: string,
  isClosedPolyline: boolean,
): OsnapKind | null {
  switch (primitiveKind) {
    case 'line':
      return gripKind === 'p1' || gripKind === 'p2' ? 'endpoint' : null;
    case 'rectangle':
      // 4 corners → endpoint.
      return gripKind.startsWith('corner-') ? 'endpoint' : null;
    case 'polyline': {
      // Open polyline: first / last vertex → endpoint; interior → node.
      // Closed polyline: every vertex is a node (no endpoints by I-DTP-7
      // logic in `endpointsOf`).
      if (!gripKind.startsWith('vertex-')) return null;
      const idx = Number.parseInt(gripKind.slice('vertex-'.length), 10);
      if (Number.isNaN(idx)) return null;
      if (isClosedPolyline) return 'node';
      // Open: idx === 0 OR idx === N-1 → endpoint; otherwise node.
      // We don't know N here — caller injects it. Use a sentinel pair
      // resolved at the call site (see gatherOsnapCandidates below).
      return null;
    }
    case 'arc':
      if (gripKind === 'start' || gripKind === 'end') return 'endpoint';
      if (gripKind === 'mid') return 'midpoint';
      return null;
    case 'circle':
      if (gripKind === 'center') return 'node';
      if (
        gripKind === 'east' ||
        gripKind === 'north' ||
        gripKind === 'west' ||
        gripKind === 'south'
      )
        return 'quadrant';
      return null;
    case 'point':
      // Codex Round-1 B2 fix: point primitive's `'position'` snaps as
      // `'endpoint'`, NOT `'node'`. Locked by I-SNAP-5 +
      // REM8-P2-PointKindPreserved.
      return gripKind === 'position' ? 'endpoint' : null;
    case 'xline':
      // A2: xline gets no snap glyph — both `'pivot'` and `'direction'`
      // grip kinds map to null.
      return null;
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
      const cos = Math.cos(p.localAxisAngle);
      const sin = Math.sin(p.localAxisAngle);
      const corner = (du: number, dv: number): Point2D => ({
        x: p.origin.x + du * cos - dv * sin,
        y: p.origin.y + du * sin + dv * cos,
      });
      const sw = corner(0, 0);
      const se = corner(p.width, 0);
      const ne = corner(p.width, p.height);
      const nw = corner(0, p.height);
      return [midpoint(sw, se), midpoint(se, ne), midpoint(ne, nw), midpoint(nw, sw)];
    }
    default:
      return [];
  }
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

/**
 * Returns all OSNAP candidates for the given primitive list.
 *
 * Phase 2 (snap-engine-extension): endpoint / node / quadrant
 * candidates source from `gripsOf(primitive)` per I-SNAP-1 SSOT.
 * Midpoints are produced separately via `midpointsOf()` (per A4
 * carveout — line/rect-edge/polyline-segment midpoints are NOT
 * grips today). Intersections route through the dispatcher via
 * `intersectionsOf`.
 */
export function gatherOsnapCandidates(primitives: Primitive[]): OsnapCandidate[] {
  const out: OsnapCandidate[] = [];
  for (const p of primitives) {
    // Endpoint / node / quadrant — via gripsOf SSOT.
    const grips = gripsOf(p);
    const isClosedPoly = p.kind === 'polyline' && p.closed;
    const polyN = p.kind === 'polyline' ? p.vertices.length : 0;
    for (const grip of grips) {
      // Polyline endpoints (open) need the per-vertex index handled at
      // the call site since `gripKindToOsnapKind` doesn't know N.
      if (p.kind === 'polyline' && grip.gripKind.startsWith('vertex-')) {
        const idx = Number.parseInt(grip.gripKind.slice('vertex-'.length), 10);
        if (Number.isNaN(idx)) continue;
        if (isClosedPoly) {
          out.push({ kind: 'node', point: grip.position });
        } else if (idx === 0 || idx === polyN - 1) {
          out.push({ kind: 'endpoint', point: grip.position });
        } else {
          out.push({ kind: 'node', point: grip.position });
        }
        continue;
      }
      const kind = gripKindToOsnapKind(p.kind, grip.gripKind, isClosedPoly);
      if (kind) out.push({ kind, point: grip.position });
    }
    // Midpoints — A4 carveout, separate path.
    for (const pt of midpointsOf(p)) out.push({ kind: 'midpoint', point: pt });
  }
  // Intersections via dispatcher (Phase 1 refactor preserved).
  for (const pt of intersectionsOf(primitives)) {
    out.push({ kind: 'intersection', point: pt });
  }
  return out;
}
