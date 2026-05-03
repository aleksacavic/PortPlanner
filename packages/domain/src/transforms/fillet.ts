// M1.3b fillet-chamfer Phase 1 — Fillet domain helpers.
// Pure domain functions; no React, no store, no design-system imports
// (per I-MOD-1 / I-FC-1 invariant).
//
// Three pair types per the plan §6.1.0 decision table:
//   - filletTwoLines(l1, l2, radius, pickHints)
//   - filletPolylineCorner(p, vertexIdx, radius)
//   - filletLineAndPolylineEndpoint(line, lineHint, polyline, polylineEndpoint, radius)
//
// Geometry per ADR-016 Appendix A (with θ measured as the INTERIOR
// corner angle between the kept legs):
//   d = R / tan(θ/2)         trim distance from corner along each leg
//                            (equiv: R · cot(θ/2))
//   bulge = tan((π−θ)/4)     polyline bulge encoding for the arc
//                            (the arc subtends the SUPPLEMENT of θ —
//                            a.k.a. the turn angle in ADR-016 Appendix A's
//                            formulation; both yield identical values
//                            at θ=90° but diverge for other angles).
// where θ is the interior angle at the corner (0 < θ < π).
//
// PickHint convention (AC parity): the kept endpoint of a line is the
// one CLOSER to its pick hint. The user clicks near the side they want
// to keep; the opposite end is trimmed. Plan §6.1.0 wording was
// ambiguous on this point — codifying AC convention here so the X-cross
// quadrant case behaves intuitively.

import type { ArcPrimitive, LinePrimitive, Point2D, PolylinePrimitive } from '../types/primitive';

const PARALLEL_EPSILON = 1e-9;

/** Geometry of a fillet arc to be created. Caller provides id/layerId/
 *  displayOverrides at addPrimitive time. */
export type FilletArcGeometry = Omit<ArcPrimitive, 'id' | 'layerId' | 'displayOverrides'>;

export interface FilletTwoLinesResult {
  l1Updated: LinePrimitive;
  l2Updated: LinePrimitive;
  newArc: FilletArcGeometry;
}

export interface FilletLinePolylineResult {
  lineUpdated: LinePrimitive;
  polylineUpdated: PolylinePrimitive;
  newArc: FilletArcGeometry;
}

function distance(a: Point2D, b: Point2D): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function unit(from: Point2D, to: Point2D): Point2D {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) throw new Error('fillet: zero-length direction vector');
  return { x: dx / len, y: dy / len };
}

/** Infinite-line intersection. Returns null if parallel. */
function lineIntersection(p1: Point2D, p2: Point2D, p3: Point2D, p4: Point2D): Point2D | null {
  const dx1 = p2.x - p1.x;
  const dy1 = p2.y - p1.y;
  const dx2 = p4.x - p3.x;
  const dy2 = p4.y - p3.y;
  const det = dx1 * dy2 - dy1 * dx2;
  if (Math.abs(det) < PARALLEL_EPSILON) return null;
  const tNum = (p3.x - p1.x) * dy2 - (p3.y - p1.y) * dx2;
  const t = tNum / det;
  return { x: p1.x + t * dx1, y: p1.y + t * dy1 };
}

/** Core geometry: given the corner C and unit vectors u1, u2 from corner
 *  toward each kept endpoint, compute the two new trimmed endpoints, the
 *  arc center, and the arc start/end angles such that endAngle > startAngle
 *  (per ArcPrimitive.endAngle JSDoc convention) and the arc sweep is the
 *  short side (< π). */
