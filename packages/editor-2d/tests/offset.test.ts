// M1.3b simple-transforms Phase 5 — Offset tool generator tests.

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

import { offsetTool } from '../src/tools/offset';
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

describe('offsetTool', () => {
  beforeEach(() => {
    createNewProject(makeProject());
    editorUiActions.setActiveLayerId(LayerId.DEFAULT);
  });
  afterEach(() => {
    resetProjectStoreForTests();
    resetEditorUiStoreForTests();
  });

  it('second prompt yields offset-distance with DI number manifest', async () => {
    const lineId = addLine();
    editorUiActions.setSelection([lineId]);
    const tool = startTool('offset', offsetTool);
    await tick();
    const prompt = editorUiStore.getState().commandBar.activePrompt;
    expect(prompt).toBe('Specify offset distance');
    expect(editorUiStore.getState().commandBar.dynamicInput?.manifest.combineAs).toBe('number');
    tool.abort();
    await tool.done();
  });

  it('third prompt yields offset-preview with live cursor side', async () => {
    const lineId = addLine();
    editorUiActions.setSelection([lineId]);
    const tool = startTool('offset', offsetTool);
    await tick();
    tool.feedInput({ kind: 'number', value: 2 });
    await tick();
    expect(editorUiStore.getState().commandBar.activePrompt).toBe(
      'Specify point on side to offset',
    );
    tool.abort();
    await tool.done();
  });

  it('commit creates offset entity at distance × side via addPrimitive', async () => {
    const lineId = addLine();
    editorUiActions.setSelection([lineId]);
    const tool = startTool('offset', offsetTool);
    await tick();
    tool.feedInput({ kind: 'number', value: 2 });
    await tick();
    // Click above the line (y > 0) → side = +1 → offset goes up by 2.
    tool.feedInput({ kind: 'point', point: { x: 5, y: 5 } });
    await tool.done();
    const prims = Object.values(projectStore.getState().project!.primitives);
    expect(prims).toHaveLength(2); // source + offset copy
    const offsetCopy = prims.find((p) => p.id !== lineId);
    if (offsetCopy?.kind === 'line') {
      expect(offsetCopy.p1.y).toBeCloseTo(2, 6);
      expect(offsetCopy.p2.y).toBeCloseTo(2, 6);
    }
  });

  it('Esc at distance-prompt aborts', async () => {
    editorUiActions.setSelection([addLine()]);
    const tool = startTool('offset', offsetTool);
    await tick();
    tool.feedInput({ kind: 'escape' });
    const result = await tool.done();
    expect(result.committed).toBe(false);
  });
});
