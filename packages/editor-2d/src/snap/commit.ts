// Layer-1 tolerance — bit-copy on snap commit per ADR-016.
// Returns a Point2D whose x/y bits are identical to the target's.
// MUST NOT be mixed with Layer-2 (equalsMetric) or Layer-3
// (isSnapCandidate) — Gate 12.5b directory-scopes this module.

import type { Point2D } from '@portplanner/domain';

/**
 * Returns a new Point2D with bit-identical x/y to `target`. Caller
 * passes this to a primitive's vertex field so downstream code can
 * use Object.is / `===` to compare against any other vertex sourced
 * from the same target.
 */
export function commitSnappedVertex(target: Point2D): Point2D {
  return { x: target.x, y: target.y };
}
