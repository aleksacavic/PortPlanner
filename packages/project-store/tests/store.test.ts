import {
  LayerId,
  type Project,
  defaultLayer,
  newProjectId,
} from '@portplanner/domain';
import { afterEach, describe, expect, it } from 'vitest';

import { createNewProject, hydrateProject, markSaved } from '../src/actions';
import { projectStore } from '../src/store';
import { resetProjectStoreForTests } from '../src/test-utils';

function makeProject(): Project {
  return {
    id: newProjectId(),
    schemaVersion: '1.1.0',
    name: 'Test Port',
    createdAt: '2026-04-25T10:00:00.000Z',
    updatedAt: '2026-04-25T10:00:00.000Z',
    coordinateSystem: null,
    objects: {},
    primitives: {},
    layers: {},
    grids: {},
    scenarioId: null,
  };
}

describe('project store actions', () => {
  afterEach(() => {
    resetProjectStoreForTests();
  });

  it('createNewProject sets project, dirty=true, lastSavedAt=null', () => {
    const p = makeProject();
    createNewProject(p);
    const s = projectStore.getState();
    expect(s.project?.id).toBe(p.id);
    expect(s.dirty).toBe(true);
    expect(s.lastSavedAt).toBeNull();
  });

  it('createNewProject seeds default layer when missing (I-12)', () => {
    const p = makeProject();
    expect(p.layers[LayerId.DEFAULT]).toBeUndefined();
    createNewProject(p);
    const s = projectStore.getState();
    expect(s.project?.layers[LayerId.DEFAULT]).toBeDefined();
    expect(s.project?.layers[LayerId.DEFAULT]?.name).toBe('0');
  });

  it('createNewProject preserves an explicit default layer if already present', () => {
    const p = makeProject();
    const customDefault = { ...defaultLayer(), name: '0', color: '#AABBCC' };
    p.layers[LayerId.DEFAULT] = customDefault;
    createNewProject(p);
    const s = projectStore.getState();
    expect(s.project?.layers[LayerId.DEFAULT]?.color).toBe('#AABBCC');
  });

  it('hydrateProject sets project, dirty=false, lastSavedAt=provided', () => {
    const p = makeProject();
    p.layers[LayerId.DEFAULT] = defaultLayer();
    const ts = '2026-04-25T09:00:00.000Z';
    hydrateProject(p, ts);
    const s = projectStore.getState();
    expect(s.project?.id).toBe(p.id);
    expect(s.dirty).toBe(false);
    expect(s.lastSavedAt).toBe(ts);
  });

  it('hydrateProject throws when default layer is missing (I-13)', () => {
    const p = makeProject(); // no default layer seeded
    expect(() => hydrateProject(p, '2026-04-25T09:00:00.000Z')).toThrow(/default layer/);
  });

  it('markSaved(savedAt) flips dirty=false and uses the passed timestamp without touching project', () => {
    const p = makeProject();
    createNewProject(p);
    expect(projectStore.getState().dirty).toBe(true);

    const savedAt = '2026-04-25T10:15:30.000Z';
    markSaved(savedAt);
    const s = projectStore.getState();
    expect(s.dirty).toBe(false);
    expect(s.lastSavedAt).toBe(savedAt);
    expect(s.project?.id).toBe(p.id);
  });
});
