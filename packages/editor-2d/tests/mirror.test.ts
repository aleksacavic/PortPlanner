// M1.3b simple-transforms Phase 3 — Mirror tool generator tests.
// Per AC parity: mirror creates a NEW reflected entity; sources kept
// by default (defaultValue: 'No' on the erase-source sub-prompt).

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

import { mirrorTool } from '../src/tools/mirror';
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

function addLine(p1 = { x: 0, y: 5 }, p2 = { x: 10, y: 5 }) {
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

describe('mirrorTool', () => {
  beforeEach(() => {
    createNewProject(makeProject());
    editorUiActions.setActiveLayerId(LayerId.DEFAULT);
  });
  afterEach(() => {
    resetProjectStoreForTests();
    resetEditorUiStoreForTests();
  });

  it('after second click yields erase-source sub-prompt with defaultValue No', async () => {
    const lineId = addLine();
    editorUiActions.setSelection([lineId]);
    const tool = startTool('mirror', mirrorTool);
    await tick();
    // First mirror line point on x-axis.
    tool.feedInput({ kind: 'point', point: { x: 0, y: 0 } });
    await tick();
    // Second mirror line point.
    tool.feedInput({ kind: 'point', point: { x: 1, y: 0 } });
    await tick();
    const prompt = editorUiStore.getState().commandBar.activePrompt;
    expect(prompt).toBe('Erase source objects? [Yes/No]');
    expect(editorUiStore.getState().commandBar.defaultValue).toBe('No');
    expect(editorUiStore.getState().commandBar.subOptions).toEqual([
      { label: 'Yes', shortcut: 'y' },
      { label: 'No', shortcut: 'n' },
    ]);
    tool.abort();
    await tool.done();
  });

  it('default Enter (No subOption) keeps source (no deletePrimitive call)', async () => {
    const lineId = addLine();
    editorUiActions.setSelection([lineId]);
    const tool = startTool('mirror', mirrorTool);
    await tick();
    tool.feedInput({ kind: 'point', point: { x: 0, y: 0 } });
    await tick();
    tool.feedInput({ kind: 'point', point: { x: 1, y: 0 } });
    await tick();
    // Explicit No subOption (mirrors what handleCommandSubmit produces
    // for the default Enter case via defaultValue mapping).
    tool.feedInput({ kind: 'subOption', optionLabel: 'No' });
    await tool.done();
    // Source still exists; mirrored copy added → 2 primitives total.
    const prims = Object.values(projectStore.getState().project!.primitives);
    expect(prims).toHaveLength(2);
    const ids = new Set(prims.map((p) => p.id));
    expect(ids.has(lineId)).toBe(true); // source kept
  });

  it('Yes subOption deletes source after addPrimitive', async () => {
    const lineId = addLine();
    editorUiActions.setSelection([lineId]);
    const tool = startTool('mirror', mirrorTool);
    await tick();
    tool.feedInput({ kind: 'point', point: { x: 0, y: 0 } });
    await tick();
    tool.feedInput({ kind: 'point', point: { x: 1, y: 0 } });
    await tick();
    tool.feedInput({ kind: 'subOption', optionLabel: 'Yes' });
    await tool.done();
    const prims = Object.values(projectStore.getState().project!.primitives);
    expect(prims).toHaveLength(1); // source deleted; only mirrored copy
    const remainingIds = prims.map((p) => p.id);
    expect(remainingIds).not.toContain(lineId);
  });

  it('Esc at first-mirror-point aborts', async () => {
    editorUiActions.setSelection([addLine()]);
    const tool = startTool('mirror', mirrorTool);
    await tick();
    tool.feedInput({ kind: 'escape' });
    const result = await tool.done();
    expect(result.committed).toBe(false);
  });
});
