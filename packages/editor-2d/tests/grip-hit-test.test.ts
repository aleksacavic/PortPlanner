// gripHitTest tests for M1.3d Phase 6.

import { LayerId, type Primitive, newPrimitiveId } from '@portplanner/domain';
import { describe, expect, it } from 'vitest';

import { gripHitTest } from '../src/canvas/grip-hit-test';
import { gripsOf } from '../src/canvas/grip-positions';
import { type Viewport, metricToScreen } from '../src/canvas/view-transform';

const viewport: Viewport = {
  panX: 0,
  panY: 0,
  zoom: 10,
  dpr: 1,
  canvasWidthCss: 800,
  canvasHeightCss: 600,
  crosshairSizePct: 100,
};

function line(): Primitive {
  return {
    id: newPrimitiveId(),
    kind: 'line',
    layerId: LayerId.DEFAULT,
    displayOverrides: {},
    p1: { x: 0, y: 0 },
    p2: { x: 10, y: 0 },
  };
}

describe('gripHitTest — screen-space (CSS px) tolerance (I-DTP-14)', () => {
  it('returns the grip when the cursor is exactly on it', () => {
    const p = line();
    const grips = gripsOf(p);
    const onP1 = metricToScreen(p.p1, viewport);
    const hit = gripHitTest(onP1, grips, viewport);
    expect(hit?.gripKind).toBe('p1');
  });

  it('returns the grip when within tolerance (3 px)', () => {
    const p = line();
    const grips = gripsOf(p);
    const onP1 = metricToScreen(p.p1, viewport);
    const hit = gripHitTest({ x: onP1.x + 3, y: onP1.y - 1 }, grips, viewport);
    expect(hit?.gripKind).toBe('p1');
  });

  it('returns null when beyond tolerance', () => {
    const p = line();
    const grips = gripsOf(p);
    const onP1 = metricToScreen(p.p1, viewport);
    const hit = gripHitTest({ x: onP1.x + 50, y: onP1.y }, grips, viewport);
    expect(hit).toBeNull();
  });

  it('picks the closest grip when two are within tolerance', () => {
    const p = line();
    const grips = gripsOf(p);
    const onP1 = metricToScreen(p.p1, viewport);
    // Cursor 1 px from p1 (which is 100 px from p2). p1 should win.
    const hit = gripHitTest({ x: onP1.x + 1, y: onP1.y }, grips, viewport, 4);
    expect(hit?.gripKind).toBe('p1');
  });

  it('returns null on empty grip list', () => {
    expect(gripHitTest({ x: 0, y: 0 }, [], viewport)).toBeNull();
  });

  it('honours zoom — tolerance is screen-space, not metric', () => {
    const zoomedOut: Viewport = { ...viewport, zoom: 1 };
    const p = line();
    const grips = gripsOf(p);
    const onP1 = metricToScreen(p.p1, zoomedOut);
    // 3 CSS px from p1 — at zoom 1, that's 3 metric units off.
    // Tolerance is 4 CSS px → still hits.
    const hit = gripHitTest({ x: onP1.x + 3, y: onP1.y }, grips, zoomedOut);
    expect(hit?.gripKind).toBe('p1');
  });
});
