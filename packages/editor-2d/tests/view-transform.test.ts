import { describe, expect, it } from 'vitest';

import {
  type Viewport,
  metricToScreen,
  screenToMetric,
  viewportFrustum,
} from '../src/canvas/view-transform';

const baseViewport: Viewport = {
  panX: 0,
  panY: 0,
  zoom: 10, // 10 px per metre
  dpr: 1,
  canvasWidthCss: 800,
  canvasHeightCss: 600,
};

describe('view-transform', () => {
  it('round-trips screenToMetric(metricToScreen(p)) within 1e-9 (I-22)', () => {
    const samples = [
      { x: 0, y: 0 },
      { x: 5.5, y: -3.25 },
      { x: 100, y: 200 },
      { x: -50, y: -25 },
    ];
    for (const p of samples) {
      const s = metricToScreen(p, baseViewport);
      const back = screenToMetric(s, baseViewport);
      expect(Math.abs(back.x - p.x)).toBeLessThan(1e-9);
      expect(Math.abs(back.y - p.y)).toBeLessThan(1e-9);
    }
  });

  it('round-trips under non-default pan + zoom + dpr', () => {
    const v: Viewport = { ...baseViewport, panX: 17.3, panY: -42.1, zoom: 25.7, dpr: 2 };
    for (const p of [
      { x: 0, y: 0 },
      { x: 1.234567, y: -8.765432 },
    ]) {
      const back = screenToMetric(metricToScreen(p, v), v);
      expect(Math.abs(back.x - p.x)).toBeLessThan(1e-9);
      expect(Math.abs(back.y - p.y)).toBeLessThan(1e-9);
    }
  });

  it('flips Y axis (canvas Y grows down, metric Y grows up)', () => {
    const above = metricToScreen({ x: 0, y: 10 }, baseViewport);
    const below = metricToScreen({ x: 0, y: -10 }, baseViewport);
    expect(above.y).toBeLessThan(below.y);
  });

  it('viewportFrustum is symmetric around pan and scaled by zoom', () => {
    const f = viewportFrustum({ ...baseViewport, panX: 0, panY: 0 });
    expect(f.minX).toBe(-40); // 800/2/10
    expect(f.maxX).toBe(40);
    expect(f.minY).toBe(-30);
    expect(f.maxY).toBe(30);
  });
});
