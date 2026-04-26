// rbush wrapper + per-entity-id tracking. Xlines kept in a separate
// list (infinite extent — not insertable into rbush).

import type { Primitive, PrimitiveId, Project } from '@portplanner/domain';
import RBush from 'rbush';

import { type BBox, bboxOfPrimitive } from './bounding-boxes';
import { wireIntersectsRect } from './wire-intersect';

interface IndexedItem extends BBox {
  id: PrimitiveId;
}

class PrimitiveRBush extends RBush<IndexedItem> {
  toBBox(item: IndexedItem): IndexedItem {
    return item;
  }
  compareMinX(a: IndexedItem, b: IndexedItem): number {
    return a.minX - b.minX;
  }
  compareMinY(a: IndexedItem, b: IndexedItem): number {
    return a.minY - b.minY;
  }
}

export class PrimitiveSpatialIndex {
  private readonly tree = new PrimitiveRBush();
  private readonly byId = new Map<PrimitiveId, IndexedItem>();
  private readonly xlineIds = new Set<PrimitiveId>();

  insert(p: Primitive): void {
    if (p.kind === 'xline') {
      this.xlineIds.add(p.id);
      return;
    }
    const bb = bboxOfPrimitive(p);
    if (!bb) return;
    const item: IndexedItem = { ...bb, id: p.id };
    this.tree.insert(item);
    this.byId.set(p.id, item);
  }

  remove(id: PrimitiveId): void {
    if (this.xlineIds.delete(id)) return;
    const item = this.byId.get(id);
    if (!item) return;
    this.tree.remove(item, (a, b) => a.id === b.id);
    this.byId.delete(id);
  }

  update(p: Primitive): void {
    this.remove(p.id);
    this.insert(p);
  }

  /** Returns finite-bbox primitive ids whose bbox intersects the frustum, plus all xlines. */
  searchFrustum(frustum: BBox): PrimitiveId[] {
    const hits = this.tree.search(frustum).map((it) => it.id);
    return [...hits, ...this.xlineIds];
  }

  /**
   * M1.3d-Remediation-2 R5 — crossing-selection (any-touch) helper using
   * geometric wire-vs-rect intersection. Returns ids whose ACTUAL WIRE
   * intersects `rect`, not merely the AABB. Two-phase:
   *   1. Broad-phase via rbush (`tree.search(rect)`) gathers candidates
   *      whose AABB overlaps rect — cheap superset.
   *   2. Narrow-phase via `wireIntersectsRect(primitive, rect)` filters
   *      to actual wire-rect intersection (Liang-Barsky for segments;
   *      flatten-js for circle / arc).
   * Xlines are returned unconditionally via the existing infinite-extent
   * path (any infinite line crosses any finite rect).
   *
   * `primitives` is `Project['primitives']` so the narrow-phase can look
   * up full primitive shapes from broad-phase candidate ids; this matches
   * the existing `hitTest` lookup pattern (one-shot getState read at
   * query time, no persisted reference).
   */
  searchCrossing(rect: BBox, primitives: Project['primitives']): PrimitiveId[] {
    const candidates = this.tree.search(rect);
    const hits: PrimitiveId[] = [];
    for (const item of candidates) {
      const p = primitives[item.id];
      if (!p) continue;
      if (wireIntersectsRect(p, rect)) hits.push(item.id);
    }
    // Xlines: infinite extent → always crossing-eligible. wireIntersectsRect
    // for xline does its own pivot-and-direction-vs-rect check.
    for (const id of this.xlineIds) {
      const p = primitives[id];
      if (!p) continue;
      if (wireIntersectsRect(p, rect)) hits.push(id);
    }
    return hits;
  }

  /**
   * M1.3d Phase 7 — window-selection (fully-enclosed) helper. Returns
   * finite-bbox primitive ids whose ENTIRE bbox lies inside `rect`.
   * Implementation: rbush-search the rect for candidates, then filter
   * by per-item bbox-inside-rect. Xlines are intentionally EXCLUDED
   * because their infinite extent can never be fully enclosed
   * (matches AutoCAD behaviour where construction lines are
   * crossing-only).
   *
   * NOTE: bbox-fully-inside IS equivalent to wire-fully-inside for our
   * convex / connected primitives (line endpoints, polyline vertices,
   * rectangle corners, circle / arc bbox span all coincide with the
   * convex hull of the wire). Window selection thus does NOT need a
   * narrow-phase wire check; bbox is exact for "fully enclosed".
   * Verified in M1.3d-Remediation-2 §9 audit C1.1.
   */
  searchEnclosed(rect: BBox): PrimitiveId[] {
    const candidates = this.tree.search(rect);
    const enclosed: PrimitiveId[] = [];
    for (const item of candidates) {
      if (
        item.minX >= rect.minX &&
        item.maxX <= rect.maxX &&
        item.minY >= rect.minY &&
        item.maxY <= rect.maxY
      ) {
        enclosed.push(item.id);
      }
    }
    return enclosed;
  }

  clear(): void {
    this.tree.clear();
    this.byId.clear();
    this.xlineIds.clear();
  }
}
