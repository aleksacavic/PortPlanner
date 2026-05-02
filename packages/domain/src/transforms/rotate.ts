// M1.3b simple-transforms Phase 1 — rotate transform helper.
// Pure domain function; no React, no store, no design-system imports
// (per I-MOD-1 invariant).

import type { Point2D, Primitive } from '../types/primitive';

/**
 * Rotate a point about a base by `angleRad` (radians, CCW from +X
 * per metric Y-up convention).
 *
 *   p' = base + R(angleRad) * (p - base)
 */
function rotatePoint(p: Point2D, base: Point2D, angleRad: number): Point2D {
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  const dx = p.x - base.x;
  const dy = p.y - base.y;
  return {
    x: base.x + cos * dx - sin * dy,
    y: base.y + sin * dx + cos * dy,
  };
}

/**
 * Rotate a primitive about `base` by `angleRad`. Returns a new
 * Primitive (immutable update); caller spreads the result via
 * `updatePrimitive(id, rotatePrimitive(...))`.
 *
 * Per-kind:
 *   - point: position rotated.
 *   - line: p1, p2 rotated.
 *   - polyline: each vertex rotated; bulges unchanged.
 *   - rectangle: corners rotated; localAxisAngle += angleRad;
 *     origin = min-corner; width/height unchanged.
 *   - circle: center rotated; radius unchanged.
 *   - arc: center rotated; startAngle / endAngle += angleRad.
 *   - xline: pivot rotated; angle += angleRad.
 */
export function rotatePrimitive(p: Primitive, base: Point2D, angleRad: number): Primitive {
  switch (p.kind) {
    case 'point':
      return { ...p, position: rotatePoint(p.position, base, angleRad) };
    case 'line':
      return {
        ...p,
        p1: rotatePoint(p.p1, base, angleRad),
        p2: rotatePoint(p.p2, base, angleRad),
      };
    case 'polyline':
      return {
        ...p,
        vertices: p.vertices.map((v) => rotatePoint(v, base, angleRad)),
      };
    case 'rectangle': {
      // The rectangle's `origin` IS the SW corner in world space; the
      // painter walks from origin along the local frame
      // (R(localAxisAngle) · (width, 0)) for SE, etc. Rotation preserves
      // orientation, so the SW corner stays the SW corner — just rotate
      // it directly and increment the local axis angle.
      return {
        ...p,
        origin: rotatePoint(p.origin, base, angleRad),
        localAxisAngle: p.localAxisAngle + angleRad,
      };
    }
    case 'circle':
      return { ...p, center: rotatePoint(p.center, base, angleRad) };
    case 'arc':
      return {
        ...p,
        center: rotatePoint(p.center, base, angleRad),
        startAngle: p.startAngle + angleRad,
        endAngle: p.endAngle + angleRad,
      };
    case 'xline':
      return {
        ...p,
        pivot: rotatePoint(p.pivot, base, angleRad),
        angle: p.angle + angleRad,
      };
  }
}
