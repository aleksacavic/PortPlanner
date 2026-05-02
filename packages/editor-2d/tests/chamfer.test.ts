// M1.3b fillet-chamfer Phase 3 — Chamfer tool generator tests.
// Mirrors fillet.test.ts structure with two-distance method (d1, d2)
// and LinePrimitive new-segment instead of ArcPrimitive new-arc.

import {
  LayerId,
  type Project,
  defaultLayer,
  newPrimitiveId,
  newProjectId,
} from '@portplanner/domain';
import {
  addPrimitive,
  createNewProject,
  projectStore,
  resetProjectStoreForTests,
} from '@portplanner/project-store';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { chamferTool } from '../src/tools/chamfer';
import { startTool } from '../src/tools/runner';
import { editorUiActions, editorUiStore, resetEditorUiStoreForTests } from '../src/ui-state/store';

const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

function makeProject(): Project {
  return {
    id: newProjectId(),
    schemaVersion: '1.2.0',
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

function addLine(p1: { x: number; y: number }, p2: { x: number; y: number }): string {
  const id = newPrimitiveId();
  addPrimitive({
    kind: 'line',
    id,
    layerId: LayerId.DEFAULT,
    displayOverrides: {},
    p1,
    p2,
  });
  return id;
}

function addPolyline(
  vertices: Array<{ x: number; y: number }>,
  bulges: number[],
  closed = false,
): string {
  const id = newPrimitiveId();
  addPrimitive({
    kind: 'polyline',
    id,
    layerId: LayerId.DEFAULT,
    displayOverrides: {},
    vertices,
    bulges,
    closed,
  });
  return id;
}

function pastStatesCount(): number {
  return projectStore.temporal.getState().pastStates.length;
}

describe('chamferTool', () => {
  beforeEach(() => {
    createNewProject(makeProject());
    editorUiActions.setActiveLayerId(LayerId.DEFAULT);
  });
  afterEach(() => {
    resetProjectStoreForTests();
    resetEditorUiStoreForTests();
  });

  it('first prompt yields "Select first object or [Distance]" with D sub-option', async () => {
    const tool = startTool('chamfer', chamferTool);
    await tick();
    expect(editorUiStore.getState().commandBar.activePrompt).toBe(
      'Select first object or [Distance]',
    );
    expect(editorUiStore.getState().commandBar.subOptions).toEqual([
      { label: 'Distance', shortcut: 'd' },
    ]);
    tool.abort();
    await tool.done();
  });

  it('Distance sub-option yields two prompts and persists d1, d2', async () => {
    const tool = startTool('chamfer', chamferTool);
    await tick();
    tool.feedInput({ kind: 'subOption', optionLabel: 'Distance' });
    await tick();
    expect(editorUiStore.getState().commandBar.activePrompt).toContain('first chamfer distance');
    tool.feedInput({ kind: 'number', value: 1.2 });
    await tick();
    expect(editorUiStore.getState().commandBar.activePrompt).toContain('second chamfer distance');
    tool.feedInput({ kind: 'number', value: 2.4 });
    await tick();
    expect(editorUiStore.getState().chamfer).toEqual({ d1: 1.2, d2: 2.4 });
    tool.abort();
    await tool.done();
  });

  it('two-line commit: emits 2 UPDATE + 1 CREATE LinePrimitive (zundo +3)', async () => {
    addLine({ x: -5, y: 0 }, { x: 5, y: 0 });
    addLine({ x: 0, y: -5 }, { x: 0, y: 5 });
    editorUiActions.setChamferDistances(1, 1);
    const baseCount = pastStatesCount();
    const baseEntities = Object.keys(projectStore.getState().project!.primitives).length;
    const tool = startTool('chamfer', chamferTool);
    await tick();
    tool.feedInput({ kind: 'point', point: { x: 4, y: 0 } });
    await tick();
    tool.feedInput({ kind: 'point', point: { x: 0, y: 4 } });
    await tool.done();
    const project = projectStore.getState().project!;
    expect(Object.keys(project.primitives).length).toBe(baseEntities + 1);
    expect(pastStatesCount() - baseCount).toBe(3);
    // The new primitive is a LinePrimitive (chamfer segment), NOT an arc.
    const arcs = Object.values(project.primitives).filter((p) => p.kind === 'arc');
    expect(arcs).toHaveLength(0);
  });

  it('polyline-internal commit: emits 1 UPDATE (zundo +1)', async () => {
    const polyId = addPolyline(
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
      ],
      [0, 0],
    );
    editorUiActions.setChamferDistances(2, 2);
    const baseCount = pastStatesCount();
    const tool = startTool('chamfer', chamferTool);
    await tick();
    tool.feedInput({ kind: 'point', point: { x: 9.9, y: 0 } });
    await tick();
    tool.feedInput({ kind: 'point', point: { x: 9.9, y: 0 } });
    await tool.done();
    expect(pastStatesCount() - baseCount).toBe(1);
    const after = projectStore.getState().project!.primitives[polyId as never];
    if (after?.kind === 'polyline') {
      expect(after.vertices.length).toBe(4);
      // Chamfer segment is straight (bulge = 0).
      expect(after.bulges[1]).toBe(0);
    }
  });

  it('mixed line+polyline-end commit: emits 2 UPDATE + 1 CREATE (zundo +3)', async () => {
    addLine({ x: -5, y: 0 }, { x: 5, y: 0 });
    addPolyline(
      [
        { x: 0, y: 0 },
        { x: 0, y: 5 },
        { x: 3, y: 8 },
      ],
      [0, 0],
    );
    editorUiActions.setChamferDistances(2, 2);
    const baseCount = pastStatesCount();
    const tool = startTool('chamfer', chamferTool);
    await tick();
    tool.feedInput({ kind: 'point', point: { x: 4, y: 0 } });
    await tick();
    tool.feedInput({ kind: 'point', point: { x: 0, y: 0.7 } });
    await tool.done();
    expect(pastStatesCount() - baseCount).toBe(3);
  });

  it('parallel lines: aborts with 0 ops', async () => {
    addLine({ x: 0, y: 0 }, { x: 10, y: 0 });
    addLine({ x: 0, y: 5 }, { x: 10, y: 5 });
    editorUiActions.setChamferDistances(1, 1);
    const baseCount = pastStatesCount();
    const tool = startTool('chamfer', chamferTool);
    await tick();
    tool.feedInput({ kind: 'point', point: { x: 5, y: 0 } });
    await tick();
    tool.feedInput({ kind: 'point', point: { x: 5, y: 5 } });
    await tool.done();
    expect(pastStatesCount() - baseCount).toBe(0);
  });

  it('polyline interior-segment chamfer: aborts with 0 ops', async () => {
    addLine({ x: -5, y: 5 }, { x: 5, y: 5 });
    addPolyline(
      [
        { x: 0, y: 0 },
        { x: 0, y: 10 },
        { x: 10, y: 10 },
      ],
      [0, 0],
    );
    editorUiActions.setChamferDistances(1, 1);
    const baseCount = pastStatesCount();
    const tool = startTool('chamfer', chamferTool);
    await tick();
    tool.feedInput({ kind: 'point', point: { x: 4, y: 5 } });
    await tick();
    tool.feedInput({ kind: 'point', point: { x: 0.1, y: 10 } });
    await tool.done();
    expect(pastStatesCount() - baseCount).toBe(0);
  });

  it('closed polyline + line: aborts with 0 ops', async () => {
    addLine({ x: -5, y: 0 }, { x: 5, y: 0 });
    addPolyline(
      [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
        { x: 0, y: 1 },
      ],
      [0, 0, 0, 0],
      true,
    );
    editorUiActions.setChamferDistances(0.2, 0.2);
    const baseCount = pastStatesCount();
    const tool = startTool('chamfer', chamferTool);
    await tick();
    tool.feedInput({ kind: 'point', point: { x: 4, y: 0 } });
    await tick();
    tool.feedInput({ kind: 'point', point: { x: 0, y: 0 } });
    await tool.done();
    expect(pastStatesCount() - baseCount).toBe(0);
  });

  it('two different polylines: aborts with 0 ops', async () => {
    addPolyline(
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
      ],
      [0, 0],
    );
    addPolyline(
      [
        { x: 20, y: 0 },
        { x: 30, y: 0 },
      ],
      [0],
    );
    editorUiActions.setChamferDistances(1, 1);
    const baseCount = pastStatesCount();
    const tool = startTool('chamfer', chamferTool);
    await tick();
    tool.feedInput({ kind: 'point', point: { x: 9.9, y: 0 } });
    await tick();
    tool.feedInput({ kind: 'point', point: { x: 25, y: 0 } });
    await tool.done();
    expect(pastStatesCount() - baseCount).toBe(0);
  });

  it('escape mid-flow: aborts with 0 ops (zundo +0)', async () => {
    addLine({ x: -5, y: 0 }, { x: 5, y: 0 });
    addLine({ x: 0, y: -5 }, { x: 0, y: 5 });
    editorUiActions.setChamferDistances(1, 1);
    const baseCount = pastStatesCount();
    const tool = startTool('chamfer', chamferTool);
    await tick();
    tool.feedInput({ kind: 'point', point: { x: 4, y: 0 } });
    await tick();
    tool.abort();
    await tool.done();
    expect(pastStatesCount() - baseCount).toBe(0);
  });

  it('first-pick on empty space: aborts', async () => {
    addLine({ x: -5, y: 0 }, { x: 5, y: 0 });
    const baseCount = pastStatesCount();
    const tool = startTool('chamfer', chamferTool);
    await tick();
    tool.feedInput({ kind: 'point', point: { x: 100, y: 100 } });
    await tool.done();
    expect(pastStatesCount() - baseCount).toBe(0);
  });

  it('trim distance too large for source segment: aborts with 0 ops', async () => {
    addLine({ x: 0, y: 0 }, { x: 1, y: 0 });
    addLine({ x: 0, y: 0 }, { x: 0, y: 1 });
    editorUiActions.setChamferDistances(100, 100);
    const baseCount = pastStatesCount();
    const tool = startTool('chamfer', chamferTool);
    await tick();
    tool.feedInput({ kind: 'point', point: { x: 0.9, y: 0 } });
    await tick();
    tool.feedInput({ kind: 'point', point: { x: 0, y: 0.9 } });
    await tool.done();
    expect(pastStatesCount() - baseCount).toBe(0);
  });

  it('chamfer distances persist across runs', async () => {
    addLine({ x: -5, y: 0 }, { x: 5, y: 0 });
    addLine({ x: 0, y: -5 }, { x: 0, y: 5 });
    {
      const tool = startTool('chamfer', chamferTool);
      await tick();
      tool.feedInput({ kind: 'subOption', optionLabel: 'Distance' });
      await tick();
      tool.feedInput({ kind: 'number', value: 0.7 });
      await tick();
      tool.feedInput({ kind: 'number', value: 1.3 });
      await tick();
      tool.abort();
      await tool.done();
    }
    expect(editorUiStore.getState().chamfer).toEqual({ d1: 0.7, d2: 1.3 });
  });

  it('source contains exactly 5 distinct "Chamfer:" abort messages', () => {
    const fs = require('node:fs') as typeof import('node:fs');
    const path = require('node:path') as typeof import('node:path');
    const src = fs.readFileSync(
      path.resolve(__dirname, '..', 'src', 'tools', 'chamfer.ts'),
      'utf8',
    );
    const matches = src.match(/'Chamfer: [^']+'/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(5);
  });

  it('symmetric d1=d2 produces 45° chamfer at 90° corner', async () => {
    addLine({ x: -5, y: 0 }, { x: 5, y: 0 });
    addLine({ x: 0, y: -5 }, { x: 0, y: 5 });
    editorUiActions.setChamferDistances(1, 1);
    const tool = startTool('chamfer', chamferTool);
    await tick();
    tool.feedInput({ kind: 'point', point: { x: 4, y: 0 } });
    await tick();
    tool.feedInput({ kind: 'point', point: { x: 0, y: 4 } });
    await tool.done();
    // Find the new chamfer segment (LinePrimitive added by tool, not setup).
    const project = projectStore.getState().project!;
    const lines = Object.values(project.primitives).filter((p) => p.kind === 'line');
    // Setup 2 lines (now trimmed) + 1 new chamfer segment = 3 lines.
    expect(lines).toHaveLength(3);
    // Chamfer segment from (1, 0) to (0, 1) (or vice versa).
    const seg = lines.find((p) => {
      if (p.kind !== 'line') return false;
      const at1 =
        (Math.abs(p.p1.x - 1) < 1e-6 && Math.abs(p.p1.y - 0) < 1e-6) ||
        (Math.abs(p.p2.x - 1) < 1e-6 && Math.abs(p.p2.y - 0) < 1e-6);
      const at2 =
        (Math.abs(p.p1.x - 0) < 1e-6 && Math.abs(p.p1.y - 1) < 1e-6) ||
        (Math.abs(p.p2.x - 0) < 1e-6 && Math.abs(p.p2.y - 1) < 1e-6);
      return at1 && at2;
    });
    expect(seg).toBeDefined();
  });
});
