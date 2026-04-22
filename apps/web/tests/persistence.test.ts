import 'fake-indexeddb/auto';

import { LoadFailure, newProjectId, serialize } from '@portplanner/domain';
import type { Project } from '@portplanner/domain';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  DB_NAME,
  PROJECTS_STORE,
  type StoredProjectRecord,
  listProjectsByRecency,
  loadMostRecent,
  loadProject,
  saveProject,
} from '../src/persistence';

function makeProject(name = 'Test Port'): Project {
  return {
    id: newProjectId(),
    schemaVersion: '1.0.0',
    name,
    createdAt: '2026-04-22T10:00:00.000Z',
    updatedAt: '2026-04-22T10:00:00.000Z',
    coordinateSystem: null,
    objects: {},
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

beforeEach(async () => {
  await resetDB();
});

describe('project persistence (IndexedDB + idb)', () => {
  it('round-trips a project to byte-identical canonical JSON', async () => {
    const p = makeProject();
    const { savedAt } = await saveProject(p);
    expect(savedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    const { project: loaded, lastSavedAt } = await loadProject(p.id);
    expect(serialize(loaded)).toBe(serialize(p));
    expect(lastSavedAt).toBe(savedAt);
  });

  it('loadMostRecent returns the later-updated project when multiple exist', async () => {
    const older = makeProject('Older');
    await saveProject(older);

    await new Promise((resolve) => setTimeout(resolve, 10));

    const newer = makeProject('Newer');
    await saveProject(newer);

    const result = await loadMostRecent();
    expect(result).not.toBeNull();
    expect(result?.project.name).toBe('Newer');
  });

  it('loadMostRecent returns null on empty store', async () => {
    const result = await loadMostRecent();
    expect(result).toBeNull();
  });

  it('listProjectsByRecency returns summaries sorted descending', async () => {
    const a = makeProject('A');
    await saveProject(a);
    await new Promise((resolve) => setTimeout(resolve, 5));
    const b = makeProject('B');
    await saveProject(b);

    const list = await listProjectsByRecency();
    expect(list.map((p) => p.name)).toEqual(['B', 'A']);
  });

  it('loadProject throws LoadFailure for non-existent id', async () => {
    await expect(loadProject(newProjectId())).rejects.toBeInstanceOf(LoadFailure);
  });

  it('loadProject throws LoadFailure when blob is malformed', async () => {
    // Seed a record with bogus blob
    const req = indexedDB.open(DB_NAME, 1);
    await new Promise<void>((resolve, reject) => {
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(PROJECTS_STORE)) {
          const store = db.createObjectStore(PROJECTS_STORE, { keyPath: 'id' });
          store.createIndex('by-updated-at', 'updatedAt');
        }
      };
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
    const db = req.result;
    const id = newProjectId();
    const record: StoredProjectRecord = {
      id,
      name: 'Malformed',
      updatedAt: '2026-04-22T10:00:00.000Z',
      blob: '{ not valid json',
    };
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(PROJECTS_STORE, 'readwrite');
      const putReq = tx.objectStore(PROJECTS_STORE).put(record);
      putReq.onsuccess = () => resolve();
      putReq.onerror = () => reject(putReq.error);
    });
    db.close();

    await expect(loadProject(id)).rejects.toBeInstanceOf(LoadFailure);
  });
});
