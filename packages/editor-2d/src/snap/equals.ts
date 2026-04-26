// Layer-2 tolerance — ε-distance for derived logic per ADR-016.
// Used when bit-equality is impossible (independent primitives that
// happen to coincide). MUST NOT be mixed with Layer-1 (commit) or
// Layer-3 (screen-pixel) — Gate 12.5a directory-scopes this module.

import type { Point2D } from '@portplanner/domain';

export const DEFAULT_METRIC_EPSILON = 1e-6;

export function equalsMetric(
  a: Point2D,
  b: Point2D,
  eps: number = DEFAULT_METRIC_EPSILON,
): boolean {
  return Math.hypot(a.x - b.x, a.y - b.y) < eps;
}
