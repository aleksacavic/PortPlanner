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
});
