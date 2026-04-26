import {
  LayerId,
  defaultLayer,
  newGridId,
  newLayerId,
  newObjectId,
  newPrimitiveId,
  newProjectId,
} from '@portplanner/domain';
import type { Project } from '@portplanner/domain';
import {
  addGrid,
  addLayer,
  addPrimitive,
  createNewProject,
  hydrateProject,
  markSaved,
  resetProjectStoreForTests,
} from '@portplanner/project-store';
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  useDefaultLayer,
  useGrid,
  useGrids,
  useIsDirty,
  useLastSavedAt,
  useLayer,
  useLayers,
  useObjectById,
  usePrimitive,
  usePrimitives,
  useProject,
  useProjectId,
} from '../src';

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

describe('project-store-react hooks', () => {
  afterEach(() => {
    resetProjectStoreForTests();
  });

  it('useProject returns null when no project, then the project after createNewProject', () => {
    const { result } = renderHook(() => useProject());
    expect(result.current).toBeNull();

    const p = makeProject();
    act(() => createNewProject(p));
    expect(result.current?.id).toBe(p.id);
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

    act(() => markSaved('2026-04-25T10:15:30.000Z'));
    expect(result.current).toBe(false);
  });

  it('useLastSavedAt reflects hydrateProject timestamp', () => {
    const { result } = renderHook(() => useLastSavedAt());
    expect(result.current).toBeNull();

    const ts = '2026-04-25T09:00:00.000Z';
    act(() => hydrateProject(makeProject(), ts));
    expect(result.current).toBe(ts);
  });

  it('useIsDirty is false after hydrateProject (not genesis)', () => {
    const { result } = renderHook(() => useIsDirty());
    act(() => hydrateProject(makeProject(), '2026-04-25T09:00:00.000Z'));
    expect(result.current).toBe(false);
  });
});

describe('M1.3a entity hooks', () => {
  afterEach(() => {
    resetProjectStoreForTests();
  });

  it('useDefaultLayer returns the seeded default layer', () => {
    act(() => createNewProject(makeProject()));
    const { result } = renderHook(() => useDefaultLayer());
    expect(result.current?.name).toBe('0');
  });

  it('useLayer returns a layer added via addLayer', () => {
    act(() => createNewProject(makeProject()));
    const id = newLayerId();
    act(() =>
      addLayer({
        id,
        name: 'Roads',
        color: '#FF0000',
        lineType: 'continuous',
        lineWeight: 0.25,
        visible: true,
        frozen: false,
        locked: false,
      }),
    );
    const { result } = renderHook(() => useLayer(id));
    expect(result.current?.name).toBe('Roads');
  });

  it('useLayers reflects all layers including default after create', () => {
    act(() => createNewProject(makeProject()));
    const { result } = renderHook(() => useLayers());
    expect(Object.keys(result.current)).toContain(LayerId.DEFAULT);
  });

  it('usePrimitive returns a primitive added via addPrimitive', () => {
    act(() => createNewProject(makeProject()));
    const id = newPrimitiveId();
    act(() =>
      addPrimitive({
        id,
        kind: 'line',
        layerId: LayerId.DEFAULT,
        displayOverrides: {},
        p1: { x: 0, y: 0 },
        p2: { x: 10, y: 0 },
      }),
    );
    const { result } = renderHook(() => usePrimitive(id));
    expect(result.current?.kind).toBe('line');
  });

  it('usePrimitives reflects all primitives', () => {
    act(() => createNewProject(makeProject()));
    const { result } = renderHook(() => usePrimitives());
    expect(Object.keys(result.current)).toHaveLength(0);
    const id = newPrimitiveId();
    act(() =>
      addPrimitive({
        id,
        kind: 'point',
        layerId: LayerId.DEFAULT,
        displayOverrides: {},
        position: { x: 0, y: 0 },
      }),
    );
    expect(Object.keys(result.current)).toHaveLength(1);
  });

  it('useGrid returns a grid added via addGrid', () => {
    act(() => createNewProject(makeProject()));
    const id = newGridId();
    act(() =>
      addGrid({
        id,
        origin: { x: 0, y: 0 },
        angle: 0,
        spacingX: 6,
        spacingY: 6,
        layerId: LayerId.DEFAULT,
        visible: true,
        activeForSnap: true,
      }),
    );
    const { result } = renderHook(() => useGrid(id));
    expect(result.current?.spacingX).toBe(6);
  });

  it('useGrids returns the grid record', () => {
    act(() => createNewProject(makeProject()));
    const { result } = renderHook(() => useGrids());
    expect(Object.keys(result.current)).toHaveLength(0);
  });
});
