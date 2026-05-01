// M1.3b simple-transforms Phase 1 — offset transform helper.
// Pure domain function; no React, no store, no design-system imports
// (per I-MOD-1 invariant).

import type { Point2D, Primitive } from '../types/primitive';

/**
 * Offset a primitive by `distance × side` perpendicular to its local
 * orientation. Returns a NEW primitive (caller adds via `addPrimitive`;
 * the source is unchanged).
 *
 * `side` is `1` or `-1`; the tool determines it from the cursor's
 * perpendicular projection onto the source's normal.
 *
 * Per-kind:
 *   - point: throws — point has no offset semantic.
 *   - line: parallel line shifted perpendicular by distance×side.
 *   - polyline: V1 simple — per-segment perpendicular shift; throws
 *     on bulged polylines (Fillet has not yet introduced bulges into
 *     M1.3a/b/c data; deferred).
 *   - rectangle: dimensions ± 2*distance*side, centered (origin shifts
 *     by ±distance per axis when growing; opposite when side === -1).
 *     Throws if result has any non-positive dimension.
 *   - circle: same center, radius ± distance*side. Throws if result
 *     radius ≤ 0.
 *   - arc: same center, radius ± distance*side. Throws if ≤ 0.
 *   - xline: pivot shifted by distance×side perpendicular to direction;
 *     angle unchanged.
 *
 * Caller assumes the offset entity is added under the same layer +
 * displayOverrides as the source (the spread `...p` preserves both).
 */
export function offsetPrimitive(p: Primitive, distance: number, side: 1 | -1): Primitive {
  if (distance <= 0) {
    throw new Error('offsetPrimitive: distance must be > 0');
  }
  const offset = distance * side;
  switch (p.kind) {
    case 'point':
      throw new Error('offsetPrimitive: point has no offset semantic');
    case 'line': {
      // Perpendicular unit (CCW) to the line direction.
      const dx = p.p2.x - p.p1.x;
      const dy = p.p2.y - p.p1.y;
      const len = Math.hypot(dx, dy);
      if (len === 0) throw new Error('offsetPrimitive: zero-length line');
      const px = -dy / len;
      const py = dx / len;
      const shiftX = px * offset;
      const shiftY = py * offset;
      return {
        ...p,
        p1: { x: p.p1.x + shiftX, y: p.p1.y + shiftY },
        p2: { x: p.p2.x + shiftX, y: p.p2.y + shiftY },
      };
    }
    case 'polyline': {
      if (p.bulges.some((b) => b !== 0)) {
        throw new Error('offsetPrimitive: bulged polyline not supported in V1 (deferred)');
      }
      // V1 simple: per-segment perpendicular shift; vertices computed
      // by intersecting adjacent shifted segment lines. For an open
      // polyline with N vertices and N-1 segments, V1 produces N
      // shifted vertices.
      const n = p.vertices.length;
      if (n < 2) throw new Error('offsetPrimitive: polyline must have ≥ 2 vertices');
      const shifted: Point2D[] = [];
      for (let i = 0; i < n; i += 1) {
        const v = p.vertices[i]!;
        // Determine the segment's normal at this vertex. For interior
        // vertices, average the two adjacent segment normals; for end
        // vertices use the single adjacent segment's normal.
        const prev = i > 0 ? p.vertices[i - 1]! : null;
        const next = i < n - 1 ? p.vertices[i + 1]! : null;
        let nx = 0;
        let ny = 0;
        if (prev && next) {
          // Interior vertex: average normals of (prev → v) and (v → next).
          const d1x = v.x - prev.x;
          const d1y = v.y - prev.y;
          const l1 = Math.hypot(d1x, d1y);
          const d2x = next.x - v.x;
          const d2y = next.y - v.y;
          const l2 = Math.hypot(d2x, d2y);
          if (l1 === 0 || l2 === 0)
            throw new Error('offsetPrimitive: zero-length polyline segment');
          nx = (-d1y / l1 + -d2y / l2) / 2;
          ny = (d1x / l1 + d2x / l2) / 2;
          const nl = Math.hypot(nx, ny);
          if (nl === 0)
            throw new Error('offsetPrimitive: degenerate polyline (collinear reversed segments)');
          nx /= nl;
          ny /= nl;
        } else if (next) {
          // First vertex: use first segment's normal.
          const dx = next.x - v.x;
          const dy = next.y - v.y;
          const len = Math.hypot(dx, dy);
          if (len === 0) throw new Error('offsetPrimitive: zero-length polyline segment');
          nx = -dy / len;
          ny = dx / len;
        } else if (prev) {
          // Last vertex: use last segment's normal.
          const dx = v.x - prev.x;
          const dy = v.y - prev.y;
          const len = Math.hypot(dx, dy);
          if (len === 0) throw new Error('offsetPrimitive: zero-length polyline segment');
          nx = -dy / len;
          ny = dx / len;
        }
        shifted.push({ x: v.x + nx * offset, y: v.y + ny * offset });
      }
      return { ...p, vertices: shifted };
    }
    case 'rectangle': {
      // Grow (side=+1, offset>0) or shrink (side=-1) by 2*offset on
      // each axis, centered on the original center.
      const newWidth = p.width + 2 * offset;
      const newHeight = p.height + 2 * offset;
      if (newWidth <= 0 || newHeight <= 0) {
        throw new Error('offsetPrimitive: rectangle would shrink to zero or negative size');
      }
      return {
        ...p,
        origin: { x: p.origin.x - offset, y: p.origin.y - offset },
        width: newWidth,
        height: newHeight,
      };
    }
    case 'circle': {
      const newRadius = p.radius + offset;
      if (newRadius <= 0) {
        throw new Error('offsetPrimitive: circle radius would shrink to zero or negative');
      }
      return { ...p, radius: newRadius };
    }
    case 'arc': {
      const newRadius = p.radius + offset;
      if (newRadius <= 0) {
        throw new Error('offsetPrimitive: arc radius would shrink to zero or negative');
      }
      return { ...p, radius: newRadius };
    }
    case 'xline': {
      // Perpendicular unit to xline direction.
      const cos = Math.cos(p.angle);
      const sin = Math.sin(p.angle);
      // CCW-perpendicular: (-sin, cos).
      const shiftX = -sin * offset;
      const shiftY = cos * offset;
      return {
        ...p,
        pivot: { x: p.pivot.x + shiftX, y: p.pivot.y + shiftY },
      };
    }
  }
}
