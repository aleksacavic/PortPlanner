// M1.3b fillet-chamfer Phase 1 — Chamfer domain helpers.
// Pure domain functions; no React, no store, no design-system imports
// (per I-MOD-1 / I-FC-1 invariant).
//
// Mirrors fillet.ts structure with three pair types but produces a
// STRAIGHT chamfer segment (LinePrimitive) instead of an ArcPrimitive,
// and uses two independent trim distances (d1 along source-1, d2 along
// source-2) per AC's two-distance method.
//
// V1 = two-distance method only. AC's `[mEthod]` distance-vs-angle
// alternation is deferred (assumption A7 in the plan).

import type { LinePrimitive, Point2D, PolylinePrimitive } from '../types/primitive';

const PARALLEL_EPSILON = 1e-9;

/** Geometry of a chamfer segment to be created. Caller provides
 *  id/layerId/displayOverrides at addPrimitive time. */
export type ChamferSegmentGeometry = Omit<LinePrimitive, 'id' | 'layerId' | 'displayOverrides'>;

export interface ChamferTwoLinesResult {
  l1Updated: LinePrimitive;
  l2Updated: LinePrimitive;
  newSegment: ChamferSegmentGeometry;
}

export interface ChamferLinePolylineResult {
  lineUpdated: LinePrimitive;
  polylineUpdated: PolylinePrimitive;
  newSegment: ChamferSegmentGeometry;
}

function distance(a: Point2D, b: Point2D): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function unit(from: Point2D, to: Point2D): Point2D {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) throw new Error('chamfer: zero-length direction vector');
  return { x: dx / len, y: dy / len };
}

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

/**
 * Chamfer two LinePrimitives.
 *
 * Trims the closer-to-`p1Hint` side of L1 by `d1`, the closer-to-
 * `p2Hint` side of L2 by `d2`, then connects the new trimmed endpoints
 * with a straight LinePrimitive (the chamfer segment).
 *
 * Throws on:
 *   - d1 ≤ 0 or d2 ≤ 0
 *   - parallel lines
 *   - either trim distance ≥ available segment length
 */
export function chamferTwoLines(
  l1: LinePrimitive,
  l2: LinePrimitive,
  d1: number,
  d2: number,
  pickHints: { p1Hint: Point2D; p2Hint: Point2D },
): ChamferTwoLinesResult {
  if (d1 <= 0 || d2 <= 0) {
    throw new Error('chamferTwoLines: distances must be > 0');
  }

  const k1IsP1 = distance(l1.p1, pickHints.p1Hint) <= distance(l1.p2, pickHints.p1Hint);
  const k1 = k1IsP1 ? l1.p1 : l1.p2;
  const k2IsP1 = distance(l2.p1, pickHints.p2Hint) <= distance(l2.p2, pickHints.p2Hint);
  const k2 = k2IsP1 ? l2.p1 : l2.p2;

  const corner = lineIntersection(l1.p1, l1.p2, l2.p1, l2.p2);
  if (!corner) {
    throw new Error('chamferTwoLines: parallel lines cannot be chamfered');
  }

  const u1 = unit(corner, k1);
  const u2 = unit(corner, k2);

  if (d1 >= distance(corner, k1) || d2 >= distance(corner, k2)) {
    throw new Error('chamferTwoLines: trim distance exceeds source segment length');
  }

  const t1New = { x: corner.x + u1.x * d1, y: corner.y + u1.y * d1 };
  const t2New = { x: corner.x + u2.x * d2, y: corner.y + u2.y * d2 };

  const l1Updated: LinePrimitive = k1IsP1 ? { ...l1, p2: t1New } : { ...l1, p1: t1New };
  const l2Updated: LinePrimitive = k2IsP1 ? { ...l2, p2: t2New } : { ...l2, p1: t2New };

  return {
    l1Updated,
    l2Updated,
    newSegment: {
      kind: 'line',
      p1: t1New,
      p2: t2New,
    },
  };
}

/**
 * Chamfer an interior corner of a polyline (vertex `vertexIdx` with two
 * adjacent segments). Replaces vertex K with two new vertices P1 / P2
 * (offset by `d1` along the K→prev direction and `d2` along the K→next
 * direction respectively). The new (P1 → P2) segment is straight
 * (`bulges[vertexIdx] = 0`).
 *
 * Throws on:
 *   - d1 ≤ 0 or d2 ≤ 0
 *   - vertex has only one adjacent segment (open polyline endpoint vertex)
 *   - either adjacent segment is already curved
 *   - either trim distance ≥ adjacent segment length
 */
