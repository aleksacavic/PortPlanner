import 'fake-indexeddb/auto';

import { ThemeProvider } from '@portplanner/design-system';
import type { Project } from '@portplanner/domain';
import { LayerId, defaultLayer, deserialize, newProjectId } from '@portplanner/domain';
import {
  createNewProject,
  projectStore,
  resetProjectStoreForTests,
} from '@portplanner/project-store';
import { fireEvent, render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { DB_NAME, PROJECTS_STORE, type StoredProjectRecord } from '../src/persistence';
import { SaveButton } from '../src/toolbar/SaveButton';

function makeProject(name = 'Test Port'): Project {
  return {
    id: newProjectId(),
    schemaVersion: '1.1.0',
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

function renderButton() {
  return render(
    <ThemeProvider mode="dark">
      <SaveButton />
    </ThemeProvider>,
  );
}

async function readStoredRecord(id: string): Promise<StoredProjectRecord | undefined> {
  return new Promise((resolve, reject) => {
    const openReq = indexedDB.open(DB_NAME, 1);
    openReq.onsuccess = () => {
      const db = openReq.result;
      const tx = db.transaction(PROJECTS_STORE, 'readonly');
      const getReq = tx.objectStore(PROJECTS_STORE).get(id);
      getReq.onsuccess = () => {
        db.close();
        resolve(getReq.result as StoredProjectRecord | undefined);
      };
      getReq.onerror = () => {
        db.close();
        reject(getReq.error);
      };
    };
    openReq.onerror = () => reject(openReq.error);
  });
}

describe('<SaveButton />', () => {
  beforeEach(async () => {
    resetProjectStoreForTests();
    await resetDB();
  });

  it('is disabled when no project is loaded', () => {
    const { getByRole } = renderButton();
    expect((getByRole('button') as HTMLButtonElement).disabled).toBe(true);
  });

  it('is enabled when a dirty project is loaded', () => {
    createNewProject(makeProject());
    const { getByRole } = renderButton();
    expect((getByRole('button') as HTMLButtonElement).disabled).toBe(false);
  });

  it('saves the project, writes the record, and flips dirty=false', async () => {
    const p = makeProject();
    createNewProject(p);
    const { getByRole } = renderButton();
    fireEvent.click(getByRole('button'));

    await waitFor(() => {
      expect(projectStore.getState().dirty).toBe(false);
    });

    const stored = await readStoredRecord(p.id);
    expect(stored).toBeDefined();
    expect(stored?.name).toBe('Test Port');
    const roundTripped = deserialize(stored?.blob ?? '');
    expect(roundTripped.id).toBe(p.id);

    // Codex Round 1 H1 / Q1: the store's lastSavedAt must be
    // byte-identical to the IndexedDB record's updatedAt — no clock
    // skew introduced by a second new Date() inside markSaved.
    expect(projectStore.getState().lastSavedAt).toBe(stored?.updatedAt);
  });
});
