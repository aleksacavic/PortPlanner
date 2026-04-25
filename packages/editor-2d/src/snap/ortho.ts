// Ortho modifier per ADR-016. Constrains cursor to ±X / ±Y of the
// active drafting frame (WCS in M1.3a — no UCS abstraction yet)
// relative to the prior point in a tool's prompt chain.

import type { Point2D } from '@portplanner/domain';

/**
 * Clamp `cursor` to the nearest of ±X / ±Y from `priorPoint` (in WCS).
 * Whichever axis the cursor moved further along wins.
 */
export function applyOrtho(priorPoint: Point2D, cursor: Point2D): Point2D {
  const dx = cursor.x - priorPoint.x;
  const dy = cursor.y - priorPoint.y;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return { x: cursor.x, y: priorPoint.y };
  }
  return { x: priorPoint.x, y: cursor.y };
}