export function chamferPolylineCorner(
  p: PolylinePrimitive,
  vertexIdx: number,
  d1: number,
  d2: number,
): PolylinePrimitive {
  if (d1 <= 0 || d2 <= 0) {
    throw new Error('chamferPolylineCorner: distances must be > 0');
  }
  const n = p.vertices.length;
  if (n < 2) throw new Error('chamferPolylineCorner: polyline must have ≥ 2 vertices');

  let prevIdx: number;
  let nextIdx: number;
  let prevSegBulgeIdx: number;
  let nextSegBulgeIdx: number;
  if (p.closed) {
    if (vertexIdx < 0 || vertexIdx >= n) {
      throw new Error('chamferPolylineCorner: vertexIdx out of range');
    }
    prevIdx = (vertexIdx - 1 + n) % n;
    nextIdx = (vertexIdx + 1) % n;
    prevSegBulgeIdx = prevIdx;
    nextSegBulgeIdx = vertexIdx;
  } else {
    if (vertexIdx <= 0 || vertexIdx >= n - 1) {
      throw new Error('chamferPolylineCorner: open polyline endpoint vertex has no corner');
    }
    prevIdx = vertexIdx - 1;
    nextIdx = vertexIdx + 1;
    prevSegBulgeIdx = prevIdx;
    nextSegBulgeIdx = vertexIdx;
  }

  const prevBulge = p.bulges[prevSegBulgeIdx] ?? 0;
  const nextBulge = p.bulges[nextSegBulgeIdx] ?? 0;
  if (prevBulge !== 0 || nextBulge !== 0) {
    throw new Error(
      'chamferPolylineCorner: adjacent segment already curved (bulged) — V1 supports straight-segment corners only',
    );
  }

  const k = p.vertices[vertexIdx]!;
  const prev = p.vertices[prevIdx]!;
  const next = p.vertices[nextIdx]!;

  const uPrev = unit(k, prev);
  const uNext = unit(k, next);

  if (d1 >= distance(k, prev) || d2 >= distance(k, next)) {
    throw new Error('chamferPolylineCorner: trim distance exceeds adjacent segment length');
  }

  const p1 = { x: k.x + uPrev.x * d1, y: k.y + uPrev.y * d1 };
  const p2 = { x: k.x + uNext.x * d2, y: k.y + uNext.y * d2 };

  const newVertices = [
    ...p.vertices.slice(0, vertexIdx),
    p1,
    p2,
    ...p.vertices.slice(vertexIdx + 1),
  ];

  // New bulges: insert `0` at position vertexIdx for the new straight
  // (P1 → P2) chamfer segment.
  const newBulges = [...p.bulges.slice(0, vertexIdx), 0, ...p.bulges.slice(vertexIdx)];

  return {
    ...p,
    vertices: newVertices,
    bulges: newBulges,
  };
}

/**
 * Chamfer a Line + open Polyline endpoint segment.
 *
 * Trims the line by `d1` (at the side away from `lineHint`), trims the
 * polyline endpoint by `d2` along the adjacent segment, adds a new
 * straight LinePrimitive bridging the two new endpoints.
 *
 * Throws on:
 *   - d1 ≤ 0 or d2 ≤ 0
 *   - polyline is closed
 *   - adjacent polyline segment already curved
 *   - parallel line and polyline-segment
 *   - either trim distance ≥ available segment length
 */
export function chamferLineAndPolylineEndpoint(
  line: LinePrimitive,
  lineHint: Point2D,
  polyline: PolylinePrimitive,
  polylineEndpoint: 0 | -1,
  d1: number,
  d2: number,
): ChamferLinePolylineResult {
  if (d1 <= 0 || d2 <= 0) {
    throw new Error('chamferLineAndPolylineEndpoint: distances must be > 0');
  }
  if (polyline.closed) {
    throw new Error(
      'chamferLineAndPolylineEndpoint: polyline must be open (closed polylines have no endpoint)',
    );
  }
  const n = polyline.vertices.length;
  if (n < 2) {
    throw new Error('chamferLineAndPolylineEndpoint: polyline must have ≥ 2 vertices');
  }

  const endpointIdx = polylineEndpoint === 0 ? 0 : n - 1;
  const adjacentIdx = polylineEndpoint === 0 ? 1 : n - 2;
  const adjacentSegBulgeIdx = polylineEndpoint === 0 ? 0 : n - 2;
  const endpointBulge = polyline.bulges[adjacentSegBulgeIdx] ?? 0;
  if (endpointBulge !== 0) {
    throw new Error(
      'chamferLineAndPolylineEndpoint: adjacent polyline segment already curved — V1 supports straight-segment corners only',
    );
  }

  const polyEnd = polyline.vertices[endpointIdx]!;
  const polyAdj = polyline.vertices[adjacentIdx]!;

  const lineKIsP1 = distance(line.p1, lineHint) <= distance(line.p2, lineHint);
  const lineK = lineKIsP1 ? line.p1 : line.p2;

  const corner = lineIntersection(line.p1, line.p2, polyEnd, polyAdj);
  if (!corner) {
    throw new Error('chamferLineAndPolylineEndpoint: line and polyline-segment are parallel');
  }

  const uLine = unit(corner, lineK);
  const uPoly = unit(corner, polyAdj);

  if (d1 >= distance(corner, lineK) || d2 >= distance(corner, polyAdj)) {
    throw new Error('chamferLineAndPolylineEndpoint: trim distance exceeds source segment length');
  }

  const t1New = { x: corner.x + uLine.x * d1, y: corner.y + uLine.y * d1 };
  const t2New = { x: corner.x + uPoly.x * d2, y: corner.y + uPoly.y * d2 };

  const lineUpdated: LinePrimitive = lineKIsP1 ? { ...line, p2: t1New } : { ...line, p1: t1New };

  const newVertices = [...polyline.vertices];
  newVertices[endpointIdx] = t2New;
  const polylineUpdated: PolylinePrimitive = {
    ...polyline,
    vertices: newVertices,
  };

  return {
    lineUpdated,
    polylineUpdated,
    newSegment: {
      kind: 'line',
      p1: t1New,
      p2: t2New,
    },
  };
}
