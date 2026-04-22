// Three named non-mutation actions per §6 PI-1 of the M1.2 plan.
// Each action encodes explicit dirty semantics — no persistence-bridge
// watcher. No single generic `setDocument` (SR-1 fix).

import type { Project } from '@portplanner/domain';

import { projectStore } from './store';

/**
 * Genesis path. Creates a fresh project in the store:
 *   - project := the provided value
 *   - dirty := true (user has unsaved work until Save)
 *   - lastSavedAt := null (never saved yet)
 * Clears zundo temporal history (whole-state replacement).
 * Not a mutation per ADR-010.
 */
export function createNewProject(project: Project): void {
  projectStore.setState((state) => {
    state.project = project;
    state.dirty = true;
    state.lastSavedAt = null;
  });
  projectStore.temporal.getState().clear();
}

/**
 * Hydration path. Restores a previously-saved project from IndexedDB:
 *   - project := the loaded value
 *   - dirty := false (matches saved state)
 *   - lastSavedAt := the timestamp from the stored record
 * Clears zundo temporal history (whole-state replacement).
 * Not a mutation per ADR-010.
 */
export function hydrateProject(project: Project, lastSavedAt: string): void {
  projectStore.setState((state) => {
    state.project = project;
    state.dirty = false;
    state.lastSavedAt = lastSavedAt;
  });
  projectStore.temporal.getState().clear();
}

/**
 * Post-save metadata update. Does NOT touch `state.project`:
 *   - dirty := false
 *   - lastSavedAt := current ISO timestamp
 * Not a mutation per ADR-010 (persistence metadata only).
 */
export function markSaved(): void {
  projectStore.setState((state) => {
    state.dirty = false;
    state.lastSavedAt = new Date().toISOString();
  });
}
