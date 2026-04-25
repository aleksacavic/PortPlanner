// Snap priority resolver per ADR-016 §GSNAP ordering:
//   OSNAP (endpoint / midpoint / center / intersection / node) [highest]
//   OTRACK (M1.3c stub)
//   POLAR  (M1.3c stub)
//   GSNAP  (grid node)
//   grid-line fallback                                          [lowest]
// ORTHO is a modifier applied AFTER snap resolution.

import type { Grid, Point2D, Primitive } from '@portplanner/domain';

import type { Viewport } from '../canvas/view-transform';
import { gatherGsnapCandidates } from './gsnap';
import { gatherOsnapCandidates, type OsnapCandidate } from './osnap';
import { applyOrtho } from './ortho';
import { isSnapCandidate } from './screen-tolerance';

export interface SnapToggles {
  osnap: boolean;
  gsnap: boolean;
  ortho: boolean;
}

export type SnapHitKind = OsnapCandidate['kind'] | 'grid-node' | 'grid-line' | 'cursor';

export interface SnapHit {
  kind: SnapHitKind;
  point: Point2D;
}

export interface ResolveSnapInput {
  cursor: Point2D;
  priorPoint: Point2D | null;
  primitives: Primitive[];
  grids: Grid[];
  viewport: Viewport;
  toggles: SnapToggles;
}

/**
 * Resolves the highest-priority snap target within UI tolerance, or
 * passes the cursor through if no target qualifies. Ortho applies as
 * a modifier to whatever the prior stage returned.
 */
export function resolveSnap(input: ResolveSnapInput): SnapHit {
  const { cursor, priorPoint, primitives, grids, viewport, toggles } = input;

  // Stage 1 — OSNAP
  if (toggles.osnap) {
    const candidates = gatherOsnapCandidates(primitives);
    let best: { c: OsnapCandidate; dist: number } | null = null;
    for (const c of candidates) {
      if (!isSnapCandidate(cursor, c.point, viewport)) continue;
      const dist = Math.hypot(cursor.x - c.point.x, cursor.y - c.point.y);
      if (!best || dist < best.dist) best = { c, dist };
    }
    if (best) {
      const finalPoint = toggles.ortho && priorPoint
        ? best.c.point // OSNAP wins over Ortho per I-41
        : best.c.point;
      return { kind: best.c.kind, point: finalPoint };
    }
  }

  // Stage 2 / 3 — OTRACK / POLAR — M1.3c stubs (return nothing).

  // Stage 4 / 5 — GSNAP (node + grid-line fallback)
  if (toggles.gsnap) {
    const candidates = gatherGsnapCandidates(grids, cursor);
    // Prefer nodes when within tolerance.
    const nodes = candidates.filter((c) => c.kind === 'grid-node');
    for (const c of nodes) {
      if (isSnapCandidate(cursor, c.point, viewport)) {
        const point = toggles.ortho && priorPoint ? applyOrtho(priorPoint, c.point) : c.point;
        return { kind: 'grid-node', point };
      }
    }
    // Fall back to grid-line (always present when gsnap is on).
    const line = candidates.find((c) => c.kind === 'grid-line');
    if (line && isSnapCandidate(cursor, line.point, viewport)) {
      const point = toggles.ortho && priorPoint ? applyOrtho(priorPoint, line.point) : line.point;
      return { kind: 'grid-line', point };
    }
  }

  // No snap target — pass cursor through, applying Ortho as a modifier.
  const final = toggles.ortho && priorPoint ? applyOrtho(priorPoint, cursor) : cursor;
  return { kind: 'cursor', point: final };
}
