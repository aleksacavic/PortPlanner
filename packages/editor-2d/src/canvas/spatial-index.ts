// rbush wrapper + per-entity-id tracking. Xlines kept in a separate
// list (infinite extent — not insertable into rbush).

import type { Primitive, PrimitiveId } from '@portplanner/domain';
import RBush from 'rbush';

import { type BBox, bboxOfPrimitive } from './bounding-boxes';

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
   * M1.3d Phase 7 — window-selection (fully-enclosed) helper. Returns
   * finite-bbox primitive ids whose ENTIRE bbox lies inside `rect`.
   * Implementation: rbush-search the rect for candidates, then filter
   * by per-item bbox-inside-rect. Xlines are intentionally EXCLUDED
   * because their infinite extent can never be fully enclosed
   * (matches AutoCAD behaviour where construction lines are
   * crossing-only).
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