function arcGeometryFromCorner(
  corner: Point2D,
  u1: Point2D,
  u2: Point2D,
  radius: number,
): {
  t1New: Point2D;
  t2New: Point2D;
  arcCenter: Point2D;
  arcStartAngle: number;
  arcEndAngle: number;
  trimDistance: number;
} {
  const dot = u1.x * u2.x + u1.y * u2.y;
  const theta = Math.acos(Math.max(-1, Math.min(1, dot)));
  if (theta < PARALLEL_EPSILON || Math.abs(theta - Math.PI) < PARALLEL_EPSILON) {
    throw new Error('fillet: parallel lines cannot be filleted');
  }
  // d = R · cot(θ/2) where θ is the INTERIOR corner angle between u1,u2.
  // Derivation: in the right triangle (corner, arc center, tangent point),
  // the angle at the corner is θ/2, the side opposite is R (perpendicular
  // radius), and the side adjacent (along the leg) is d. So tan(θ/2)=R/d,
  // giving d=R/tan(θ/2). At θ=90° this collapses to d=R, but for other
  // angles the formula d=R·tan(θ/2) is inverted and produces an arc
  // center NOT equidistant from the tangent points (visible as the
  // arc-misalignment bug).
  const trimDistance = radius / Math.tan(theta / 2);
  const t1New = { x: corner.x + u1.x * trimDistance, y: corner.y + u1.y * trimDistance };
  const t2New = { x: corner.x + u2.x * trimDistance, y: corner.y + u2.y * trimDistance };

  // Bisector toward arc center.
  const bx = u1.x + u2.x;
  const by = u1.y + u2.y;
  const blen = Math.hypot(bx, by);
  const bux = bx / blen;
  const buy = by / blen;
  const bisectorDist = radius / Math.sin(theta / 2);
  const arcCenter = {
    x: corner.x + bux * bisectorDist,
    y: corner.y + buy * bisectorDist,
  };

  // Arc start/end angles. Sweep is always the short side (< π) by
  // construction (theta is the interior corner angle).
  let arcStartAngle = Math.atan2(t1New.y - arcCenter.y, t1New.x - arcCenter.x);
  let arcEndAngle = Math.atan2(t2New.y - arcCenter.y, t2New.x - arcCenter.x);
  // Normalize so endAngle > startAngle and the sweep is the short side.
  let sweep = arcEndAngle - arcStartAngle;
  // Bring into (-π, π].
  while (sweep > Math.PI) sweep -= 2 * Math.PI;
  while (sweep <= -Math.PI) sweep += 2 * Math.PI;
  if (sweep < 0) {
    // Swap so we sweep the short side CCW.
    [arcStartAngle, arcEndAngle] = [arcEndAngle, arcStartAngle];
    sweep = -sweep;
  }
  // Ensure endAngle = startAngle + sweep (positive).
  arcEndAngle = arcStartAngle + sweep;
  return { t1New, t2New, arcCenter, arcStartAngle, arcEndAngle, trimDistance };
}

/**
 * Fillet two LinePrimitives.
 *
 * `pickHints.p1Hint` and `p2Hint` are points (typically the user's click
 * locations on each line) used to disambiguate which endpoint of each
 * line is kept. The kept endpoint is the one CLOSER to its hint. The
 * opposite endpoint is trimmed inward by `d = R·tan(θ/2)`. A new arc
 * is added between the trimmed endpoints, tangent to both lines.
 *
 * Throws on:
 *   - radius ≤ 0
 *   - parallel lines
 *   - trim distance ≥ available segment length on either side
 */
