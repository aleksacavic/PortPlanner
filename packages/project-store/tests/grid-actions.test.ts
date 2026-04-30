import { LayerId, type Project, defaultLayer, newGridId, newProjectId } from '@portplanner/domain';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createNewProject } from '../src/actions';
import { addGrid, deleteGrid, updateGrid } from '../src/actions/grid-actions';
import { projectStore } from '../src/store';
import { resetProjectStoreForTests } from '../src/test-utils';

function makeProject(): Project {
  return {
    id: newProjectId(),
    schemaVersion: '1.2.0',
    name: 'Test',
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

describe('grid actions', () => {
  beforeEach(() => {
    createNewProject(makeProject());
  });
  afterEach(() => {
    resetProjectStoreForTests();
  });

  it('addGrid stores a grid', () => {
    const id = newGridId();
    addGrid({
      id,
      origin: { x: 0, y: 0 },
      angle: 0,
      spacingX: 6.058,
      spacingY: 2.6,
      layerId: LayerId.DEFAULT,
      visible: true,
      activeForSnap: true,
    });
    expect(projectStore.getState().project?.grids[id]).toBeDefined();
  });

  it('updateGrid mutates fields in place', () => {
    const id = newGridId();
    addGrid({
      id,
      origin: { x: 0, y: 0 },
      angle: 0,
      spacingX: 6,
      spacingY: 6,
      layerId: LayerId.DEFAULT,
      visible: true,
      activeForSnap: false,
    });
    updateGrid(id, { spacingX: 12, activeForSnap: true });
    const g = projectStore.getState().project?.grids[id];
    expect(g?.spacingX).toBe(12);
    expect(g?.activeForSnap).toBe(true);
  });

  it('deleteGrid removes the grid', () => {
    const id = newGridId();
    addGrid({
      id,
      origin: { x: 0, y: 0 },
      angle: 0,
      spacingX: 6,
      spacingY: 6,
      layerId: LayerId.DEFAULT,
      visible: true,
      activeForSnap: false,
    });
    deleteGrid(id);
    expect(projectStore.getState().project?.grids[id]).toBeUndefined();
  });
});
