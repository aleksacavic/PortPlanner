// Per-primitive wire-vs-rect narrow-phase for crossing selection.
// Companion to bounding-boxes.ts: bboxOfPrimitive does broad-phase
// (cheap, conservative AABB), wireIntersectsRect does narrow-phase
// (expensive, geometric). spatial-index.ts's `searchCrossing` uses
// bboxOfPrimitive (via rbush) to gather candidates and this module
// to filter them down to actual wire-vs-rect intersections.
//
// AutoCAD parity: a crossing-selection drag selects only entities whose
// actual wire (line segment, polyline chain, circle outline, arc curve)
// touches the drag rect — NOT entities whose AABB merely overlaps. This
// matters for diagonal lines (large AABB, tight wire) and for any
// primitive whose bbox extends past its visible geometry.
//
// Math approach:
//   - Segment-vs-rect: Liang-Barsky parametric clipping (~30 LOC,
//     avoids the flatten-js dependency for the common case).
//   - Circle / arc intersection with rect sides: @flatten-js/core's
//     Segment.intersect(Circle | Arc), which handles tangents + multiple
//     roots correctly. flatten-js is already in editor-2d's package.json
//     deps; this module is its first consumer.
//   - Containment: simple bounded checks (point-in-rect, rect-fully-
//     inside-circle, etc.).

import { Arc, Circle, Point, Segment } from '@flatten-js/core';
import type { Point2D, Primitive } from '@portplanner/domain';

import type { BBox } from './bounding-boxes';

export function wireIntersectsRect(p: Primitive, rect: BBox): boolean {
  switch (p.kind) {
    case 'point':
      return pointInRect(p.position, rect);
    case 'line':
      return segmentIntersectsRect(p.p1, p.p2, rect);
    case 'polyline': {
      // Any vertex inside OR any segment crosses.
      for (const v of p.vertices) {
        if (pointInRect(v, rect)) return true;
      }
      for (let i = 0; i < p.vertices.length - 1; i += 1) {
        if (segmentIntersectsRect(p.vertices[i]!, p.vertices[i + 1]!, rect)) return true;
      }
      if (p.closed && p.vertices.length >= 2) {
        const last = p.vertices[p.vertices.length - 1]!;
        const first = p.vertices[0]!;
        if (segmentIntersectsRect(last, first, rect)) return true;
      }
      return false;
    }
    case 'rectangle': {
      const corners = rectangleCorners(p);
      // Any corner inside the selection rect → intersects.
      for (const c of corners) if (pointInRect(c, rect)) return true;
      // Any side intersects the selection rect.
      for (let i = 0; i < 4; i += 1) {
        if (segmentIntersectsRect(corners[i]!, corners[(i + 1) % 4]!, rect)) return true;
      }
      // Selection rect fully inside the entity rectangle: check if any
      // selection-rect corner is inside the entity polygon. Simple
      // even-odd ray cast.
      const selectionCorners: Point2D[] = [
        { x: rect.minX, y: rect.minY },
        { x: rect.maxX, y: rect.minY },
        { x: rect.maxX, y: rect.maxY },
        { x: rect.minX, y: rect.maxY },
      ];
      for (const sc of selectionCorners) {
        if (pointInPolygon(sc, corners)) return true;
      }
      return false;
    }
    case 'circle': {
      const sides = rectSides(rect);
      const circle = new Circle(new Point(p.center.x, p.center.y), p.radius);
      // Any selection-rect side intersects the circle outline.
      for (const seg of sides) {
        if (seg.intersect(circle).length > 0) return true;
      }
      // Selection rect fully inside circle (all corners within radius).
      const corners: Point2D[] = [
        { x: rect.minX, y: rect.minY },
        { x: rect.maxX, y: rect.minY },
        { x: rect.maxX, y: rect.maxY },
        { x: rect.minX, y: rect.maxY },
      ];
      let allInside = true;
      for (const c of corners) {
        if (Math.hypot(c.x - p.center.x, c.y - p.center.y) > p.radius) {
          allInside = false;
          break;
        }
      }
      if (allInside) return true;
      // Circle fully inside selection rect (bbox-fully-inside).
      const cb = {
        minX: p.center.x - p.radius,
        maxX: p.center.x + p.radius,
        minY: p.center.y - p.radius,
        maxY: p.center.y + p.radius,
      };
      if (
        cb.minX >= rect.minX &&
        cb.maxX <= rect.maxX &&
        cb.minY >= rect.minY &&
        cb.maxY <= rect.maxY
      ) {
        return true;
      }
      return false;
    }
    case 'arc': {
      const s = p.startAngle;
      let e = p.endAngle;
      while (e < s) e += Math.PI * 2;
      // Endpoint-in-rect check.
      const startPt: Point2D = {
        x: p.center.x + p.radius * Math.cos(s),
        y: p.center.y + p.radius * Math.sin(s),
      };
      const endPt: Point2D = {
        x: p.center.x + p.radius * Math.cos(e),
        y: p.center.y + p.radius * Math.sin(e),
      };
      if (pointInRect(startPt, rect) || pointInRect(endPt, rect)) return true;
      // Midpoint-in-rect (cheap pre-check before the harder side-intersect).
      const midA = (s + e) / 2;
      const midPt: Point2D = {
        x: p.center.x + p.radius * Math.cos(midA),
        y: p.center.y + p.radius * Math.sin(midA),
      };
      if (pointInRect(midPt, rect)) return true;
      // Arc-vs-rect-side intersection via flatten-js.
      const arc = new Arc(new Point(p.center.x, p.center.y), p.radius, s, e, true);
      const sides = rectSides(rect);
      for (const seg of sides) {
        if (seg.intersect(arc).length > 0) return true;
      }
      return false;
    }
    case 'xline':
      return xlineIntersectsRect(p.pivot, p.angle, rect);
  }
}

