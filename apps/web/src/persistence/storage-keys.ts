// IndexedDB schema constants per ADR-014 M1 branch.

export const DB_NAME = 'portplanner';
export const DB_VERSION = 1;

export const PROJECTS_STORE = 'projects';
export const UPDATED_AT_INDEX = 'by-updated-at';

/** Record shape stored in the `projects` object store. */
export interface StoredProjectRecord {
  id: string;
  name: string;
  updatedAt: string;
  blob: string;
}
