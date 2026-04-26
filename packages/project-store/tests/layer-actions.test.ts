import {
  LayerId,
  type Project,
  defaultLayer,
  newLayerId,
  newPrimitiveId,
  newProjectId,
} from '@portplanner/domain';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createNewProject } from '../src/actions';
import { addLayer, deleteLayer, updateLayer } from '../src/actions/layer-actions';
import { addPrimitive } from '../src/actions/primitive-actions';
import { projectStore } from '../src/store';
import { resetProjectStoreForTests } from '../src/test-utils';

function makeProject(): Project {
  return {
    id: newProjectId(),
    schemaVersion: '1.1.0',
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

describe('layer actions', () => {
  beforeEach(() => {
    createNewProject(makeProject());
  });
  afterEach(() => {
    resetProjectStoreForTests();
  });

  it('addLayer adds a new layer', () => {
    const id = newLayerId();
    addLayer({
      id,
      name: 'Roads',
      color: '#FF0000',
      lineType: 'continuous',
      lineWeight: 0.25,
      visible: true,
      frozen: false,
      locked: false,
    });
    expect(projectStore.getState().project?.layers[id]).toBeDefined();
  });

  it('cannot delete the protected default layer', () => {
    expect(() => deleteLayer(LayerId.DEFAULT)).toThrow(/cannot delete the protected default/);
  });

  it('cannot rename the protected default layer', () => {
    expect(() => updateLayer(LayerId.DEFAULT, { name: 'Renamed' })).toThrow(/cannot rename/);
  });

  it('deleteLayer with referenced entities requires reassignTo', () => {
    const id = newLayerId();
    addLayer({
      id,
      name: 'Roads',
      color: '#FF0000',
      lineType: 'continuous',
      lineWeight: 0.25,
      visible: true,
      frozen: false,
      locked: false,
    });
    const pid = newPrimitiveId();
    addPrimitive({
      id: pid,
      kind: 'line',
      layerId: id,
      displayOverrides: {},
      p1: { x: 0, y: 0 },
      p2: { x: 10, y: 0 },
    });
    expect(() => deleteLayer(id)).toThrow(/reassignTo/);
  });

  it('deleteLayer with reassignTo reassigns referenced entities and deletes the layer', () => {
    const id = newLayerId();
    addLayer({
      id,
      name: 'Roads',
      color: '#FF0000',
      lineType: 'continuous',
      lineWeight: 0.25,
      visible: true,
      frozen: false,
      locked: false,
    });
    const pid = newPrimitiveId();
    addPrimitive({
      id: pid,
      kind: 'line',
      layerId: id,
      displayOverrides: {},
      p1: { x: 0, y: 0 },
      p2: { x: 10, y: 0 },
    });
    deleteLayer(id, { reassignTo: LayerId.DEFAULT });
    const state = projectStore.getState().project;
    expect(state?.layers[id]).toBeUndefined();
    expect(state?.primitives[pid]?.layerId).toBe(LayerId.DEFAULT);
  });

  it('layer rename preserves layerId references (I-15)', () => {
    const id = newLayerId();
    addLayer({
      id,
      name: 'Roads',
      color: '#FF0000',
      lineType: 'continuous',
      lineWeight: 0.25,
      visible: true,
      frozen: false,
      locked: false,
    });
    const pid = newPrimitiveId();
    addPrimitive({
      id: pid,
      kind: 'point',
      layerId: id,
      displayOverrides: {},
      position: { x: 0, y: 0 },
    });
    updateLayer(id, { name: 'Roads-renamed' });
    const state = projectStore.getState().project;
    expect(state?.layers[id]?.name).toBe('Roads-renamed');
    expect(state?.primitives[pid]?.layerId).toBe(id);
  });
});
