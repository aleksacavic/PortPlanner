// M1.3b simple-transforms Phase 2 — Rotate tool generator tests.
// Walkthrough §3.0 row references for each test title.

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

import { rotateTool } from '../src/tools/rotate';
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

describe('rotateTool', () => {
  beforeEach(() => {
    createNewProject(makeProject());
    editorUiActions.setActiveLayerId(LayerId.DEFAULT);
  });
  afterEach(() => {
    resetProjectStoreForTests();
    resetEditorUiStoreForTests();
  });

  it('yields select prompt when selection empty', async () => {
    const tool = startTool('rotate', rotateTool);
    await tick();
    // With empty selection, first yielded prompt is "Select objects".
    const prompt = editorUiStore.getState().commandBar.activePrompt;
    expect(prompt).toBe('Select objects');
    tool.abort();
    await tool.done();
  });

  it('yields base-point prompt directly when selection non-empty', async () => {
    const lineId = newPrimitiveId();
    addPrimitive({
      kind: 'line',
      id: lineId,
      layerId: LayerId.DEFAULT,
      displayOverrides: {},
      p1: { x: 0, y: 0 },
      p2: { x: 10, y: 0 },
    });
    editorUiActions.setSelection([lineId]);
    const tool = startTool('rotate', rotateTool);
    await tick();
    const prompt = editorUiStore.getState().commandBar.activePrompt;
    expect(prompt).toBe('Specify base point');
    tool.abort();
    await tool.done();
  });

  it('third prompt yields rotated-entities preview with live cursor angle', async () => {
    const lineId = newPrimitiveId();
    addPrimitive({
      kind: 'line',
      id: lineId,
      layerId: LayerId.DEFAULT,
      displayOverrides: {},
      p1: { x: 0, y: 0 },
      p2: { x: 10, y: 0 },
    });
    editorUiActions.setSelection([lineId]);
    const tool = startTool('rotate', rotateTool);
    await tick();
    tool.feedInput({ kind: 'point', point: { x: 0, y: 0 } });
    await tick();
    const prompt = editorUiStore.getState().commandBar.activePrompt;
    expect(prompt).toBe('Specify rotation angle or [Reference]');
    expect(editorUiStore.getState().commandBar.subOptions).toEqual([
      { label: 'Reference', shortcut: 'r' },
    ]);
    tool.abort();
    await tool.done();
  });

  it('commit rotates primitives by atan2 of click point', async () => {
    const lineId = newPrimitiveId();
    addPrimitive({
      kind: 'line',
      id: lineId,
      layerId: LayerId.DEFAULT,
      displayOverrides: {},
      p1: { x: 0, y: 0 },
      p2: { x: 10, y: 0 },
    });
    editorUiActions.setSelection([lineId]);
    const tool = startTool('rotate', rotateTool);
    await tick();
    tool.feedInput({ kind: 'point', point: { x: 0, y: 0 } });
    await tick();
    // Click point at (0, 10): angle = π/2 → line rotates 90°.
    tool.feedInput({ kind: 'point', point: { x: 0, y: 10 } });
    await tool.done();
    const after = projectStore.getState().project!.primitives[lineId];
    expect(after?.kind).toBe('line');
    if (after?.kind === 'line') {
      expect(after.p1.x).toBeCloseTo(0, 6);
      expect(after.p1.y).toBeCloseTo(0, 6);
      expect(after.p2.x).toBeCloseTo(0, 6);
      expect(after.p2.y).toBeCloseTo(10, 6);
    }
  });

  it('typed angle commits at locked rotation (DI feedInput angle)', async () => {
    const lineId = newPrimitiveId();
    addPrimitive({
      kind: 'line',
      id: lineId,
      layerId: LayerId.DEFAULT,
      displayOverrides: {},
      p1: { x: 0, y: 0 },
      p2: { x: 10, y: 0 },
    });
    editorUiActions.setSelection([lineId]);
    const tool = startTool('rotate', rotateTool);
    await tick();
    tool.feedInput({ kind: 'point', point: { x: 0, y: 0 } });
    await tick();
    // Typed angle: 90° (π/2 radians).
    tool.feedInput({ kind: 'angle', radians: Math.PI / 2 });
    await tool.done();
    const after = projectStore.getState().project!.primitives[lineId];
    if (after?.kind === 'line') {
      expect(after.p2.x).toBeCloseTo(0, 6);
      expect(after.p2.y).toBeCloseTo(10, 6);
    }
  });

  it('R sub-option opens 2-click reference-angle flow', async () => {
    const lineId = newPrimitiveId();
    addPrimitive({
      kind: 'line',
      id: lineId,
      layerId: LayerId.DEFAULT,
      displayOverrides: {},
      p1: { x: 0, y: 0 },
      p2: { x: 10, y: 0 },
    });
    editorUiActions.setSelection([lineId]);
    const tool = startTool('rotate', rotateTool);
    await tick();
    tool.feedInput({ kind: 'point', point: { x: 0, y: 0 } });
    await tick();
    // Sub-option: Reference.
    tool.feedInput({ kind: 'subOption', optionLabel: 'Reference' });
    await tick();
    const refPrompt = editorUiStore.getState().commandBar.activePrompt;
    expect(refPrompt).toBe('Specify reference angle (pick a point)');
    // Reference angle = 0° (along +x).
    tool.feedInput({ kind: 'point', point: { x: 5, y: 0 } });
    await tick();
    const finalPrompt = editorUiStore.getState().commandBar.activePrompt;
    expect(finalPrompt).toBe('Specify new angle (pick a point)');
    // Final angle = 90° (along +y) → delta = 90° - 0° = 90°.
    tool.feedInput({ kind: 'point', point: { x: 0, y: 5 } });
    await tool.done();
    const after = projectStore.getState().project!.primitives[lineId];
    if (after?.kind === 'line') {
      expect(after.p2.x).toBeCloseTo(0, 6);
      expect(after.p2.y).toBeCloseTo(10, 6);
    }
  });

  it('Esc at base-point aborts', async () => {
    editorUiActions.setSelection([newPrimitiveId()]);
    const tool = startTool('rotate', rotateTool);
    await tick();
    tool.feedInput({ kind: 'escape' });
    const result = await tool.done();
    expect(result.committed).toBe(false);
  });
});
