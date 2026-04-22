// ADR-014 M1 branch: IndexedDB + idb wrapper + canonical JSON.
// This is the sole persistence authority per ADR-015 (no zustand-persist
// middleware). Called from UI; does NOT read the store directly.

import { LoadFailure, type Project, deserialize, serialize } from '@portplanner/domain';
import { type IDBPDatabase, openDB } from 'idb';

import {
  DB_NAME,
  DB_VERSION,
  PROJECTS_STORE,
  type StoredProjectRecord,
  UPDATED_AT_INDEX,
} from './storage-keys';

async function openProjectsDB(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(PROJECTS_STORE)) {
        const store = db.createObjectStore(PROJECTS_STORE, { keyPath: 'id' });
        store.createIndex(UPDATED_AT_INDEX, 'updatedAt');
      }
    },
  });
}

/**
 * Serialize and persist a project. Returns the timestamp that was
 * written so the caller can pass it to markSaved() without skew
 * (SR-2 mitigation).
 */
export async function saveProject(project: Project): Promise<{ savedAt: string }> {
  const savedAt = new Date().toISOString();
  const record: StoredProjectRecord = {
    id: project.id,
    name: project.name,
    updatedAt: savedAt,
    blob: serialize(project),
  };
  const db = await openProjectsDB();
  try {
    await db.put(PROJECTS_STORE, record);
    return { savedAt };
  } finally {
    db.close();
  }
}

/**
 * Load a project by id. Throws LoadFailure on missing or malformed
 * records. Returns { project, lastSavedAt } so the caller can pass
 * both to hydrateProject() in one step.
 */
export async function loadProject(id: string): Promise<{ project: Project; lastSavedAt: string }> {
  const db = await openProjectsDB();
  try {
    const record = (await db.get(PROJECTS_STORE, id)) as StoredProjectRecord | undefined;
    if (!record) {
      throw new LoadFailure(`Project '${id}' not found in IndexedDB.`);
    }
    const project = deserialize(record.blob);
    return { project, lastSavedAt: record.updatedAt };
  } finally {
    db.close();
  }
}

/**
 * Load the most recently updated project, or null if the store is
 * empty. Used by the cold-start auto-load hook.
 */
export async function loadMostRecent(): Promise<{ project: Project; lastSavedAt: string } | null> {
  const db = await openProjectsDB();
  try {
    const tx = db.transaction(PROJECTS_STORE, 'readonly');
    const index = tx.store.index(UPDATED_AT_INDEX);
    // Descending by updatedAt — open cursor from the end.
    const cursor = await index.openCursor(null, 'prev');
    if (!cursor) {
      return null;
    }
    const record = cursor.value as StoredProjectRecord;
    const project = deserialize(record.blob);
    return { project, lastSavedAt: record.updatedAt };
  } finally {
    db.close();
  }
}

/**
 * Summary list of all projects by recency (descending). Not used in
 * M1.2 UX (single-active-project model); infra for M2 multi-project.
 */
export async function listProjectsByRecency(): Promise<
  Array<{ id: string; name: string; updatedAt: string }>
> {
  const db = await openProjectsDB();
  try {
    const records = (await db.getAllFromIndex(
      PROJECTS_STORE,
      UPDATED_AT_INDEX,
    )) as StoredProjectRecord[];
    return records
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
      .map(({ id, name, updatedAt }) => ({ id, name, updatedAt }));
  } finally {
    db.close();
  }
}
