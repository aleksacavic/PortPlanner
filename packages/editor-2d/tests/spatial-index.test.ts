import { LayerId, type Primitive, newPrimitiveId } from '@portplanner/domain';
import { describe, expect, it } from 'vitest';

import { PrimitiveSpatialIndex } from '../src/canvas/spatial-index';

function line(p1: { x: number; y: number }, p2: { x: number; y: number }): Primitive {
  return {
    id: newPrimitiveId(),
    kind: 'line',
    layerId: LayerId.DEFAULT,
    displayOverrides: {},
    p1,
    p2,
  };
}

describe('PrimitiveSpatialIndex', () => {
  it('insert + searchFrustum returns ids whose bbox intersects', () => {
    const idx = new PrimitiveSpatialIndex();
    const a = line({ x: 0, y: 0 }, { x: 10, y: 0 });
    const b = line({ x: 100, y: 100 }, { x: 110, y: 110 });
    idx.insert(a);
    idx.insert(b);
    const hits = idx.searchFrustum({ minX: -5, minY: -5, maxX: 50, maxY: 50 });
    expect(hits).toContain(a.id);
    expect(hits).not.toContain(b.id);
  });

  it('remove drops the id from search results', () => {
    const idx = new PrimitiveSpatialIndex();
    const a = line({ x: 0, y: 0 }, { x: 10, y: 0 });
    idx.insert(a);
    idx.remove(a.id);
    const hits = idx.searchFrustum({ minX: -50, minY: -50, maxX: 50, maxY: 50 });
    expect(hits).not.toContain(a.id);
  });

  it('update re-bboxes after a coord change', () => {
    const idx = new PrimitiveSpatialIndex();
    const a = line({ x: 0, y: 0 }, { x: 10, y: 0 });
    idx.insert(a);
    const moved: Primitive = { ...a, p1: { x: 200, y: 200 }, p2: { x: 210, y: 210 } };
    idx.update(moved);
    const farHits = idx.searchFrustum({ minX: 100, minY: 100, maxX: 300, maxY: 300 });
    const nearHits = idx.searchFrustum({ minX: -50, minY: -50, maxX: 50, maxY: 50 });
    expect(farHits).toContain(a.id);
    expect(nearHits).not.toContain(a.id);
  });

  it('xlines are returned regardless of frustum (infinite extent)', () => {
    const idx = new PrimitiveSpatialIndex();
    const x: Primitive = {
      id: newPrimitiveId(),
      kind: 'xline',
      layerId: LayerId.DEFAULT,
      displayOverrides: {},
      pivot: { x: 0, y: 0 },
      angle: 0,
    };
    idx.insert(x);
    const hits = idx.searchFrustum({ minX: 1000, minY: 1000, maxX: 2000, maxY: 2000 });
    expect(hits).toContain(x.id);
  });

  // M1.3d Phase 7 — searchEnclosed (window selection)
  describe('searchEnclosed (M1.3d Phase 7, I-DTP-16)', () => {
    it('returns ids whose bbox is FULLY inside the rect', () => {
      const idx = new PrimitiveSpatialIndex();
      const inside = line({ x: 1, y: 1 }, { x: 4, y: 4 });
      const partial = line({ x: 3, y: 3 }, { x: 100, y: 100 });
      const outside = line({ x: 200, y: 200 }, { x: 210, y: 210 });
      idx.insert(inside);
      idx.insert(partial);
      idx.insert(outside);
      const hits = idx.searchEnclosed({ minX: 0, minY: 0, maxX: 10, maxY: 10 });
      expect(hits).toContain(inside.id);
      expect(hits).not.toContain(partial.id);
      expect(hits).not.toContain(outside.id);
    });

    it('an entity touching but not strictly inside is NOT enclosed (boundary inclusive)', () => {
      const idx = new PrimitiveSpatialIndex();
      // bbox: minX=0, maxX=10. rect: minX=0, maxX=10. Boundary case
      // — bbox.minX >= rect.minX AND bbox.maxX <= rect.maxX → enclosed.
      const onBoundary = line({ x: 0, y: 0 }, { x: 10, y: 5 });
      idx.insert(onBoundary);
      const hits = idx.searchEnclosed({ minX: 0, minY: 0, maxX: 10, maxY: 10 });
      expect(hits).toContain(onBoundary.id);
    });

    it('xlines are EXCLUDED from window selection (infinite extent never fully encloseable)', () => {
      const idx = new PrimitiveSpatialIndex();
      const x: Primitive = {
        id: newPrimitiveId(),
        kind: 'xline',
        layerId: LayerId.DEFAULT,
        displayOverrides: {},
        pivot: { x: 0, y: 0 },
        angle: 0,
      };
      idx.insert(x);
      const hits = idx.searchEnclosed({ minX: -1000, minY: -1000, maxX: 1000, maxY: 1000 });
      expect(hits).not.toContain(x.id);
    });
  });

  // M1.3d-Remediation-2 R5 — searchCrossing (geometric wire intersect)
  describe('searchCrossing (M1.3d-Remediation-2 R5)', () => {
    it('returns ids whose actual wire intersects the rect', () => {
      const idx = new PrimitiveSpatialIndex();
      const insideLine = line({ x: 1, y: 1 }, { x: 4, y: 4 });
      const crossingLine = line({ x: -5, y: 5 }, { x: 15, y: 5 });
      idx.insert(insideLine);
      idx.insert(crossingLine);
      const primitives = {
        [insideLine.id]: insideLine,
        [crossingLine.id]: crossingLine,
      };
      const hits = idx.searchCrossing({ minX: 0, minY: 0, maxX: 10, maxY: 10 }, primitives);
      expect(hits).toContain(insideLine.id);
      expect(hits).toContain(crossingLine.id);
    });

    it('REJECTS bbox-overlap candidates whose wire does NOT cross the rect (the diagonal-line regression)', () => {
      const idx = new PrimitiveSpatialIndex();
      // Diagonal line whose AABB encompasses the rect but whose wire
      // stays well clear: from (-5, 50) to (50, -5). At rect's x ∈ [10, 15],
      // the line's y is ~33-37 (well above rect's y ∈ [10, 15]).
      const diagonal = line({ x: -5, y: 50 }, { x: 50, y: -5 });
      idx.insert(diagonal);
      const primitives = { [diagonal.id]: diagonal };
      // searchFrustum (bbox-only, the OLD behavior) WOULD return this id.
      const frustumHits = idx.searchFrustum({
        minX: 10,
        minY: 10,
        maxX: 15,
        maxY: 15,
      });
      expect(frustumHits).toContain(diagonal.id); // bbox-only: false positive
      // searchCrossing (wire-aware, the NEW behavior) MUST NOT return it.
      const crossingHits = idx.searchCrossing(
        { minX: 10, minY: 10, maxX: 15, maxY: 15 },
        primitives,
      );
      expect(crossingHits).not.toContain(diagonal.id);
    });
  });
});
