import { newProjectId } from '@portplanner/domain';
import type { Project } from '@portplanner/domain';
import { describe, expect, it } from 'vitest';

import { createNewProject, hydrateProject, markSaved } from '../src/actions';
import { projectStore } from '../src/store';

function makeProject(): Project {
  return {
    id: newProjectId(),
    schemaVersion: '1.0.0',
    name: 'Test Port',
    createdAt: '2026-04-22T10:00:00.000Z',
    updatedAt: '2026-04-22T10:00:00.000Z',
    coordinateSystem: null,
    objects: {},
    scenarioId: null,
  };
}

describe('project store actions', () => {
  it('createNewProject sets project, dirty=true, lastSavedAt=null', () => {
    const p = makeProject();
    createNewProject(p);
    const s = projectStore.getState();
    expect(s.project).toEqual(p);
    expect(s.dirty).toBe(true);
    expect(s.lastSavedAt).toBeNull();
  });

  it('hydrateProject sets project, dirty=false, lastSavedAt=provided', () => {
    const p = makeProject();
    const ts = '2026-04-22T09:00:00.000Z';
    hydrateProject(p, ts);
    const s = projectStore.getState();
    expect(s.project).toEqual(p);
    expect(s.dirty).toBe(false);
    expect(s.lastSavedAt).toBe(ts);
  });

  it('markSaved(savedAt) flips dirty=false and uses the passed timestamp without touching project', () => {
    const p = makeProject();
    createNewProject(p);
    expect(projectStore.getState().dirty).toBe(true);

    const savedAt = '2026-04-22T10:15:30.000Z';
    markSaved(savedAt);
    const s = projectStore.getState();
    expect(s.dirty).toBe(false);
    // Codex Round 1 H1: lastSavedAt is byte-identical to the passed
    // savedAt (no new Date() in markSaved).
    expect(s.lastSavedAt).toBe(savedAt);
    expect(s.project).toEqual(p); // unchanged
  });
});
