// Pairwise primitive-intersection registry. Single dispatcher entry
// point + per-pair helpers + composite decomposition. Per the M1.3
// snap-engine-extension plan §2.1: per-pair switch table is the right
// shape for analytic primitive sets; the dispatcher unifies the API
// while the algebra remains irreducibly per-pair (line ∩ circle is a
// quadratic; circle ∩ circle is two-circle algebra; etc.).
//
// Architecture notes:
//   - `Segment` is an internal tuple (NOT a domain primitive). Used
//     for decomposition output (rectangle → 4 segments, polyline → N
//     segments) so algorithms can take simple `(p1, p2)` shapes
//     without fabricating fake `LinePrimitive` objects with no `id` /
//     `layerId` (Codex Round-1 H3 fix).
//   - `intersect(a, b)` handles distinct-primitive pairs.
//   - `selfIntersect(p)` handles single-primitive self-intersection
//     (composites only — atomic kinds return []). Required to
//     preserve the current osnap.ts:intersectionsOf flat-segment
//     iteration which captures polyline self-crossings.
//   - Xline and point are intentionally excluded — `intersect(xline,
//     X)` and `intersect(point, X)` always return [] (per A2 + A3 +
//     I-SNAP-4 in the plan).
//
// Phase 1 deliverable: dispatcher + lineLine algorithm + selfIntersect
// for polyline / rectangle. Phase 2 populates the table with circle
// pairs (lineCircle, circleCircle, lineArc, circleArc, arcArc).

import type { Point2D, Primitive } from '@portplanner/domain';

/**
 * Internal segment tuple used by composite-decomposition helpers and
 * lineLine algebra. Not a domain primitive — no id, no layerId, no
 * display fields. Local to this module; should not leak to callers.
 */
export interface Segment {
  p1: Point2D;
  p2: Point2D;
}

type Kind = Primitive['kind'];

/** Algorithm signature: takes two primitives narrowed by the dispatcher
 *  (or two segments for composite-decomposition fast paths) and
 *  returns the list of intersection points in metric coordinates.
 *  Empty array means "no intersection". */
type IntersectAlgo = (a: Primitive, b: Primitive) => Point2D[];

/**
 * line ∩ line — segment-clamped intersection in metric space.
 * Ported verbatim from the prior `osnap.ts:97-104` helper to keep
 * Phase 1's bit-identical behaviour guarantee. The clamp bounds
 * `t` and `u` to [0, 1] inclusive, so segments that share an
 * endpoint emit that shared endpoint as an intersection point —
 * documented behaviour preserved by the parity fixture battery.
 */
function lineLineIntersection(a1: Point2D, a2: Point2D, b1: Point2D, b2: Point2D): Point2D | null {
  const denom = (a1.x - a2.x) * (b1.y - b2.y) - (a1.y - a2.y) * (b1.x - b2.x);
  if (Math.abs(denom) < 1e-12) return null;
  const t = ((a1.x - b1.x) * (b1.y - b2.y) - (a1.y - b1.y) * (b1.x - b2.x)) / denom;
  const u = -((a1.x - a2.x) * (a1.y - b1.y) - (a1.y - a2.y) * (a1.x - b1.x)) / denom;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return { x: a1.x + t * (a2.x - a1.x), y: a1.y + t * (a2.y - a1.y) };
}

/** Algorithm wrapper for distinct-line pairs. */
function lineLine(a: Primitive, b: Primitive): Point2D[] {
  if (a.kind !== 'line' || b.kind !== 'line') return [];
  const ix = lineLineIntersection(a.p1, a.p2, b.p1, b.p2);
  return ix ? [ix] : [];
}

/**
 * Per-pair dispatcher table. Phase 1 registers `lineLine` only;
 * Phase 2 will populate circle / arc entries. Lookup is
 * `TABLE[a.kind]?.[b.kind]`. Swap-symmetry handled at the dispatcher
 * level — register `lineCircle` once and `intersect(circle, line)`
 * routes to it via arg-swap.
 */
const TABLE: Partial<Record<Kind, Partial<Record<Kind, IntersectAlgo>>>> = {
  line: {
    line: lineLine,
  },
};

/**
 * Decompose a rectangle to its 4 edge segments.
 *
 * Rectangle is defined by `origin`, `width`, `height`, `localAxisAngle`.
 * The 4 corners walk SW → SE → NE → NW (matching the gripsOf order in
 * grip-positions.ts:43-48). The 4 edges walk SW→SE, SE→NE, NE→NW,
 * NW→SW — closed loop.
 */
export function decomposeRect(rect: Primitive & { kind: 'rectangle' }): Segment[] {
  const cos = Math.cos(rect.localAxisAngle);
  const sin = Math.sin(rect.localAxisAngle);
  const corner = (du: number, dv: number): Point2D => ({
    x: rect.origin.x + du * cos - dv * sin,
    y: rect.origin.y + du * sin + dv * cos,
  });
  const sw = corner(0, 0);
  const se = corner(rect.width, 0);
  const ne = corner(rect.width, rect.height);
  const nw = corner(0, rect.height);
  return [
    { p1: sw, p2: se },
    { p1: se, p2: ne },
    { p1: ne, p2: nw },
    { p1: nw, p2: sw },
  ];
}

/**
 * Decompose a polyline to its N (open) or N (closed) edge segments.
 * Bulged segments (bulge != 0) are included as straight segments at
 * the moment — bulge-arc intersection deferred (matches the existing
 * osnap.ts behaviour which excludes bulged segments from the flat
 * intersection list; this preserves that exclusion via filter).
 */
