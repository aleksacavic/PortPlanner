// Layer-3 tolerance — screen-pixel UI tolerance per ADR-016.
// "Is the cursor close enough to this candidate to trigger snap?"
// Measured in screen pixels (zoom-aware via Viewport.zoom).
// MUST NOT be mixed with Layer-1 / Layer-2 — Gate 12.5c directory-
// scopes this module.

import type { Point2D } from '@portplanner/domain';

import type { Viewport } from '../canvas/view-transform';

export const DEFAULT_PX_TOLERANCE = 10;

/**
 * Returns true iff `candidate` (in metric) is within `pxTolerance`
 * screen pixels of `cursor` (in metric) at the current viewport zoom.
 */
export function isSnapCandidate(
  cursor: Point2D,
  candidate: Point2D,
  viewport: Viewport,
  pxTolerance: number = DEFAULT_PX_TOLERANCE,
): boolean {
  const metricTolerance = pxTolerance / viewport.zoom;
  return Math.hypot(cursor.x - candidate.x, cursor.y - candidate.y) <= metricTolerance;
}
