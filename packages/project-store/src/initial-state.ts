import type { Project } from '@portplanner/domain';

/** The shape of the project store. `project` is null until a project
 *  is created or loaded. */
export interface ProjectStoreState {
  project: Project | null;
  dirty: boolean;
  lastSavedAt: string | null;
}

export function createInitialProjectStoreState(): ProjectStoreState {
  return { project: null, dirty: false, lastSavedAt: null };
}
