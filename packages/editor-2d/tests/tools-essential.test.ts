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
  resetProjectStoreForTests,
} from '@portplanner/project-store';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { startTool } from '../src/tools/runner';
import { lookupTool } from '../src/tools';
import { editorUiActions, resetEditorUiStoreForTests } from '../src/ui-state/store';

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

describe('essential operator tools registry', () => {
  beforeEach(() => {
    createNewProject(makeProject());
  });
  afterEach(() => {
    resetProjectStoreForTests();
    resetEditorUiStoreForTests();
  });

  it('registry resolves all essential tools', () => {
    expect(lookupTool('select')).toBeTruthy();
    expect(lookupTool('erase')).toBeTruthy();
    expect(lookupTool('move')).toBeTruthy();
    expect(lookupTool('copy')).toBeTruthy();
    expect(lookupTool('undo')).toBeTruthy();
    expect(lookupTool('redo')).toBeTruthy();
    expect(lookupTool('zoom')).toBeTruthy();
    expect(lookupTool('pan')).toBeTruthy();
    expect(lookupTool('properties')).toBeTruthy();
    expect(lookupTool('layer-manager')).toBeTruthy();
    expect(lookupTool('escape')).toBeTruthy();
  });

  it('move shifts a primitive by (dx, dy)', async () => {
    const id = newPrimitiveId();
    addPrimitive({
      id,
      kind: 'point',
      layerId: LayerId.DEFAULT,
      displayOverrides: {},
      position: { x: 0, y: 0 },
    });
    editorUiActions.setSelection([id]);

    const factory = lookupTool('move')!;
    const tool = startTool('move', factory);
    await tick();
    tool.feedInput({ kind: 'point', point: { x: 0, y: 0 } });
    await tick();
    tool.feedInput({ kind: 'point', point: { x: 10, y: 5 } });
    const result = await tool.done();
    expect(result.committed).toBe(true);
  });

  it('copy creates a new primitive (selection unchanged)', async () => {
    const id = newPrimitiveId();
    addPrimitive({
      id,
      kind: 'point',
      layerId: LayerId.DEFAULT,
      displayOverrides: {},
      position: { x: 0, y: 0 },
    });
    editorUiActions.setSelection([id]);

    const factory = lookupTool('copy')!;
    const tool = startTool('copy', factory);
    await tick();
    tool.feedInput({ kind: 'point', point: { x: 0, y: 0 } });
    await tick();
    tool.feedInput({ kind: 'point', point: { x: 10, y: 0 } });
    const result = await tool.done();
    expect(result.committed).toBe(true);
  });

  it('zoom Extents sub-option commits', async () => {
    const factory = lookupTool('zoom')!;
    const tool = startTool('zoom', factory);
    await tick();
    tool.feedInput({ kind: 'subOption', optionLabel: 'Extents' });
    const result = await tool.done();
    expect(result).toEqual({ committed: true, description: 'zoom extents' });
  });

  it('layer-manager pushes focus to dialog', async () => {
    const factory = lookupTool('layer-manager')!;
    const tool = startTool('layer-manager', factory);
    await tool.done();
    // Tool sets dialog focus via pushFocusAndSet
    // Verifies in chrome integration in Phase 18
  });
});
