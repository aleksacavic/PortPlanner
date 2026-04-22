import { newObjectId, newProjectId } from '@portplanner/domain';
import type { Project } from '@portplanner/domain';
import { createNewProject, hydrateProject, markSaved } from '@portplanner/project-store';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useIsDirty, useLastSavedAt, useObjectById, useProject, useProjectId } from '../src';

function makeProject(): Project {
  return {
    id: newProjectId(),
    schemaVersion: '1.0.0',
    name: 'Test',
    createdAt: '2026-04-22T10:00:00.000Z',
    updatedAt: '2026-04-22T10:00:00.000Z',
    coordinateSystem: null,
    objects: {},
    scenarioId: null,
  };
}

describe('project-store-react hooks', () => {
  it('useProject returns null when no project, then the project after createNewProject', () => {
    const { result } = renderHook(() => useProject());
    expect(result.current).toBeNull();

    const p = makeProject();
    act(() => createNewProject(p));
    expect(result.current).toEqual(p);
  });

  it('useProjectId returns null when no project, then the id after create', () => {
    const { result } = renderHook(() => useProjectId());
    expect(result.current).toBeNull();

    const p = makeProject();
    act(() => createNewProject(p));
    expect(result.current).toBe(p.id);
  });

  it('useObjectById returns undefined when project is null', () => {
    const fakeId = newObjectId();
    const { result } = renderHook(() => useObjectById(fakeId));
    expect(result.current).toBeUndefined();
  });

  it('useIsDirty flips true on createNewProject, false on markSaved', () => {
    const { result } = renderHook(() => useIsDirty());
    expect(result.current).toBe(false);

    act(() => createNewProject(makeProject()));
    expect(result.current).toBe(true);

    act(() => markSaved('2026-04-22T10:15:30.000Z'));
    expect(result.current).toBe(false);
  });

  it('useLastSavedAt reflects hydrateProject timestamp', () => {
    const { result } = renderHook(() => useLastSavedAt());
    expect(result.current).toBeNull();

    const ts = '2026-04-22T09:00:00.000Z';
    act(() => hydrateProject(makeProject(), ts));
    expect(result.current).toBe(ts);
  });

  it('useIsDirty is false after hydrateProject (not genesis)', () => {
    const { result } = renderHook(() => useIsDirty());
    act(() => hydrateProject(makeProject(), '2026-04-22T09:00:00.000Z'));
    expect(result.current).toBe(false);
  });
});