// ───────────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────────

function pointInRect(p: Point2D, rect: BBox): boolean {
  return p.x >= rect.minX && p.x <= rect.maxX && p.y >= rect.minY && p.y <= rect.maxY;
}

/**
 * Liang-Barsky segment-vs-rect clipping. Returns true if any portion of
 * the segment p1→p2 lies within the rect. Handles all four classic
 * cases (both-inside, one-inside, neither-inside-but-crosses,
 * neither-inside-no-crossing).
 */
function segmentIntersectsRect(p1: Point2D, p2: Point2D, rect: BBox): boolean {
  // Quick accept: either endpoint inside.
  if (pointInRect(p1, rect) || pointInRect(p2, rect)) return true;
  // Liang-Barsky parameter clipping.
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  let t0 = 0;
  let t1 = 1;
  const checks: Array<[number, number]> = [
    [-dx, p1.x - rect.minX], // left
    [dx, rect.maxX - p1.x], // right
    [-dy, p1.y - rect.minY], // bottom
    [dy, rect.maxY - p1.y], // top
  ];
  for (const [pCoeff, q] of checks) {
    if (pCoeff === 0) {
      if (q < 0) return false; // parallel and outside
      continue;
    }
    const r = q / pCoeff;
    if (pCoeff < 0) {
      if (r > t1) return false;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return false;
      if (r < t1) t1 = r;
    }
  }
  return t0 <= t1;
}

function rectangleCorners(p: {
  origin: Point2D;
  width: number;
  height: number;
  localAxisAngle: number;
}): Point2D[] {
  const cos = Math.cos(p.localAxisAngle);
  const sin = Math.sin(p.localAxisAngle);
  const corner = (du: number, dv: number): Point2D => ({
    x: p.origin.x + du * cos - dv * sin,
    y: p.origin.y + du * sin + dv * cos,
  });
  return [corner(0, 0), corner(p.width, 0), corner(p.width, p.height), corner(0, p.height)];
}

function rectSides(rect: BBox): Segment[] {
  const c00 = new Point(rect.minX, rect.minY);
  const c10 = new Point(rect.maxX, rect.minY);
  const c11 = new Point(rect.maxX, rect.maxY);
  const c01 = new Point(rect.minX, rect.maxY);
  return [
    new Segment(c00, c10),
    new Segment(c10, c11),
    new Segment(c11, c01),
    new Segment(c01, c00),
  ];
}

/** Even-odd ray cast — point inside an arbitrary polygon. */
function pointInPolygon(p: Point2D, poly: Point2D[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!;
    const b = poly[j]!;
    const intersects =
      a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

/**
 * An infinite line through `pivot` at `angle` intersects the rect iff
 * either: (a) pivot is inside rect (always); (b) the parametric line
 * crosses any rect side. Rect sides are line segments; the infinite
 * line intersects a segment if the segment endpoints lie on opposite
 * sides of the line OR one endpoint is on the line.
 */
function xlineIntersectsRect(pivot: Point2D, angle: number, rect: BBox): boolean {
  if (pointInRect(pivot, rect)) return true;
  const ux = Math.cos(angle);
  const uy = Math.sin(angle);
  // Signed distance of a point (x, y) from the line through pivot with
  // direction (ux, uy): perpendicular component = -(uy)·(x-pivot.x) + ux·(y-pivot.y).
  const sd = (x: number, y: number): number => -uy * (x - pivot.x) + ux * (y - pivot.y);
  const corners: [number, number][] = [
    [rect.minX, rect.minY],
    [rect.maxX, rect.minY],
    [rect.maxX, rect.maxY],
    [rect.minX, rect.maxY],
  ];
  let hasPos = false;
  let hasNeg = false;
  for (const [x, y] of corners) {
    const d = sd(x, y);
    if (d > 0) hasPos = true;
    else if (d < 0) hasNeg = true;
    else return true; // corner lies on the line
  }
  return hasPos && hasNeg;
}
