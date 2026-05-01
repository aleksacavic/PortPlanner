// M1.3b simple-transforms Phase 1 — mirror transform helper.
// Pure domain function; no React, no store, no design-system imports
// (per I-MOD-1 invariant).

import type { Point2D, Primitive } from '../types/primitive';

/**
 * Reflect a point across the line through `a` and `b`.
 *
 * Standard formula:
 *   d = b - a; t = (p - a) · d / (d · d); foot = a + t*d;
 *   p' = 2*foot - p
 *
 * Degenerate case (a === b): caller has supplied a zero-length
 * mirror line; we return the point unchanged (no axis to reflect
 * across).
 */
function reflectPoint(p: Point2D, a: Point2D, b: Point2D): Point2D {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dd = dx * dx + dy * dy;
  if (dd === 0) return p;
  const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / dd;
  const footX = a.x + t * dx;
  const footY = a.y + t * dy;
  return {
    x: 2 * footX - p.x,
    y: 2 * footY - p.y,
  };
}

/**
 * Mirror a primitive across the line through `line.p1` and `line.p2`.
 * Returns a new Primitive (the reflected copy). Caller is responsible
 * for `addPrimitive(mirroredCopy)` and (optionally per AC erase-source
 * sub-prompt) `deletePrimitive(srcId)`.
 *
 * Per-kind:
 *   - point: position reflected.
 *   - line: p1, p2 reflected.
 *   - polyline: each vertex reflected; bulges NEGATED (sweep direction
 *     flips: CCW ↔ CW).
 *   - rectangle: corners reflected; localAxisAngle reflected;
 *     origin = min-corner; width/height unchanged.
 *   - circle: center reflected; radius unchanged.
 *   - arc: center reflected; sweep direction flips — startAngle' =
 *     reflected end-direction; endAngle' = reflected start-direction.
 *   - xline: pivot reflected; angle reflected via 2*lineAngle - angle.
 */
export function mirrorPrimitive(p: Primitive, line: { p1: Point2D; p2: Point2D }): Primitive {
  switch (p.kind) {
    case 'point':
      return { ...p, position: reflectPoint(p.position, line.p1, line.p2) };
    case 'line':
      return {
        ...p,
        p1: reflectPoint(p.p1, line.p1, line.p2),
        p2: reflectPoint(p.p2, line.p1, line.p2),
      };
    case 'polyline':
      return {
        ...p,
        vertices: p.vertices.map((v) => reflectPoint(v, line.p1, line.p2)),
        bulges: p.bulges.map((b) => -b),
      };
    case 'rectangle': {
      const lineAngle = Math.atan2(line.p2.y - line.p1.y, line.p2.x - line.p1.x);
      const sw = { x: p.origin.x, y: p.origin.y };
      const ne = { x: p.origin.x + p.width, y: p.origin.y + p.height };
      const swR = reflectPoint(sw, line.p1, line.p2);
      const neR = reflectPoint(ne, line.p1, line.p2);
      const minX = Math.min(swR.x, neR.x);
      const minY = Math.min(swR.y, neR.y);
      return {
        ...p,
        origin: { x: minX, y: minY },
        localAxisAngle: 2 * lineAngle - p.localAxisAngle,
      };
    }
    case 'circle':
      return { ...p, center: reflectPoint(p.center, line.p1, line.p2) };
    case 'arc': {
      const reflectedCenter = reflectPoint(p.center, line.p1, line.p2);
      // Reflect the start + end points to determine the new sweep.
      // Original start point in absolute coords:
      const startPt = {
        x: p.center.x + p.radius * Math.cos(p.startAngle),
        y: p.center.y + p.radius * Math.sin(p.startAngle),
      };
      const endPt = {
        x: p.center.x + p.radius * Math.cos(p.endAngle),
        y: p.center.y + p.radius * Math.sin(p.endAngle),
      };
      const startReflected = reflectPoint(startPt, line.p1, line.p2);
      const endReflected = reflectPoint(endPt, line.p1, line.p2);
      // Sweep direction flips after reflection: original (start →
      // end CCW) becomes (start' → end' CW), so swap.
      const newStartAngle = Math.atan2(
        endReflected.y - reflectedCenter.y,
        endReflected.x - reflectedCenter.x,
      );
      const newEndAngle = Math.atan2(
        startReflected.y - reflectedCenter.y,
        startReflected.x - reflectedCenter.x,
      );
      return {
        ...p,
        center: reflectedCenter,
        startAngle: newStartAngle,
        endAngle: newEndAngle,
      };
    }
    case 'xline': {
      const lineAngle = Math.atan2(line.p2.y - line.p1.y, line.p2.x - line.p1.x);
      return {
        ...p,
        pivot: reflectPoint(p.pivot, line.p1, line.p2),
        angle: 2 * lineAngle - p.angle,
      };
    }
  }
}