export function filletTwoLines(
  l1: LinePrimitive,
  l2: LinePrimitive,
  radius: number,
  pickHints: { p1Hint: Point2D; p2Hint: Point2D },
): FilletTwoLinesResult {
  if (radius <= 0) throw new Error('filletTwoLines: radius must be > 0');

  // Resolve kept (K) vs trimmed (T) endpoints per AC convention.
  const k1IsP1 = distance(l1.p1, pickHints.p1Hint) <= distance(l1.p2, pickHints.p1Hint);
  const k1 = k1IsP1 ? l1.p1 : l1.p2;
  const k2IsP1 = distance(l2.p1, pickHints.p2Hint) <= distance(l2.p2, pickHints.p2Hint);
  const k2 = k2IsP1 ? l2.p1 : l2.p2;

  // Infinite-line intersection.
  const corner = lineIntersection(l1.p1, l1.p2, l2.p1, l2.p2);
  if (!corner) throw new Error('filletTwoLines: parallel lines cannot be filleted');

  // Direction from corner toward each kept endpoint.
  const u1 = unit(corner, k1);
  const u2 = unit(corner, k2);

  const { t1New, t2New, arcCenter, arcStartAngle, arcEndAngle, trimDistance } =
    arcGeometryFromCorner(corner, u1, u2, radius);

  if (trimDistance >= distance(corner, k1) || trimDistance >= distance(corner, k2)) {
    throw new Error('filletTwoLines: trim distance exceeds source segment length');
  }

  const l1Updated: LinePrimitive = k1IsP1 ? { ...l1, p2: t1New } : { ...l1, p1: t1New };
  const l2Updated: LinePrimitive = k2IsP1 ? { ...l2, p2: t2New } : { ...l2, p1: t2New };

  return {
    l1Updated,
    l2Updated,
    newArc: {
      kind: 'arc',
      center: arcCenter,
      radius,
      startAngle: arcStartAngle,
      endAngle: arcEndAngle,
    },
  };
}

/**
 * Fillet an interior corner of a polyline (vertex `vertexIdx` with two
 * adjacent segments). Replaces vertex K with two new vertices P1 / P2
 * and writes bulge `tan(θ/4)` to `bulges[vertexIdx]` (or the appropriate
 * post-insertion index).
 *
 * Throws on:
 *   - radius ≤ 0
 *   - vertex has only one adjacent segment (open polyline endpoint vertex)
 *   - either adjacent segment is already curved (non-zero bulge)
 *   - trim distance ≥ adjacent segment length
 */
