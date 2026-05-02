// M1.3b simple-transforms Phase 4 — Scale tool generator tests.
// Per I-MOD-7: factor === 0 rejected (degenerate); factor < 0 allowed
// (AC flip). Tests cover both branches explicitly.

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

import { startTool } from '../src/tools/runner';
import { scaleTool } from '../src/tools/scale';
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

function addLine() {
  const id = newPrimitiveId();
  addPrimitive({
    kind: 'line',
    id,
    layerId: LayerId.DEFAULT,
    displayOverrides: {},
    p1: { x: 0, y: 0 },
    p2: { x: 10, y: 0 },
  });
  return id;
}

describe('scaleTool', () => {
  beforeEach(() => {
    createNewProject(makeProject());
    editorUiActions.setActiveLayerId(LayerId.DEFAULT);
  });
  afterEach(() => {
    resetProjectStoreForTests();
    resetEditorUiStoreForTests();
  });

  it('third prompt yields scaled-entities preview with cursor-distance factor', async () => {
    editorUiActions.setSelection([addLine()]);
    const tool = startTool('scale', scaleTool);
    await tick();
    tool.feedInput({ kind: 'point', point: { x: 0, y: 0 } });
    await tick();
    const prompt = editorUiStore.getState().commandBar.activePrompt;
    expect(prompt).toBe('Specify scale factor or [Reference]');
    expect(editorUiStore.getState().commandBar.subOptions).toEqual([
      { label: 'Reference', shortcut: 'r' },
    ]);
    tool.abort();
    await tool.done();
  });

  it('typed factor commits at locked scale (DI feedInput number)', async () => {
    const lineId = addLine();
    editorUiActions.setSelection([lineId]);
    const tool = startTool('scale', scaleTool);
    await tick();
    tool.feedInput({ kind: 'point', point: { x: 0, y: 0 } });
    await tick();
    tool.feedInput({ kind: 'number', value: 2 });
    await tool.done();
    const after = projectStore.getState().project!.primitives[lineId];
    if (after?.kind === 'line') {
      expect(after.p2.x).toBeCloseTo(20, 6);
    }
  });

  it('factor === 0 input aborts tool (degenerate)', async () => {
    editorUiActions.setSelection([addLine()]);
    const tool = startTool('scale', scaleTool);
    await tick();
    tool.feedInput({ kind: 'point', point: { x: 0, y: 0 } });
    await tick();
    tool.feedInput({ kind: 'number', value: 0 });
    const result = await tool.done();
    expect(result.committed).toBe(false);
  });

  it('factor === -2 input commits flipped-and-scaled result (AC parity flip semantics)', async () => {
    const lineId = addLine();
    editorUiActions.setSelection([lineId]);
    const tool = startTool('scale', scaleTool);
    await tick();
    // Base at (5, 0) — middle of line.
    tool.feedInput({ kind: 'point', point: { x: 5, y: 0 } });
    await tick();
    tool.feedInput({ kind: 'number', value: -2 });
    await tool.done();
    // Line (0,0)-(10,0) scaled by -2 about (5,0):
    //   p1' = 5 + -2*(0-5) = 5 + 10 = 15
    //   p2' = 5 + -2*(10-5) = 5 - 10 = -5
    const after = projectStore.getState().project!.primitives[lineId];
    if (after?.kind === 'line') {
      expect(after.p1.x).toBeCloseTo(15, 6);
      expect(after.p2.x).toBeCloseTo(-5, 6);
    }
  });

  it('R sub-option opens 2-click reference-distance flow', async () => {
    const lineId = addLine();
    editorUiActions.setSelection([lineId]);
    const tool = startTool('scale', scaleTool);
    await tick();
    tool.feedInput({ kind: 'point', point: { x: 0, y: 0 } });
    await tick();
    tool.feedInput({ kind: 'subOption', optionLabel: 'Reference' });
    await tick();
    expect(editorUiStore.getState().commandBar.activePrompt).toBe(
      'Specify reference distance (pick a point)',
    );
    // refDist = 5
    tool.feedInput({ kind: 'point', point: { x: 5, y: 0 } });
    await tick();
    expect(editorUiStore.getState().commandBar.activePrompt).toBe(
      'Specify new distance (pick a point)',
    );
    // newDist = 10 → factor = 10/5 = 2.
    tool.feedInput({ kind: 'point', point: { x: 10, y: 0 } });
    await tool.done();
    const after = projectStore.getState().project!.primitives[lineId];
    if (after?.kind === 'line') {
      expect(after.p2.x).toBeCloseTo(20, 6);
    }
  });

  it('Esc at base-point aborts', async () => {
    editorUiActions.setSelection([addLine()]);
    const tool = startTool('scale', scaleTool);
    await tick();
    tool.feedInput({ kind: 'escape' });
    const result = await tool.done();
    expect(result.committed).toBe(false);
  });
});
