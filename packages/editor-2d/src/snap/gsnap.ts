// GSNAP — grid-node + grid-line fallback per ADR-016/021.
// Only grids with `activeForSnap === true` participate.

import type { Grid, Point2D } from '@portplanner/domain';

export interface GsnapCandidate {
  kind: 'grid-node' | 'grid-line';
  point: Point2D;
}

function nearestGridNode(grid: Grid, cursor: Point2D): Point2D {
  // Inverse-rotate cursor into grid-local frame.
  const cos = Math.cos(grid.angle);
  const sin = Math.sin(grid.angle);
  const dx = cursor.x - grid.origin.x;
  const dy = cursor.y - grid.origin.y;
  const u = dx * cos + dy * sin;
  const v = -dx * sin + dy * cos;
  const uSnap = Math.round(u / grid.spacingX) * grid.spacingX;
  const vSnap = Math.round(v / grid.spacingY) * grid.spacingY;
  // Rotate back.
  return {
    x: grid.origin.x + uSnap * cos - vSnap * sin,
    y: grid.origin.y + uSnap * sin + vSnap * cos,
  };
}

function nearestGridLine(grid: Grid, cursor: Point2D): Point2D {
  // Inverse-rotate cursor.
  const cos = Math.cos(grid.angle);
  const sin = Math.sin(grid.angle);
  const dx = cursor.x - grid.origin.x;
  const dy = cursor.y - grid.origin.y;
  const u = dx * cos + dy * sin;
  const v = -dx * sin + dy * cos;
  // Distance to nearest vertical grid line (fixed u_k = k·spacingX, free v)
  const uSnap = Math.round(u / grid.spacingX) * grid.spacingX;
  const dU = Math.abs(u - uSnap);
  // Distance to nearest horizontal grid line (free u, fixed v_k = k·spacingY)
  const vSnap = Math.round(v / grid.spacingY) * grid.spacingY;
  const dV = Math.abs(v - vSnap);
  // Take the closer line and project cursor onto it.
  if (dU <= dV) {
    return {
      x: grid.origin.x + uSnap * cos - v * sin,
      y: grid.origin.y + uSnap * sin + v * cos,
    };
  }
  return {
    x: grid.origin.x + u * cos - vSnap * sin,
    y: grid.origin.y + u * sin + vSnap * cos,
  };
}

/** Returns grid-node + grid-line candidates for active-for-snap grids. */
export function gatherGsnapCandidates(grids: Grid[], cursor: Point2D): GsnapCandidate[] {
  const out: GsnapCandidate[] = [];
  for (const g of grids) {
    if (!g.activeForSnap) continue;
    out.push({ kind: 'grid-node', point: nearestGridNode(g, cursor) });
    out.push({ kind: 'grid-line', point: nearestGridLine(g, cursor) });
  }
  return out;
}
