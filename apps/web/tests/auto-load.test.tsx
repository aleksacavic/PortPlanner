import 'fake-indexeddb/auto';

import { ThemeProvider } from '@portplanner/design-system';
import type { Project } from '@portplanner/domain';
import { LayerId, defaultLayer, newProjectId, serialize } from '@portplanner/domain';
import { projectStore, resetProjectStoreForTests } from '@portplanner/project-store';
import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from '../src/App';
import { DB_NAME, PROJECTS_STORE, type StoredProjectRecord } from '../src/persistence';

function makeProject(name = 'Seeded Port'): Project {
  return {
    id: newProjectId(),
    schemaVersion: '1.2.0',
    name,
    createdAt: '2026-04-22T10:00:00.000Z',
    updatedAt: '2026-04-22T10:00:00.000Z',
    coordinateSystem: null,
    objects: {},
    primitives: {},
    layers: { [LayerId.DEFAULT]: defaultLayer() },
    grids: {},
    scenarioId: null,
  };
}

async function resetDB(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => resolve();
  });
}

async function seed(record: StoredProjectRecord): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const openReq = indexedDB.open(DB_NAME, 1);
    openReq.onupgradeneeded = () => {
      const db = openReq.result;
      if (!db.objectStoreNames.contains(PROJECTS_STORE)) {
        const store = db.createObjectStore(PROJECTS_STORE, { keyPath: 'id' });
        store.createIndex('by-updated-at', 'updatedAt');
      }
    };
    openReq.onsuccess = () => {
      const db = openReq.result;
      const tx = db.transaction(PROJECTS_STORE, 'readwrite');
      const putReq = tx.objectStore(PROJECTS_STORE).put(record);
      putReq.onsuccess = () => {
        db.close();
        resolve();
      };
      putReq.onerror = () => {
        db.close();
        reject(putReq.error);
      };
    };
    openReq.onerror = () => reject(openReq.error);
  });
}

describe('useAutoLoadMostRecent (via <App />)', () => {
  beforeEach(async () => {
    resetProjectStoreForTests();
    await resetDB();
  });

  it('hydrates the store with the most-recent seeded project', async () => {
    const p = makeProject('Seeded Port');
    const lastSavedAt = '2026-04-22T10:30:00.000Z';
    await seed({
      id: p.id,
      name: p.name,
      updatedAt: lastSavedAt,
      blob: serialize(p),
    });

    render(
      <ThemeProvider mode="dark">
        <App />
      </ThemeProvider>,
    );

    await waitFor(() => {
      expect(projectStore.getState().project?.id).toBe(p.id);
    });
    const state = projectStore.getState();
    expect(state.dirty).toBe(false);
    expect(state.lastSavedAt).toBe(lastSavedAt);
  });

  it('bootstraps a default empty project when the db is empty (M1.3a Phase 22 follow-up)', async () => {
    render(
      <ThemeProvider mode="dark">
        <App />
      </ThemeProvider>,
    );
    // Wait for the auto-load effect to settle and the bootstrap to fire.
    await waitFor(() => {
      expect(projectStore.getState().project).not.toBeNull();
    });
    const project = projectStore.getState().project!;
    expect(project.name).toBe('Untitled');
    expect(project.primitives).toEqual({});
    expect(project.layers[LayerId.DEFAULT]).toBeDefined();
    // M1.3d Phase 8 — bootstrap also seeds a 5×5m grid on DEFAULT
    // layer, activeForSnap so GSNAP has something to snap to out of
    // the box.
    const grids = Object.values(project.grids);
    expect(grids).toHaveLength(1);
    const grid = grids[0]!;
    expect(grid.spacingX).toBe(5);
    expect(grid.spacingY).toBe(5);
    expect(grid.layerId).toBe(LayerId.DEFAULT);
    expect(grid.activeForSnap).toBe(true);
    expect(grid.visible).toBe(true);
  });

  it('contains malformed record failure — no crash, no unhandled rejection, store stays null', async () => {
    // Codex Round 1 H2 / Q2: seed IndexedDB with a record whose blob
    // cannot be deserialized. loadMostRecent() will throw LoadFailure;
    // useAutoLoadMostRecent must catch it and leave the store empty.
    await seed({
      id: 'corrupt-id',
      name: 'Corrupt',
      updatedAt: '2026-04-22T10:30:00.000Z',
      blob: '{ not valid json',
    });

    const unhandled: unknown[] = [];
    const onUnhandled = (event: PromiseRejectionEvent) => {
      unhandled.push(event.reason);
    };
    window.addEventListener('unhandledrejection', onUnhandled);
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      render(
        <ThemeProvider mode="dark">
          <App />
        </ThemeProvider>,
      );
      // Give the effect enough ticks to run the async body + microtasks.
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(projectStore.getState().project).toBeNull();
      expect(unhandled).toEqual([]);
      expect(consoleErrorSpy).toHaveBeenCalled();
    } finally {
      window.removeEventListener('unhandledrejection', onUnhandled);
      consoleErrorSpy.mockRestore();
    }
  });
});
