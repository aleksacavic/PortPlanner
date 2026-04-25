import {
  LayerId,
  type Polyline,
  type Project,
  defaultLayer,
  newProjectId,
} from '@portplanner/domain';
import { createNewProject, projectStore, resetProjectStoreForTests } from '@portplanner/project-store';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { startTool } from '../src/tools/runner';
import { lookupTool } from '../src/tools';

const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

function makeProject(): Project {
  return {
    id: newProjectId(),
    schemaVersion: '1.1.0',
    name: 'T',
    createdAt: '2026-04-25T10:00:00.000Z',
    updatedAt: '2026-04-25T10:00:00.000Z',
    coordinateSystem: null,
    objects: {},
    primitives: {},
    layers: { [LayerId.DEFAULT]: defaultLayer() },
    grids: {},
    scenarioId: null,
  };
}

describe('seven primitive draw tools', () => {
  beforeEach(() => {
    createNewProject(makeProject());
  });
  afterEach(() => resetProjectStoreForTests());

  it('draw-line places a line primitive (2 prompts)', async () => {
    const tool = startTool('draw-line', lookupTool('draw-line')!);
    await tick();
    tool.feedInput({ kind: 'point', point: { x: 0, y: 0 } });
    await tick();
    tool.feedInput({ kind: 'point', point: { x: 10, y: 0 } });
    const result = await tool.done();
    expect(result.committed).toBe(true);
    const lines = Object.values(projectStore.getState().project!.primitives).filter(
      (p) => p.kind === 'line',
    );
    expect(lines).toHaveLength(1);
  });

  it('draw-point places a point', async () => {
    const tool = startTool('draw-point', lookupTool('draw-point')!);
    await tick();
    tool.feedInput({ kind: 'point', point: { x: 5, y: 5 } });
    await tool.done();
    const points = Object.values(projectStore.getState().project!.primitives).filter(
      (p) => p.kind === 'point',
    );
    expect(points).toHaveLength(1);
  });

  it('draw-rectangle places a rectangle with localAxisAngle=0 (M1.3a)', async () => {
    const tool = startTool('draw-rectangle', lookupTool('draw-rectangle')!);
    await tick();
    tool.feedInput({ kind: 'point', point: { x: 0, y: 0 } });
    await tick();
    tool.feedInput({ kind: 'point', point: { x: 5, y: 3 } });
    await tool.done();
    const rects = Object.values(projectStore.getState().project!.primitives).filter(
      (p) => p.kind === 'rectangle',
    );
    expect(rects).toHaveLength(1);
    expect((rects[0] as { localAxisAngle: number }).localAxisAngle).toBe(0);
  });

  it('draw-circle places a circle with center + radius', async () => {
    const tool = startTool('draw-circle', lookupTool('draw-circle')!);
    await tick();
    tool.feedInput({ kind: 'point', point: { x: 0, y: 0 } });
    await tick();
    tool.feedInput({ kind: 'point', point: { x: 3, y: 4 } });
    await tool.done();
    const circles = Object.values(projectStore.getState().project!.primitives).filter(
      (p) => p.kind === 'circle',
    );
    expect(circles).toHaveLength(1);
    expect((circles[0] as { radius: number }).radius).toBeCloseTo(5, 9);
  });

  it('draw-arc 3-point places an arc', async () => {
    const tool = startTool('draw-arc', lookupTool('draw-arc')!);
    await tick();
    tool.feedInput({ kind: 'point', point: { x: 1, y: 0 } });
    await tick();
    tool.feedInput({ kind: 'point', point: { x: 0, y: 1 } });
    await tick();
    tool.feedInput({ kind: 'point', point: { x: -1, y: 0 } });
    await tool.done();
    const arcs = Object.values(projectStore.getState().project!.primitives).filter(
      (p) => p.kind === 'arc',
    );
    expect(arcs).toHaveLength(1);
  });

  it('draw-xline places an xline with computed angle', async () => {
    const tool = startTool('draw-xline', lookupTool('draw-xline')!);
    await tick();
    tool.feedInput({ kind: 'point', point: { x: 0, y: 0 } });
    await tick();
    tool.feedInput({ kind: 'point', point: { x: 10, y: 0 } });
    await tool.done();
    const xs = Object.values(projectStore.getState().project!.primitives).filter(
      (p) => p.kind === 'xline',
    );
    expect(xs).toHaveLength(1);
    expect((xs[0] as { angle: number }).angle).toBeCloseTo(0, 9);
  });

  it('draw-polyline emits zero bulges only (I-48 — M1.3a polyline draw is straight-only)', async () => {
    const tool = startTool('draw-polyline', lookupTool('draw-polyline')!);
    await tick();
    tool.feedInput({ kind: 'point', point: { x: 0, y: 0 } });
    await tick();
    tool.feedInput({ kind: 'point', point: { x: 10, y: 0 } });
    await tick();
    tool.feedInput({ kind: 'point', point: { x: 10, y: 5 } });
    await tick();
    tool.feedInput({ kind: 'subOption', optionLabel: 'Close' });
    await tool.done();
    const polys = Object.values(projectStore.getState().project!.primitives).filter(
      (p) => p.kind === 'polyline',
    );
    expect(polys).toHaveLength(1);
    const poly = polys[0] as Polyline;
    expect(poly.bulges.every((b) => b === 0)).toBe(true);
    expect(poly.closed).toBe(true);
  });

  it('draw-polyline Close requires >=3 vertices', async () => {
    const tool = startTool('draw-polyline', lookupTool('draw-polyline')!);
    await tick();
    tool.feedInput({ kind: 'point', point: { x: 0, y: 0 } });
    await tick();
    tool.feedInput({ kind: 'point', point: { x: 10, y: 0 } });
    await tick();
    tool.feedInput({ kind: 'subOption', optionLabel: 'Close' });
    const result = await tool.done();
    expect(result.committed).toBe(false);
  });
});