export function decomposePoly(poly: Primitive & { kind: 'polyline' }): Segment[] {
  const out: Segment[] = [];
  const n = poly.vertices.length;
  if (n < 2) return out;
  const segCount = poly.closed ? n : n - 1;
  for (let k = 0; k < segCount; k++) {
    // Match the M1.3a polyline contract: only zero-bulge segments
    // contribute to intersection candidates. Bulge-arc intersection
    // lands with the broader arc-X work in Phase 2 (this Phase 1
    // refactor preserves the current zero-bulge-only behaviour).
    if ((poly.bulges[k] ?? 0) !== 0) continue;
    out.push({
      p1: poly.vertices[k]!,
      p2: poly.vertices[(k + 1) % n]!,
    });
  }
  return out;
}

/**
 * Pairwise intersect all segments in `as` against all segments in
 * `bs`. Used by composite-pair dispatch (rect × line, poly × poly,
 * etc.) and by `selfIntersect` for composites.
 */
function segmentsCross(as: Segment[], bs: Segment[]): Point2D[] {
  const out: Point2D[] = [];
  for (const a of as) {
    for (const b of bs) {
      const ix = lineLineIntersection(a.p1, a.p2, b.p1, b.p2);
      if (ix) out.push(ix);
    }
  }
  return out;
}

/**
 * Pairwise intersect all unique pairs within a single segment list
 * (i < j). Used by `selfIntersect` for composites — captures
 * polyline self-crossings without duplicating the trivial (i, i)
 * self-pair.
 */
function segmentsSelfCross(segs: Segment[]): Point2D[] {
  const out: Point2D[] = [];
  for (let i = 0; i < segs.length; i++) {
    for (let j = i + 1; j < segs.length; j++) {
      const ix = lineLineIntersection(segs[i]!.p1, segs[i]!.p2, segs[j]!.p1, segs[j]!.p2);
      if (ix) out.push(ix);
    }
  }
  return out;
}

/**
 * Distinct-primitive pair intersection. Returns the list of
 * intersection points in metric coordinates. Composites (rectangle,
 * polyline) decompose to segments BEFORE reaching the table.
 *
 * Type safety: TypeScript narrows `a.kind` per branch when the
 * dispatcher is exhaustively case-switched. The table lookup with
 * fallback to swap covers symmetric pairs (e.g. lineCircle handles
 * both `intersect(line, circle)` and `intersect(circle, line)`).
 *
 * Pairs not in the table return `[]` — explicit no-op (xline ∩ X,
 * point ∩ X, plus pairs deferred by the §4.0.1 supported-pair matrix
 * to a future phase).
 */
export function intersect(a: Primitive, b: Primitive): Point2D[] {
  // Composite decomposition: rectangle / polyline → segments → segment
  // pairs. Decompose `a` first; if `b` is also composite, decompose it
  // and run all-vs-all. Atomic-on-atomic falls through to the table.
  if (a.kind === 'rectangle' || a.kind === 'polyline') {
    const aSegs = a.kind === 'rectangle' ? decomposeRect(a) : decomposePoly(a);
    if (b.kind === 'rectangle' || b.kind === 'polyline') {
      const bSegs = b.kind === 'rectangle' ? decomposeRect(b) : decomposePoly(b);
      return segmentsCross(aSegs, bSegs);
    }
    if (b.kind === 'line') {
      // Each rect/poly segment vs the line.
      return segmentsCross(aSegs, [{ p1: b.p1, p2: b.p2 }]);
    }
    // a-composite vs other atomic (circle / arc / point / xline).
    // Phase 1: only line is registered. Future phases register circle
    // / arc and the per-segment dispatch lands here naturally.
    return [];
  }
  // Symmetric: b-composite vs a-atomic. Swap and recurse.
  if (b.kind === 'rectangle' || b.kind === 'polyline') {
    return intersect(b, a);
  }

  // Atomic-on-atomic: direct table lookup with swap fallback.
  const direct = TABLE[a.kind]?.[b.kind];
  if (direct) return direct(a, b);
  const swapped = TABLE[b.kind]?.[a.kind];
  if (swapped) return swapped(b, a);
  return [];
}

/**
 * Single-primitive self-intersection. Returns intersection points
 * within the primitive itself. Atomic kinds (line, circle, arc,
 * point, xline) return `[]` — no concept of self-intersection.
 *
 * Composites:
 *   - Polyline: pairwise iterate decomposed segments. A figure-8
 *     polyline emits the cross point. Adjacent segments emit their
 *     shared vertex (preserves the current osnap.ts behaviour where
 *     `t` and `u` clamps are inclusive at 0 and 1).
 *   - Rectangle: 4 edges, adjacent pairs share corners. Each shared
 *     corner emits as an intersection point — preserves the current
 *     behaviour where rectangles weren't explicitly decomposed but
 *     polyline closed-square equivalents would emit corners. (For
 *     a non-self-crossing rectangle, the only intersections are the
 *     4 corners; opposite-edge pairs don't intersect.)
 */
export function selfIntersect(p: Primitive): Point2D[] {
  switch (p.kind) {
    case 'polyline':
      return segmentsSelfCross(decomposePoly(p));
    case 'rectangle':
      return segmentsSelfCross(decomposeRect(p));
    default:
      return [];
  }
}