export function filletPolylineCorner(
  p: PolylinePrimitive,
  vertexIdx: number,
  radius: number,
): PolylinePrimitive {
  if (radius <= 0) throw new Error('filletPolylineCorner: radius must be > 0');
  const n = p.vertices.length;
  if (n < 2) throw new Error('filletPolylineCorner: polyline must have ≥ 2 vertices');

  // Determine adjacent vertex indices. Open polylines: only interior
  // vertices (1 ≤ K ≤ N-2) qualify. Closed polylines: any K (wrap-around).
  let prevIdx: number;
  let nextIdx: number;
  let prevSegBulgeIdx: number; // bulges index for segment (prev → K)
  let nextSegBulgeIdx: number; // bulges index for segment (K → next)
  if (p.closed) {
    if (vertexIdx < 0 || vertexIdx >= n) {
      throw new Error('filletPolylineCorner: vertexIdx out of range');
    }
    prevIdx = (vertexIdx - 1 + n) % n;
    nextIdx = (vertexIdx + 1) % n;
    // Closed polyline bulges: bulges[k] is the bulge for segment (k → k+1)
    // (with wrap, last segment is N-1 → 0). So segment (prev → K) has
    // bulges[prevIdx]; segment (K → next) has bulges[vertexIdx].
    prevSegBulgeIdx = prevIdx;
    nextSegBulgeIdx = vertexIdx;
  } else {
    if (vertexIdx <= 0 || vertexIdx >= n - 1) {
      throw new Error('filletPolylineCorner: open polyline endpoint vertex has no corner');
    }
    prevIdx = vertexIdx - 1;
    nextIdx = vertexIdx + 1;
    // Open polyline bulges: bulges[k] is the bulge for segment (k → k+1).
    // Segment (prev → K) is bulges[prevIdx]; segment (K → next) is bulges[vertexIdx].
    prevSegBulgeIdx = prevIdx;
    nextSegBulgeIdx = vertexIdx;
  }

  // Reject curved adjacent segments — V1 only fillets corners between
  // straight polyline segments. Filleting a corner with an already-curved
  // adjacent segment is a separate decision.
  const prevBulge = p.bulges[prevSegBulgeIdx] ?? 0;
  const nextBulge = p.bulges[nextSegBulgeIdx] ?? 0;
  if (prevBulge !== 0 || nextBulge !== 0) {
    throw new Error(
      'filletPolylineCorner: adjacent segment already curved (bulged) — V1 supports straight-segment corners only',
    );
  }

  const k = p.vertices[vertexIdx]!;
  const prev = p.vertices[prevIdx]!;
  const next = p.vertices[nextIdx]!;

  // Direction from K toward each adjacent vertex.
  const uPrev = unit(k, prev);
  const uNext = unit(k, next);

  // Interior corner angle.
  const dot = uPrev.x * uNext.x + uPrev.y * uNext.y;
  const theta = Math.acos(Math.max(-1, Math.min(1, dot)));
  if (theta < PARALLEL_EPSILON || Math.abs(theta - Math.PI) < PARALLEL_EPSILON) {
    throw new Error('filletPolylineCorner: adjacent segments are collinear (no corner to fillet)');
  }

  // d = R · cot(θ/2) — see arcGeometryFromCorner for derivation.
  const trimDistance = radius / Math.tan(theta / 2);
  if (trimDistance >= distance(k, prev) || trimDistance >= distance(k, next)) {
    throw new Error('filletPolylineCorner: trim distance exceeds adjacent segment length');
  }

  // New vertices replacing K.
  const p1 = { x: k.x + uPrev.x * trimDistance, y: k.y + uPrev.y * trimDistance };
  const p2 = { x: k.x + uNext.x * trimDistance, y: k.y + uNext.y * trimDistance };

  // Bulge sign: positive if turn is CCW (right-handed), negative if CW.
  // Cross product (uPrev × uNext) sign tells us the turn direction.
  // BUT: bulge is for the segment P1 → P2 (in the new vertex order). The
  // arc goes from P1 to P2 around K's "outside" — the side opposite the
  // corner. Let's compute the cross product in the original walking
  // direction (prev → K → next).
  // Walking: from prev to K is direction (K - prev). From K to next is
  // (next - K). Turn direction = cross product of these.
  const walkInX = k.x - prev.x;
  const walkInY = k.y - prev.y;
  const walkOutX = next.x - k.x;
  const walkOutY = next.y - k.y;
  const cross = walkInX * walkOutY - walkInY * walkOutX;
  // Positive cross = CCW turn (left turn) = positive bulge.
  // Negative cross = CW turn (right turn) = negative bulge.
  // bulge = tan((π−θ)/4) where θ is the interior corner angle. The arc
  // subtends the supplement (turn angle = π−θ); ADR-016 Appendix A's
  // formula uses the turn angle directly. At θ=90° this collapses to
  // tan(π/8); for other angles tan(θ/4) is wrong.
  const bulgeMagnitude = Math.tan((Math.PI - theta) / 4);
  const bulge = cross >= 0 ? bulgeMagnitude : -bulgeMagnitude;

  // Compose new vertices array: replace K with [P1, P2].
  const newVertices = [
    ...p.vertices.slice(0, vertexIdx),
    p1,
    p2,
    ...p.vertices.slice(vertexIdx + 1),
  ];

  // Compose new bulges array. Original length is N-1 (open) or N (closed).
  // After insertion, vertex count is N+1, so bulges length is N (open) or
  // N+1 (closed). The new bulge for segment (P1 → P2) is inserted at
  // index `vertexIdx` (the position formerly held by the segment K → next).
  // Segments before vertexIdx (i.e., 0..vertexIdx-1) are unchanged. The
  // segment (prev → K) is now (prev → P1) and keeps its original bulge
  // (which is 0 by the V1 invariant we just checked). The new segment
  // (P1 → P2) is the arc. The segment (P2 → next) keeps the original
  // (K → next) bulge (also 0). Everything past stays.
  const newBulges = [...p.bulges.slice(0, vertexIdx), bulge, ...p.bulges.slice(vertexIdx)];

  return {
    ...p,
    vertices: newVertices,
    bulges: newBulges,
  };
}

