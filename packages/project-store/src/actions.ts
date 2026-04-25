// Whole-state replacement actions per §6 PI-1 of the M1.2 plan.
// Each action encodes explicit dirty semantics — no persistence-bridge
// watcher. No single generic `setDocument` (SR-1 fix).
//
// Whole-state replacement actions live HERE (root actions.ts). Entity-
// level CRUD lives under actions/ and goes through emitOperation
// (Phase 6). The Gate 6.5 directory scope (rg in actions/ for
// projectStore.setState) excludes this file — these actions are the
// legitimate setState bypass per A8.

import { LayerId, type Project, defaultLayer } from '@portplanner/domain';

import { clearOperationLog } from './operation-emit';
import { projectStore } from './store';

/**
 * Genesis path. Creates a fresh project in the store:
 *   - project := the provided value (with default layer seeded if absent)
 *   - dirty := true (user has unsaved work until Save)
 *   - lastSavedAt := null (never saved yet)
 *   - operation log := cleared
 * Clears zundo temporal history (whole-state replacement).
 * Not an entity-level mutation per ADR-020.
 */
export function createNewProject(project: Project): void {
  // Seed the default layer if it is not already present so every
  // project leaves this action with a non-empty `layers` map (I-12).
  const seeded: Project = project.layers[LayerId.DEFAULT]
    ? project
    : {
        ...project,
        layers: { ...project.layers, [LayerId.DEFAULT]: defaultLayer() },
      };

  projectStore.setState((state) => {
    state.project = seeded;
    state.dirty = true;
    state.lastSavedAt = null;
  });
  projectStore.temporal.getState().clear();
  clearOperationLog();
}

/**
 * Hydration path. Restores a previously-saved project from IndexedDB:
 *   - project := the loaded value
 *   - dirty := false (matches saved state)
 *   - lastSavedAt := the timestamp from the stored record
 *   - operation log := cleared
 * Clears zundo temporal history (whole-state replacement).
 * Throws if the project is missing the default layer (I-13).
 * Not an entity-level mutation per ADR-020.
 */
export function hydrateProject(project: Project, lastSavedAt: string): void {
  if (!project.layers[LayerId.DEFAULT]) {
    throw new Error('hydrateProject: project is missing the protected default layer');
  }
  projectStore.setState((state) => {
    state.project = project;
    state.dirty = false;
    state.lastSavedAt = lastSavedAt;
  });
  projectStore.temporal.getState().clear();
  clearOperationLog();
}

/**
 * Post-save metadata update. Does NOT touch `state.project`:
 *   - dirty := false
 *   - lastSavedAt := the timestamp the persistence layer wrote
 *
 * `savedAt` MUST be the `savedAt` returned by `saveProject()` so the
 * in-memory `lastSavedAt` is byte-identical to the IndexedDB record's
 * `updatedAt` (SR-2 remediation — Codex Round 1 H1). Callers that
 * stamp a fresh `new Date()` here would drift by up to tens of ms
 * under load and lose end-to-end timestamp identity.
 *
 * Not a mutation per ADR-010 (persistence metadata only).
 */
export function markSaved(savedAt: string): void {
  projectStore.setState((state) => {
    state.dirty = false;
    state.lastSavedAt = savedAt;
  });
}
