import { LayerId, type Primitive, newPrimitiveId } from '@portplanner/domain';
import { describe, expect, it } from 'vitest';

import { hitTest } from '../src/canvas/hit-test';
import { PrimitiveSpatialIndex } from '../src/canvas/spatial-index';
import type { Viewport } from '../src/canvas/view-transform';

const viewport: Viewport = {
  panX: 0,
  panY: 0,
  zoom: 10,
  dpr: 1,
  canvasWidthCss: 800,
  canvasHeightCss: 600,
};

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

describe('hit-test', () => {
  it('returns the line id when cursor is near it', () => {
    const idx = new PrimitiveSpatialIndex();
    const a = line({ x: 0, y: 0 }, { x: 10, y: 0 });
    idx.insert(a);
    const map = { [a.id]: a } as never;
    // Metric (5, 0) → screen 400+50, 300-0 = (450, 300)
    const id = hitTest({ x: 450, y: 300 }, viewport, idx, map);
    expect(id).toBe(a.id);
  });

  it('returns null when cursor is far from all primitives', () => {
    const idx = new PrimitiveSpatialIndex();
    const a = line({ x: 0, y: 0 }, { x: 10, y: 0 });
    idx.insert(a);
    const map = { [a.id]: a } as never;
    // Far corner of canvas
    const id = hitTest({ x: 0, y: 0 }, viewport, idx, map);
    expect(id).toBeNull();
  });
});