/**
 * Fillet a Line + open Polyline endpoint segment.
 *
 * `polylineEndpoint` selects which polyline end is at the corner:
 *   `0`  → vertex 0 (first segment is from v0 to v1)
 *   `-1` → vertex N-1 (last segment is from v_{N-2} to v_{N-1})
 *
 * Trims the line's pick-hint side, moves the polyline endpoint vertex
 * inward along its adjacent segment, adds a new ArcPrimitive bridging
 * the two new endpoints.
 *
 * Throws on:
 *   - radius ≤ 0
 *   - polyline is closed (closed polylines have no endpoint)
 *   - the adjacent polyline segment is already curved
 *   - parallel line and polyline-segment
 *   - trim distance ≥ available segment length
 */
export function filletLineAndPolylineEndpoint(
  line: LinePrimitive,
  lineHint: Point2D,
  polyline: PolylinePrimitive,
  polylineEndpoint: 0 | -1,
  radius: number,
): FilletLinePolylineResult {
  if (radius <= 0) {
    throw new Error('filletLineAndPolylineEndpoint: radius must be > 0');
  }
  if (polyline.closed) {
    throw new Error(
      'filletLineAndPolylineEndpoint: polyline must be open (closed polylines have no endpoint)',
    );
  }
  const n = polyline.vertices.length;
  if (n < 2) {
    throw new Error('filletLineAndPolylineEndpoint: polyline must have ≥ 2 vertices');
  }

  const endpointIdx = polylineEndpoint === 0 ? 0 : n - 1;
  const adjacentIdx = polylineEndpoint === 0 ? 1 : n - 2;
  const adjacentSegBulgeIdx = polylineEndpoint === 0 ? 0 : n - 2;
  const endpointBulge = polyline.bulges[adjacentSegBulgeIdx] ?? 0;
  if (endpointBulge !== 0) {
    throw new Error(
      'filletLineAndPolylineEndpoint: adjacent polyline segment already curved — V1 supports straight-segment corners only',
    );
  }

  const polyEnd = polyline.vertices[endpointIdx]!;
  const polyAdj = polyline.vertices[adjacentIdx]!;

  // Resolve kept (K) vs trimmed (T) for the line.
  const lineKIsP1 = distance(line.p1, lineHint) <= distance(line.p2, lineHint);
  const lineK = lineKIsP1 ? line.p1 : line.p2;

  // Corner = infinite-line intersection of (line) and (polyline endpoint segment).
  const corner = lineIntersection(line.p1, line.p2, polyEnd, polyAdj);
  if (!corner) {
    throw new Error('filletLineAndPolylineEndpoint: line and polyline-segment are parallel');
  }

  // Unit vectors from corner toward kept side of each segment.
  const uLine = unit(corner, lineK);
  const uPoly = unit(corner, polyAdj);

  const { t1New, t2New, arcCenter, arcStartAngle, arcEndAngle, trimDistance } =
    arcGeometryFromCorner(corner, uLine, uPoly, radius);

  if (trimDistance >= distance(corner, lineK) || trimDistance >= distance(corner, polyAdj)) {
    throw new Error('filletLineAndPolylineEndpoint: trim distance exceeds source segment length');
  }

  // Updated line: trimmed at the side opposite lineK.
  const lineUpdated: LinePrimitive = lineKIsP1 ? { ...line, p2: t1New } : { ...line, p1: t1New };

  // Updated polyline: endpoint vertex moves to t2New. Adjacent segment
  // shortens; bulge (which was 0 per the V1 check above) stays 0. No
  // additional bulge entry — the arc is a NEW ArcPrimitive, separate
  // from the polyline (per the §6.1.0 mixed-case decision).
  const newVertices = [...polyline.vertices];
  newVertices[endpointIdx] = t2New;
  const polylineUpdated: PolylinePrimitive = {
    ...polyline,
    vertices: newVertices,
  };

  return {
    lineUpdated,
    polylineUpdated,
    newArc: {
      kind: 'arc',
      center: arcCenter,
      radius,
      startAngle: arcStartAngle,
      endAngle: arcEndAngle,
    },
  };
}
