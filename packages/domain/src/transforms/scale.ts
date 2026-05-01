// M1.3b simple-transforms Phase 1 — scale transform helper.
// Pure domain function; no React, no store, no design-system imports
// (per I-MOD-1 invariant).

import type { Point2D, Primitive } from '../types/primitive';

/**
 * Scale a point about a base by `factor`.
 *
 *   p' = base + factor * (p - base)
 *
 * Negative factor flips through base (AC parity). Per I-MOD-7 SSOT:
 *   - factor === 0 → caller MUST reject before calling this helper
 *     (the helper throws for safety)
 *   - factor < 0 → flipped-and-scaled (allowed)
 */
function scalePoint(p: Point2D, base: Point2D, factor: number): Point2D {
  return {
    x: base.x + factor * (p.x - base.x),
    y: base.y + factor * (p.y - base.y),
  };
}

/**
 * Scale a primitive about `base` by `factor`. Returns a new Primitive.
 *
 * Per I-MOD-7 SSOT (plan §10):
 *   - factor === 0 throws (degenerate; cursor exactly on base produces
 *     no information)
 *   - factor < 0 allowed (AC convention — flipped-and-scaled result)
 *
 * Per-kind:
 *   - point: position scaled.
 *   - line: p1, p2 scaled.
 *   - polyline: each vertex scaled; bulges unchanged (uniform scale
 *     preserves bulge ratio).
 *   - rectangle: origin scaled; width/height × |factor|; for negative
 *     factor the rectangle flips through base, requiring origin
 *     re-derivation as min-corner.
 *   - circle: center scaled; radius × |factor|.
 *   - arc: center scaled; radius × |factor|; angles unchanged.
 *   - xline: pivot scaled; angle unchanged (direction-invariant).
 */
export function scalePrimitive(p: Primitive, base: Point2D, factor: number): Primitive {
  if (factor === 0) {
    throw new Error('scalePrimitive: factor === 0 is degenerate (per I-MOD-7)');
  }
  switch (p.kind) {
    case 'point':
      return { ...p, position: scalePoint(p.position, base, factor) };
    case 'line':
      return {
        ...p,
        p1: scalePoint(p.p1, base, factor),
        p2: scalePoint(p.p2, base, factor),
      };
    case 'polyline':
      return {
        ...p,
        vertices: p.vertices.map((v) => scalePoint(v, base, factor)),
      };
    case 'rectangle': {
      // For negative factor the rect flips through base; recompute
      // origin as min-corner of the scaled corners.
      const sw = { x: p.origin.x, y: p.origin.y };
      const ne = { x: p.origin.x + p.width, y: p.origin.y + p.height };
      const swScaled = scalePoint(sw, base, factor);
      const neScaled = scalePoint(ne, base, factor);
      const minX = Math.min(swScaled.x, neScaled.x);
      const minY = Math.min(swScaled.y, neScaled.y);
      return {
        ...p,
        origin: { x: minX, y: minY },
        width: p.width * Math.abs(factor),
        height: p.height * Math.abs(factor),
      };
    }
    case 'circle':
      return {
        ...p,
        center: scalePoint(p.center, base, factor),
        radius: p.radius * Math.abs(factor),
      };
    case 'arc':
      return {
        ...p,
        center: scalePoint(p.center, base, factor),
        radius: p.radius * Math.abs(factor),
      };
    case 'xline':
      return {
        ...p,
        pivot: scalePoint(p.pivot, base, factor),
      };
  }
}
